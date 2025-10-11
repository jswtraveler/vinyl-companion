import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RecommendationService } from '../services/recommendationService.js';
import { GraphRecommendationService } from '../services/recommendations/algorithms/GraphRecommender.js';
import { applyDiversityFilter, getDiversityStats } from '../utils/diversityFilter.js';
import ArtistMetadataRefreshModal from './ArtistMetadataRefreshModal.jsx';
import SpotifyImageBackfillModal from './SpotifyImageBackfillModal.jsx';
import ArtistCarousel from './ArtistCarousel.jsx';
import { getDistinctGenres } from '../utils/genreUtils.js';

/**
 * Merge fetched metadata into artist recommendation objects
 * @param {Array} artists - Artist recommendations
 * @param {Object} artistMetadataMap - Map of artistName -> metadata
 * @returns {Array} Artists with metadata populated
 */
function mergeMetadataIntoArtists(artists, artistMetadataMap) {
  return artists.map(artist => {
    const metadata = artistMetadataMap[artist.artist];

    if (metadata) {
      // Extract genres from tags if needed
      const genres = metadata.genres ||
                     (metadata.tags ? metadata.tags.map(tag =>
                       typeof tag === 'object' ? tag.name : tag
                     ).filter(Boolean).slice(0, 3) : []);

      return {
        ...artist,
        // Use Spotify image if available, fall back to existing image
        image: metadata.spotifyImage || artist.image || null,
        spotifyId: metadata.spotifyId || null,
        spotifyUrl: metadata.spotifyUrl || null,
        metadata: {
          tags: metadata.tags || [],
          genres: genres,
          playcount: metadata.playcount || 0,
          listeners: metadata.listeners || 0,
          bio: metadata.bio || null,
          spotifyImage: metadata.spotifyImage || null
        }
      };
    }

    // No metadata found - return with empty structure
    return {
      ...artist,
      metadata: {
        tags: [],
        genres: [],
        playcount: 0,
        listeners: 0,
        bio: null
      }
    };
  });
}

const ArtistRecommendationSection = ({ albums, user, useCloudDatabase, onActionsReady }) => {
  const [recommendations, setRecommendations] = useState(null); // Based on entire collection
  const [genreRecommendations, setGenreRecommendations] = useState({}); // { genre: { artists, count }, ... }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendationService, setRecommendationService] = useState(null);
  const [graphService, setGraphService] = useState(null);
  const [useGraphAlgorithm, setUseGraphAlgorithm] = useState(false); // Temporarily disabled for local dev
  const isGeneratingRef = useRef(false); // Prevent duplicate calls
  const [diversityEnabled, setDiversityEnabled] = useState(true); // Enable diversity filtering by default
  const lastGeneratedFingerprintRef = useRef(null); // Track last collection fingerprint
  const [showMetadataRefreshModal, setShowMetadataRefreshModal] = useState(false);
  const [showSpotifyBackfillModal, setShowSpotifyBackfillModal] = useState(false);

  // Initialize recommendation services
  useEffect(() => {
    try {
      const service = new RecommendationService({
        enableCaching: true,
        enablePersistentCaching: useCloudDatabase,
        userId: user?.id || null,
        minCollectionSize: 5,
        useListenBrainz: false,
        listenBrainzFallbackToLastfm: true,
        listenBrainzToken: import.meta.env.VITE_LISTENBRAINZ_TOKEN
      });
      setRecommendationService(service);

      // Initialize graph recommendation service (now using PPR)
      const graphRecommendationService = new GraphRecommendationService({
        maxIterations: 20,
        dampingFactor: 0.85,
        convergenceThreshold: 0.0001,
        minSimilarityThreshold: 0.3,
        maxRecommendations: 50, // Fetch 50 for diversity filtering
        enableLogging: true
      });
      setGraphService(graphRecommendationService);
    } catch (err) {
      console.error('Failed to initialize recommendation services:', err);
      setError('Recommendation services unavailable');
    }
  }, [user, useCloudDatabase]);


  // Check if we have enough albums for recommendations
  const hasEnoughAlbums = useMemo(() => {
    return albums && albums.length >= 5;
  }, [albums]);

  // Generate artist recommendations when albums change
  const generateArtistRecommendations = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate calls
    if (isGeneratingRef.current) {
      console.log('🚫 Skipping duplicate recommendation generation call');
      return;
    }
    if (!recommendationService || !albums || albums.length < 5) {
      return;
    }

    // Check if collection fingerprint changed (avoid regenerating on tab switch)
    const cacheService = recommendationService.cacheService;
    if (cacheService && !forceRefresh) {
      const currentFingerprint = cacheService.generateCollectionFingerprint(albums);
      const algorithmSuffix = useGraphAlgorithm ? '_graph' : '_basic';
      const fullFingerprint = `${currentFingerprint}${algorithmSuffix}`;

      if (lastGeneratedFingerprintRef.current === fullFingerprint && recommendations && recommendations.total > 0) {
        console.log('✅ Skipping regeneration - collection and algorithm unchanged since last generation');
        return;
      }
      lastGeneratedFingerprintRef.current = fullFingerprint;
    }

    isGeneratingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log('🎨 Generating artist recommendations for collection...');

      // Check if we have cached artist recommendations first
      const cacheService = recommendationService.cacheService;
      const userId = recommendationService.config.userId;

      console.log(`🔧 Debug: Albums count: ${albums.length}, User ID: ${userId}, Graph enabled: ${useGraphAlgorithm}`);
      let artistRecommendations = null;
      let fromCache = false;

      if (cacheService && userId) {
        const collectionFingerprint = cacheService.generateCollectionFingerprint(albums);
        const algorithmSuffix = useGraphAlgorithm ? '_graph' : '_basic';
        const cacheKey = `artist_recs_${collectionFingerprint}${algorithmSuffix}`;

        // Try to get cached artist recommendations
        const cachedArtistRecs = await cacheService.getUserRecommendationsCache(userId, cacheKey);
        if (cachedArtistRecs && cachedArtistRecs.recommendations?.artists) {
          artistRecommendations = cachedArtistRecs.recommendations;
          fromCache = true;
          console.log(`✅ Using cached ${useGraphAlgorithm ? 'graph' : 'basic'} artist recommendations`);
        }
      }

      // If not cached, generate fresh recommendations
      if (!artistRecommendations) {
        if (useGraphAlgorithm && graphService) {
          console.log('🕸️ Using graph-based algorithm for artist recommendations...');

          // Use PPR algorithm for enhanced discovery
          const graphResult = await graphService.generateGraphRecommendations(userId, albums, {
            maxIterations: 20,
            dampingFactor: 0.85,
            minSimilarityThreshold: 0.3
          });

          if (graphResult.success) {
            console.log('🎯 PPR algorithm succeeded, now fetching metadata for recommendations...');

            // Extract ALL PPR candidates for metadata refresh (not just top 50)
            const allPPRCandidates = graphResult.recommendations.map(a => ({
              artist: a.artist,
              mbid: a.mbid || null
            }));

            console.log(`📊 Extracted ${allPPRCandidates.length} PPR candidates for metadata refresh`);

            // TWO-PASS: Fetch metadata for top 50 PPR recommendations (more data for diversity filtering)
            const topCandidates = graphResult.recommendations.slice(0, 50);
            // Deduplicate artists by name to avoid fetching same artist multiple times
            const artistNamesForPPRMetadata = [...new Set(topCandidates.map(a => a.artist))];

            // OPTIMIZED: Batch fetch metadata for all artists at once
            console.time('🚀 Batch fetch PPR metadata');
            const artistMetadata = await recommendationService.cacheService.getBatchArtistMetadataCache(artistNamesForPPRMetadata);
            console.timeEnd('🚀 Batch fetch PPR metadata');

            console.log('📊 PPR metadata complete:', Object.keys(artistMetadata).length, 'artists');

            // Merge metadata into graph recommendations
            const artistsWithMetadata = mergeMetadataIntoArtists(
              graphResult.recommendations,
              artistMetadata
            );

            // Store ALL candidates for diversity filtering (don't slice here)
            artistRecommendations = {
              artists: artistsWithMetadata, // Keep all 50 for diversity filtering
              total: artistsWithMetadata.length,
              metadata: {
                ...graphResult.metadata,
                algorithm: 'personalized_pagerank',
                generatedAt: new Date().toISOString(),
                fullCandidateCount: artistsWithMetadata.length,
                allSimilarArtists: allPPRCandidates // Store all for metadata refresh
              }
            };

            console.log(`✅ PPR recommendations with metadata ready (${artistsWithMetadata.length} candidates for filtering)`);
          } else {
            console.warn('Graph algorithm failed, falling back to basic algorithm');
            console.log('🔧 Graph failure reason:', graphResult.error);
            // Fall back to basic algorithm
            artistRecommendations = await generateBasicRecommendations(albums);
          }
        } else {
          console.log('📊 Using basic similarity algorithm for artist recommendations...');
          artistRecommendations = await generateBasicRecommendations(albums);
        }

        // Cache the artist recommendations with algorithm-specific key
        if (cacheService && userId && artistRecommendations && artistRecommendations.total > 0) {
          const collectionFingerprint = cacheService.generateCollectionFingerprint(albums);
          const algorithmSuffix = useGraphAlgorithm ? '_graph' : '_basic';
          const cacheKey = `artist_recs_${collectionFingerprint}${algorithmSuffix}`;
          await cacheService.setUserRecommendationsCache(userId, cacheKey, {
            artists: artistRecommendations.artists,
            total: artistRecommendations.total,
            metadata: {
              ...artistRecommendations.metadata,
              originalArtists: artistRecommendations.artists // Store unfiltered list for diversity toggling
            }
          });
        }
      }

      if (artistRecommendations && artistRecommendations.total > 0) {
        // Get original artists (either from fresh generation or from cache)
        const originalArtists = artistRecommendations.metadata?.originalArtists || artistRecommendations.artists;

        // Apply diversity filtering if enabled
        let finalArtists = [...originalArtists]; // Start with original unfiltered list
        let diversityStats = null;

        if (diversityEnabled && finalArtists.length > 0) {
          console.log(`🎯 Applying diversity filter to ${finalArtists.length} artist recommendations...`);
          finalArtists = applyDiversityFilter(finalArtists, {
            maxSameGenre: 3,
            maxSameDecade: 4,
            diversityWeight: 0.3,
            genreDistributionTarget: 0.4
          });

          // Limit to top 20 after diversity filtering
          finalArtists = finalArtists.slice(0, 20);

          diversityStats = getDiversityStats(finalArtists);
          console.log('🎯 Diversity stats:', diversityStats);
        } else {
          console.log(`🎯 Diversity filter disabled - showing top 20 of ${finalArtists.length} recommendations`);
          // When diversity is off, just show top 20 by score
          finalArtists = finalArtists.slice(0, 20);
        }

        setRecommendations({
          ...artistRecommendations,
          artists: finalArtists,
          total: finalArtists.length,
          metadata: {
            ...artistRecommendations.metadata,
            cached: fromCache,
            diversityEnabled,
            diversityStats,
            originalArtists // Preserve original unfiltered list for toggling
          }
        });
        console.log(`✅ Artist recommendations ready (${finalArtists.length} shown, ${originalArtists.length} total)`);
      } else {
        setError('No artist recommendations available at this time');
      }
    } catch (err) {
      console.error('❌ Failed to generate artist recommendations:', err);
      setError('Failed to generate artist recommendations');
    } finally {
      setLoading(false);
      isGeneratingRef.current = false;
    }
  }, [recommendationService, graphService, albums, useGraphAlgorithm]);

  // Effect to trigger recommendations when dependencies change
  useEffect(() => {
    if (!recommendationService || !graphService || !hasEnoughAlbums || !albums) {
      return;
    }

    // Only generate if we don't already have recommendations for this collection
    if (!recommendations || recommendations.total === 0) {
      generateArtistRecommendations();
    }
  }, [recommendationService, graphService, hasEnoughAlbums, albums?.length, useGraphAlgorithm]);

  // Separate effect to handle algorithm switching (load from cache or regenerate)
  useEffect(() => {
    if (!recommendations || !recommendationService?.cacheService || !user?.id) {
      return;
    }

    const loadOrGenerateForAlgorithm = async () => {
      const cacheService = recommendationService.cacheService;
      const userId = user.id;
      const collectionFingerprint = cacheService.generateCollectionFingerprint(albums);
      const algorithmSuffix = useGraphAlgorithm ? '_graph' : '_basic';
      const cacheKey = `artist_recs_${collectionFingerprint}${algorithmSuffix}`;

      // Try to load from cache for this algorithm
      const cachedArtistRecs = await cacheService.getUserRecommendationsCache(userId, cacheKey);

      if (cachedArtistRecs && cachedArtistRecs.recommendations?.artists) {
        console.log(`✅ Switching to cached ${useGraphAlgorithm ? 'graph' : 'basic'} recommendations`);

        const originalArtists = cachedArtistRecs.recommendations.metadata?.originalArtists || cachedArtistRecs.recommendations.artists;
        let finalArtists = [...originalArtists];
        let diversityStats = null;

        if (diversityEnabled) {
          finalArtists = applyDiversityFilter(finalArtists, {
            maxSameGenre: 3,
            maxSameDecade: 4,
            diversityWeight: 0.3,
            genreDistributionTarget: 0.4
          });
          finalArtists = finalArtists.slice(0, 20);
          diversityStats = getDiversityStats(finalArtists);
        } else {
          finalArtists = finalArtists.slice(0, 20);
        }

        setRecommendations({
          ...cachedArtistRecs.recommendations,
          artists: finalArtists,
          total: finalArtists.length,
          metadata: {
            ...cachedArtistRecs.recommendations.metadata,
            cached: true,
            diversityEnabled,
            diversityStats,
            originalArtists
          }
        });
      } else {
        console.log(`⚠️ No cached ${useGraphAlgorithm ? 'graph' : 'basic'} recommendations found - generating...`);
        // Update fingerprint ref to allow regeneration for this algorithm
        const fullFingerprint = `${collectionFingerprint}${algorithmSuffix}`;
        lastGeneratedFingerprintRef.current = null; // Clear to allow generation
        await generateArtistRecommendations();
      }
    };

    loadOrGenerateForAlgorithm();
  }, [useGraphAlgorithm]); // Only trigger when algorithm changes

  // Separate effect to handle diversity changes on existing recommendations
  useEffect(() => {
    if (!recommendations || !recommendations.artists || recommendations.artists.length === 0) {
      return;
    }

    console.log(`🎯 Reapplying diversity filter (enabled: ${diversityEnabled}) to existing recommendations`);

    // Get the original unfiltered artists from metadata if available
    const originalArtists = recommendations.metadata?.originalArtists || recommendations.artists;
    let finalArtists = [...originalArtists];
    let diversityStats = null;

    if (diversityEnabled) {
      console.log(`🎯 Applying diversity filter to ${originalArtists.length} existing recommendations...`);
      finalArtists = applyDiversityFilter(originalArtists, {
        maxSameGenre: 3,
        maxSameDecade: 4,
        diversityWeight: 0.3,
        genreDistributionTarget: 0.4
      });
      finalArtists = finalArtists.slice(0, 20);

      diversityStats = getDiversityStats(finalArtists);
      console.log('🎯 Diversity stats:', diversityStats);
    } else {
      console.log(`🎯 Diversity disabled - showing top 20 of ${originalArtists.length}`);
      finalArtists = finalArtists.slice(0, 20);
    }

    // Update recommendations with new diversity filtering
    setRecommendations(prev => ({
      ...prev,
      artists: finalArtists,
      total: finalArtists.length,
      metadata: {
        ...prev.metadata,
        diversityEnabled,
        diversityStats,
        originalArtists: prev.metadata?.originalArtists || prev.artists // Store original for future toggles
      }
    }));
  }, [diversityEnabled]); // Only trigger when diversity setting changes

  // Progressive collection is now handled server-side by Edge Function
  // Client no longer needs to manage background collection queue

  const generateBasicRecommendations = async (albums) => {
    try {
      console.log('📊 Starting basic recommendation generation...');

      // Build user profile to get artist list
      console.log('📊 Debug: Sample album data:', albums[0]);
      console.log('📊 Debug: All artists from albums:', albums.map(a => a.artist).filter(Boolean));

      const profile = await recommendationService.buildUserProfile(albums);
      console.log('📊 User profile built with', profile.artists?.length || 0, 'artists');
      console.log('📊 Debug: Profile artists:', profile.artists?.slice(0, 3));

      // OPTIMIZED: Use batch query for all artists at once
      console.log('📊 Batch fetching similarity data for', profile.artists?.length || 0, 'artists');
      console.log('📊 Artists to fetch (sample):', profile.artists?.slice(0, 3));

      console.time('🚀 Batch fetch similarity data');
      const artistNames = (profile.artists || []).map(a => a.artist);
      const similarArtistsMap = await recommendationService.cacheService.getBatchSimilarArtistsCache(artistNames, 'lastfm');
      console.timeEnd('🚀 Batch fetch similarity data');
      console.log('📊 Batch similarity data fetched:', Object.keys(similarArtistsMap).length, 'artists');

      // Convert to expected format
      const externalData = {
        similarArtists: similarArtistsMap
      };

      if (externalData && Object.keys(externalData.similarArtists || {}).length > 0) {
        // Extract ALL similar artists from externalData for metadata refresh
        const allSimilarArtists = [];
        const seenArtists = new Set();

        Object.values(externalData.similarArtists || {}).forEach(artistData => {
          artistData.similarArtists.forEach(similarArtist => {
            const normalizedName = similarArtist.name.toLowerCase();
            if (!seenArtists.has(normalizedName)) {
              seenArtists.add(normalizedName);
              allSimilarArtists.push({
                artist: similarArtist.name,
                mbid: similarArtist.mbid || null
              });
            }
          });
        });

        console.log(`📊 Extracted ${allSimilarArtists.length} unique similar artists for metadata refresh`);

        // TWO-PASS APPROACH: Score first, then fetch metadata for top candidates
        console.log('🎯 Pass 1: Building artist recommendations WITHOUT metadata (fast)...');

        // Build recommendations without metadata first
        const artistRecs = await buildArtistRecommendations(externalData, albums);
        console.log('📊 Pass 1 complete:', artistRecs?.total || 0, 'artists scored');

        if (artistRecs && artistRecs.artists && artistRecs.artists.length > 0) {
          // TWO-PASS: Now fetch metadata for top 50 candidates (for diversity filtering)
          console.log('🎯 Pass 2: Fetching metadata for top 50 candidates...');

          const topCandidates = artistRecs.artists.slice(0, 50);
          // Deduplicate artists by name to avoid fetching same artist multiple times
          const artistNamesForMetadata = [...new Set(topCandidates.map(a => a.artist))];

          // OPTIMIZED: Batch fetch metadata for all artists at once
          console.time('🚀 Batch fetch metadata');
          const artistMetadata = await recommendationService.cacheService.getBatchArtistMetadataCache(artistNamesForMetadata);
          console.timeEnd('🚀 Batch fetch metadata');

          console.log('📊 Pass 2 complete: metadata for', Object.keys(artistMetadata).length, 'artists');

          // Debug: Check what metadata looks like
          const sampleKey = Object.keys(artistMetadata)[0];
          if (sampleKey) {
            console.log('🔍 Sample metadata for', sampleKey, ':', artistMetadata[sampleKey]);
          }

          // Merge metadata into recommendations
          artistRecs.artists = mergeMetadataIntoArtists(artistRecs.artists, artistMetadata);

          // Debug: Check merged result
          if (artistRecs.artists[0]) {
            console.log('🔍 Sample merged artist:', artistRecs.artists[0]);
          }

          console.log('✅ Two-pass complete:', artistRecs.total, 'artists with metadata');

          // Add all similar artists to metadata for refresh functionality
          artistRecs.metadata = {
            ...artistRecs.metadata,
            allSimilarArtists: allSimilarArtists
          };
        }

        return artistRecs;
      } else {
        console.log('📊 No similarity data available, falling back to genre-based approach');
        // Fall back to the original approach as last resort
        const result = await recommendationService.generateRecommendations(albums, {
          includeExternal: true
        });

        if (result.success) {
          const rawExternalData = await recommendationService.fetchExternalData(profile, albums);
          return await buildArtistRecommendations(rawExternalData, albums);
        }
      }

      console.log('📊 Basic recommendation generation failed - no data available');
      return null;
    } catch (error) {
      console.error('Basic recommendation generation failed:', error);
      return null;
    }
  };

  const buildArtistRecommendations = async (externalDataResult, userAlbums) => {
    const userArtists = new Set(userAlbums.map(album => album.artist.toLowerCase()));
    const artistScores = new Map();

    // The externalData structure from generateRecommendations is different
    // We need to access the actual external data from the result
    const externalData = externalDataResult;

    // Process similar artists data to extract artist recommendations
    console.log('🔍 Building artist recommendations from external data...');
    console.log('🔍 ExternalData similarArtists count:', Object.keys(externalData?.similarArtists || {}).length);

    if (externalData?.similarArtists) {
      Object.values(externalData.similarArtists).forEach(artistData => {
        const sourceArtist = artistData.sourceArtist;

        artistData.similarArtists.forEach(similarArtist => {
          const artistName = similarArtist.name;
          const normalizedName = artistName.toLowerCase();

          // Skip if user already owns this artist
          if (userArtists.has(normalizedName)) {
            return;
          }

          // Calculate connection strength and reasons
          const connectionStrength = parseFloat(similarArtist.match) || 0;

          if (!artistScores.has(normalizedName)) {
            // Look up additional artist metadata if available
            const artistInfo = externalData?.artistInfo?.[artistName] || null;

            // Extract genres from artist info tags
            const genres = artistInfo?.tags ? artistInfo.tags.map(tag =>
              typeof tag === 'object' ? tag.name : tag
            ).filter(Boolean).slice(0, 3) : [];

            console.log(`🎨 Artist ${artistName} metadata:`, {
              hasInfo: !!artistInfo,
              tagCount: artistInfo?.tags?.length || 0,
              genreCount: genres.length,
              genres: genres
            });

            artistScores.set(normalizedName, {
              artist: artistName,
              totalScore: 0,
              connectionCount: 0,
              connections: [],
              maxSimilarity: 0,
              mbid: similarArtist.mbid,
              image: similarArtist.image,
              // Add artist metadata for diversity filtering - CRITICAL for diversity to work
              metadata: artistInfo ? {
                tags: artistInfo.tags || [],
                genres: genres,  // Already extracted and formatted
                playcount: artistInfo.playcount || 0,
                listeners: artistInfo.listeners || 0,
                bio: artistInfo.bio || null
              } : {
                // Even without artist info, provide empty structure
                tags: [],
                genres: [],
                playcount: 0,
                listeners: 0,
                bio: null
              }
            });
          }

          const artistScoreData = artistScores.get(normalizedName);
          artistScoreData.totalScore += connectionStrength;
          artistScoreData.connectionCount += 1;
          artistScoreData.connections.push({
            sourceArtist: sourceArtist,
            similarity: connectionStrength
          });
          artistScoreData.maxSimilarity = Math.max(artistScoreData.maxSimilarity, connectionStrength);
        });
      });
    }

    // Convert to array and calculate final scores
    const scoredArtists = Array.from(artistScores.values()).map(artist => {
      // Fixed score formula: reward total connections while maintaining quality threshold
      const avgSimilarity = artist.totalScore / artist.connectionCount;
      const breadthMultiplier = 1 + (artist.connectionCount - 1) * 0.3; // Strong breadth reward
      const qualityThreshold = avgSimilarity > 0.4 ? 1 : 0.7; // Slight penalty for very weak connections
      const maxSimBonus = artist.maxSimilarity * 0.15;

      // Use total score with breadth multiplier instead of averaging
      const finalScore = (artist.totalScore * breadthMultiplier * qualityThreshold) + maxSimBonus;

      return {
        ...artist,
        score: Math.round(finalScore * 100),
        avgSimilarity: Math.round(avgSimilarity * 100),
        reason: artist.connectionCount === 1
          ? `Similar to ${artist.connections[0].sourceArtist}`
          : `Connected to ${artist.connectionCount} artists in your collection`
      };
    });

    // Sort by score and keep top 50 for diversity filtering
    const sortedArtists = scoredArtists.sort((a, b) => b.score - a.score);
    const topCandidates = sortedArtists.slice(0, 50); // Keep 50 for diversity filtering

    return {
      total: topCandidates.length,
      artists: topCandidates, // Return all 50 for diversity filtering
      metadata: {
        generatedAt: new Date().toISOString(),
        totalCandidates: artistScores.size,
        averageConnections: topCandidates.length > 0
          ? Math.round(topCandidates.reduce((sum, a) => sum + a.connectionCount, 0) / topCandidates.length * 10) / 10
          : 0,
        fullCandidateCount: topCandidates.length
      }
    };
  };

  const handleRefresh = useCallback(async () => {
    if (recommendationService) {
      recommendationService.clearCache();

      // Also clear artist metadata cache in Supabase
      if (recommendationService.cacheService && user?.id) {
        console.log('🧹 Clearing artist metadata cache...');
        // Clear all artist metadata cache entries (they'll be refetched with fresh data)
        await recommendationService.cacheService.clearArtistMetadataCache();
      }

      // Reset the fingerprint to force regeneration
      lastGeneratedFingerprintRef.current = null;

      await generateArtistRecommendations(true);
    }
  }, [recommendationService, generateArtistRecommendations, user]);

  const handleMetadataRefreshComplete = useCallback(async () => {
    console.log('🔄 Metadata refresh complete, regenerating recommendations...');

    // Clear recommendation cache to force regeneration with new metadata
    if (recommendationService) {
      recommendationService.clearCache();
    }

    // Reset the fingerprint to force regeneration
    lastGeneratedFingerprintRef.current = null;

    // Regenerate recommendations with fresh metadata
    await generateArtistRecommendations(true);

    console.log('✅ Recommendations regenerated with fresh metadata');
  }, [recommendationService, generateArtistRecommendations]);

  // Pass actions to parent component
  useEffect(() => {
    if (onActionsReady) {
      onActionsReady({
        onRefresh: handleRefresh,
        onFixGenres: () => setShowMetadataRefreshModal(true),
        onGetImages: () => setShowSpotifyBackfillModal(true),
        loading,
        hasRecommendations: recommendations && recommendations.artists.length > 0
      });
    }
  }, [onActionsReady, handleRefresh, loading, recommendations]);

  // Generate per-genre recommendations after main recommendations complete
  useEffect(() => {
    if (!recommendations || !recommendationService || !albums || Object.keys(genreRecommendations).length > 0) {
      return;
    }

    const generateGenreRecommendations = async () => {
      console.log('🎨 Generating per-genre recommendations...');

      // Get distinct genres with minimal overlap
      const distinctGenres = getDistinctGenres(albums, 0.5, 10, 3);
      console.log(`✅ Selected ${distinctGenres.length} distinct genres for recommendations`);

      if (distinctGenres.length === 0) {
        console.log('⚠️ No distinct genres found');
        return;
      }

      const genreRecs = {};

      // Generate recommendations for each distinct genre
      for (const { genre, count, artists } of distinctGenres) {
        console.log(`📊 Generating recommendations for "${genre}" (${count} albums, ${artists.size} artists)...`);

        // Filter albums to only this genre
        const genreAlbums = albums.filter(album =>
          album.genre && Array.isArray(album.genre) &&
          album.genre.some(g => g.toLowerCase() === genre.toLowerCase())
        );

        if (genreAlbums.length < 3) {
          console.log(`⚠️ Skipping "${genre}" - only ${genreAlbums.length} albums`);
          continue;
        }

        try {
          // Generate recommendations using only albums from this genre
          const genreArtistRecs = await generateBasicRecommendations(genreAlbums);

          if (genreArtistRecs && genreArtistRecs.artists && genreArtistRecs.artists.length > 0) {
            // Take top 15 recommendations for this genre
            genreRecs[genre] = {
              artists: genreArtistRecs.artists.slice(0, 15),
              count: count // Album count in user's collection
            };
            console.log(`✅ Generated ${genreRecs[genre].artists.length} recommendations for "${genre}"`);
          }
        } catch (error) {
          console.error(`❌ Failed to generate recommendations for "${genre}":`, error);
        }
      }

      setGenreRecommendations(genreRecs);
      console.log(`✅ Per-genre recommendations complete: ${Object.keys(genreRecs).length} genres`);
    };

    generateGenreRecommendations();
  }, [recommendations, recommendationService, albums, genreRecommendations]);

  // Don't render if not enough albums
  if (!hasEnoughAlbums) {
    return (
      <div className="mb-6 bg-gray-900 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h3 className="text-lg font-semibold text-white">Check These Artists Out</h3>
        </div>
        <p className="text-gray-400 text-sm">
          Add at least 5 albums to your collection to discover new artists based on your music taste.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400 mb-6">
          <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
          <span className="text-sm">Analyzing your collection and finding artists you might like...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-red-400 text-sm mb-6">
          ⚠️ {error}
        </div>
      )}

      {/* Recommendations */}
      {recommendations && !loading && (
        <div>
          {/* Main Carousel: Based On Your Collection */}
          <ArtistCarousel
            title="Based On Your Collection"
            artists={recommendations.artists}
            showCount={false}
          />

          {/* Genre-Based Carousels */}
          {Object.entries(genreRecommendations).map(([genre, data]) => (
            <ArtistCarousel
              key={genre}
              title={genre}
              artists={data.artists}
              showCount={true}
              albumCount={data.count}
            />
          ))}

          {recommendations.total === 0 && (
            <div className="text-gray-400 text-sm text-center py-8">
              No artist recommendations available at this time. Try adding more albums to improve suggestions.
            </div>
          )}
        </div>
      )}

      {/* Artist Metadata Refresh Modal */}
      <ArtistMetadataRefreshModal
        isOpen={showMetadataRefreshModal}
        onClose={() => setShowMetadataRefreshModal(false)}
        artists={recommendations?.metadata?.allSimilarArtists || recommendations?.artists || []}
        cacheService={recommendationService?.cacheService}
        onRefreshComplete={handleMetadataRefreshComplete}
      />

      {/* Spotify Image Backfill Modal */}
      <SpotifyImageBackfillModal
        isOpen={showSpotifyBackfillModal}
        onClose={() => setShowSpotifyBackfillModal(false)}
        cacheService={recommendationService?.cacheService}
      />
    </div>
  );
};

export default ArtistRecommendationSection;