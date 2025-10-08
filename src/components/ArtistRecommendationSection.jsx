import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RecommendationService } from '../services/recommendationService.js';
import { GraphRecommendationService } from '../services/graphRecommendationService.js';
import { applyDiversityFilter, getDiversityStats } from '../utils/diversityFilter.js';

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
        metadata: {
          tags: metadata.tags || [],
          genres: genres,
          playcount: metadata.playcount || 0,
          listeners: metadata.listeners || 0,
          bio: metadata.bio || null
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

const ArtistRecommendationSection = ({ albums, user, useCloudDatabase }) => {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [recommendationService, setRecommendationService] = useState(null);
  const [graphService, setGraphService] = useState(null);
  const [useGraphAlgorithm, setUseGraphAlgorithm] = useState(false); // Temporarily disabled for local dev
  const isGeneratingRef = useRef(false); // Prevent duplicate calls
  const [diversityEnabled, setDiversityEnabled] = useState(true); // Enable diversity filtering by default
  const lastGeneratedFingerprintRef = useRef(null); // Track last collection fingerprint

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
  const generateArtistRecommendations = useCallback(async () => {
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
    if (cacheService) {
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

            // TWO-PASS: Fetch metadata for top 50 PPR recommendations (more data for diversity filtering)
            const topCandidates = graphResult.recommendations.slice(0, 50);
            const artistsToFetch = topCandidates.map(a => ({
              name: a.artist,
              mbid: a.mbid || null
            }));

            // Fetch metadata using the data fetcher
            const dataFetcher = recommendationService.dataFetcher;
            const artistMetadata = await dataFetcher.fetchMetadataForArtists(artistsToFetch, {
              maxConcurrent: 50,
              onProgress: (processed, total) => {
                console.log(`🎯 PPR metadata progress: ${processed}/${total}`);
              }
            });

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
                fullCandidateCount: artistsWithMetadata.length
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
  }, [recommendationService, graphService, albums]); // Removed useGraphAlgorithm - handled separately

  // Effect to trigger recommendations when dependencies change
  useEffect(() => {
    if (!recommendationService || !graphService || !hasEnoughAlbums || !albums) {
      return;
    }

    generateArtistRecommendations();
  }, [generateArtistRecommendations, hasEnoughAlbums]);

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

      // Fetch similarity data specifically for artist recommendations
      const dataFetcher = recommendationService.dataFetcher;
      console.log('📊 Fetching artist similarity data...');

      // Profile.artists is already in correct format: [{artist: "name", count: number}, ...]
      console.log('📊 Artists to fetch (sample):', profile.artists?.slice(0, 3));

      // Pass the full artist objects (not just names) to fetchSimilarArtistsData
      await dataFetcher.fetchSimilarArtistsData(profile.artists || []);
      console.log('📊 Similarity data fetched:', Object.keys(dataFetcher.results.similarArtists || {}));

      const externalData = dataFetcher.results;

      if (externalData && Object.keys(externalData.similarArtists || {}).length > 0) {
        // TWO-PASS APPROACH: Score first, then fetch metadata for top candidates
        console.log('🎯 Pass 1: Building artist recommendations WITHOUT metadata (fast)...');

        // Build recommendations without metadata first
        const artistRecs = await buildArtistRecommendations(externalData, albums);
        console.log('📊 Pass 1 complete:', artistRecs?.total || 0, 'artists scored');

        if (artistRecs && artistRecs.artists && artistRecs.artists.length > 0) {
          // TWO-PASS: Now fetch metadata for top 50 candidates (for diversity filtering)
          console.log('🎯 Pass 2: Fetching metadata for top 50 candidates...');

          const topCandidates = artistRecs.artists.slice(0, 50);
          const artistsToFetch = topCandidates.map(a => ({
            name: a.artist,
            mbid: a.mbid || null
          }));

          // Fetch metadata for these specific artists
          const artistMetadata = await dataFetcher.fetchMetadataForArtists(artistsToFetch, {
            maxConcurrent: 50,
            onProgress: (processed, total) => {
              console.log(`🎯 Metadata progress: ${processed}/${total}`);
            }
          });

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

      generateArtistRecommendations();
    }
  }, [recommendationService, generateArtistRecommendations, user]);

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
    <div className="mb-6 bg-gray-900 rounded-lg border border-gray-700">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newAlgorithm = !useGraphAlgorithm;
                setUseGraphAlgorithm(newAlgorithm);
                console.log(`🔄 Switching to ${newAlgorithm ? 'PPR' : 'Basic'} algorithm`);
              }}
              disabled={loading}
              className={`px-3 py-1 text-xs rounded border ${
                useGraphAlgorithm
                  ? 'bg-purple-700 border-purple-600 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300'
              } hover:bg-opacity-80 disabled:opacity-50`}
              title={`Switch to ${useGraphAlgorithm ? 'Basic' : 'PPR'} algorithm`}
            >
              {useGraphAlgorithm ? 'PPR' : 'Basic'}
            </button>
            <button
              onClick={() => {
                const newDiversity = !diversityEnabled;
                setDiversityEnabled(newDiversity);
                console.log(`🎯 ${newDiversity ? 'Enabling' : 'Disabling'} diversity filtering`);

                // No need to regenerate - the useEffect will handle it
              }}
              disabled={loading}
              className={`px-3 py-1 text-xs rounded border ${
                diversityEnabled
                  ? 'bg-green-700 border-green-600 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300'
              } hover:bg-opacity-80 disabled:opacity-50`}
              title={`${diversityEnabled ? 'Disable' : 'Enable'} diversity filtering`}
            >
              {diversityEnabled ? 'Diverse' : 'All'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 disabled:opacity-50"
            >
              {loading ? 'Finding...' : 'Refresh'}
            </button>
            {recommendations && (
              <span className="text-sm text-gray-400 ml-2">
                {recommendations.total} suggestions
              </span>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-white"
          >
            <svg
              className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
            <span className="text-sm">Analyzing your collection and finding artists you might like...</span>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        {recommendations && !loading && (
          <div className="space-y-4">
            {/* Artist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.artists.slice(0, expanded ? 20 : 6).map((artist, index) => (
                <ArtistRecommendationCard
                  key={`${artist.artist}-${index}`}
                  artist={artist}
                  expanded={expanded}
                />
              ))}
            </div>

            {recommendations.total === 0 && (
              <div className="text-gray-400 text-sm text-center py-4">
                No artist recommendations available at this time. Try adding more albums to improve suggestions.
              </div>
            )}

            {/* Show More Button */}
            {recommendations.total > 6 && !expanded && (
              <div className="text-center">
                <button
                  onClick={() => setExpanded(true)}
                  className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600"
                >
                  Show All {recommendations.total} Artists
                </button>
              </div>
            )}

            {/* Metadata */}
            {expanded && recommendations.metadata && (
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                {recommendations.metadata.algorithm === 'personalized_pagerank' ? (
                  <>
                    🎯 PageRank • {recommendations.metadata.seedArtists} restart nodes •
                    α={recommendations.metadata.dampingFactor} •
                    {recommendations.metadata.totalCandidates} candidates •
                    Avg degree: {recommendations.metadata.averageDegree || 'N/A'} •
                    {recommendations.metadata.duration}ms •
                    {recommendations.metadata.cached ? 'Cached' : 'Fresh'} data
                  </>
                ) : (
                  <>
                    📊 Basic algorithm • Found {recommendations.metadata.totalCandidates} artist candidates •
                    Average {recommendations.metadata.averageConnections} connections per artist •
                    {recommendations.metadata.cached ? 'Cached' : 'Fresh'} data •
                    Generated at {new Date(recommendations.metadata.generatedAt).toLocaleTimeString()}
                  </>
                )}
                {recommendations.metadata.diversityEnabled && recommendations.metadata.diversityStats && (
                  <div className="text-xs text-green-400 mt-1">
                    🎯 Diversity: {Object.keys(recommendations.metadata.diversityStats.genreDistribution).length} genres •
                    Max genre: {Math.round(recommendations.metadata.diversityStats.maxGenrePercentage * 100)}% •
                    Diversity score: {recommendations.metadata.diversityStats.diversityScore.toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ArtistRecommendationCard = ({ artist, expanded }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
      {/* Artist Info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-gray-600 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
          {artist.image && artist.image !== '' ? (
            <img
              src={artist.image}
              alt={artist.artist}
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                e.target.style.display = 'none';
                // Show fallback icon
                e.target.parentElement.innerHTML = `
                  <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                `;
              }}
            />
          ) : (
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {artist.artist}
          </div>
          <div className="text-xs text-purple-400 font-medium">
            {artist.score}% match
          </div>
        </div>
      </div>

      {/* Connection Reason */}
      <div className="text-xs text-gray-400 mb-3">
        {artist.reason}
      </div>

      {/* Connection Details (when expanded) */}
      {expanded && artist.connections && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500 font-medium">Connected via:</div>
          {artist.connections.slice(0, 3).map((connection, index) => (
            <div key={index} className="text-xs text-gray-400 flex justify-between">
              <span className="truncate">{connection.sourceArtist}</span>
              <span className="text-gray-500">{Math.round(connection.similarity * 100)}%</span>
            </div>
          ))}
          {artist.connections.length > 3 && (
            <div className="text-xs text-gray-500">
              +{artist.connections.length - 3} more connections
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtistRecommendationSection;