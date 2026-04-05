import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RecommendationService } from '../services/recommendations/index.js';
import { GraphRecommendationService } from '../services/recommendations/algorithms/GraphRecommender.js';
import { applyDiversityFilter, getDiversityStats } from '../utils/diversityFilter.js';
import { getDistinctGenres } from '../utils/genreUtils.js';
import {
  generateBasicRecommendations,
  mergeMetadataIntoArtists,
} from '../services/recommendations/basicRecommendations.js';

/**
 * Apply diversity filter and slice to top 20. Returns { artists, diversityStats }.
 */
function applyDiversityToArtists(artists, diversityEnabled) {
  let final = [...artists];
  let diversityStats = null;
  if (diversityEnabled && final.length > 0) {
    final = applyDiversityFilter(final, {
      maxSameGenre: 3,
      maxSameDecade: 4,
      diversityWeight: 0.3,
      genreDistributionTarget: 0.4
    });
    final = final.slice(0, 20);
    diversityStats = getDiversityStats(final);
  } else {
    final = final.slice(0, 20);
  }
  return { artists: final, diversityStats };
}

/**
 * Manages all recommendation state and logic for the Discover tab.
 *
 * @param {Array} albums - User's collection
 * @param {Object|null} user - Supabase user object
 * @param {boolean} useCloudDatabase
 * @param {Function|null} onActionsReady - Callback to expose refresh/fix actions to parent
 */
export function useRecommendations({ albums, user, useCloudDatabase, onActionsReady }) {
  const [recommendations, setRecommendations] = useState(null);
  const [genreRecommendations, setGenreRecommendations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recommendationService, setRecommendationService] = useState(null);
  const [graphService, setGraphService] = useState(null);
  const [useGraphAlgorithm] = useState(false); // Temporarily disabled for local dev
  const [diversityEnabled, setDiversityEnabled] = useState(true);
  const [showMetadataRefreshModal, setShowMetadataRefreshModal] = useState(false);
  const [showSpotifyBackfillModal, setShowSpotifyBackfillModal] = useState(false);
  const isGeneratingRef = useRef(false);
  const lastGeneratedFingerprintRef = useRef(null);

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

      const graphRecommendationService = new GraphRecommendationService({
        maxIterations: 20,
        dampingFactor: 0.85,
        convergenceThreshold: 0.0001,
        minSimilarityThreshold: 0.3,
        maxRecommendations: 50,
        enableLogging: true
      });
      setGraphService(graphRecommendationService);
    } catch (err) {
      console.error('Failed to initialize recommendation services:', err);
      setError('Recommendation services unavailable');
    }
  }, [user, useCloudDatabase]);

  const hasEnoughAlbums = useMemo(() => albums && albums.length >= 5, [albums]);

  const generateArtistRecommendations = useCallback(async (forceRefresh = false) => {
    if (isGeneratingRef.current) {
      console.log('🚫 Skipping duplicate recommendation generation call');
      return;
    }
    if (!recommendationService || !albums || albums.length < 5) return;

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
      const cacheService = recommendationService.cacheService;
      const userId = recommendationService.config.userId;

      console.log(`🔧 Debug: Albums count: ${albums.length}, User ID: ${userId}, Graph enabled: ${useGraphAlgorithm}`);
      let artistRecommendations = null;
      let fromCache = false;

      if (cacheService && userId) {
        const collectionFingerprint = cacheService.generateCollectionFingerprint(albums);
        const algorithmSuffix = useGraphAlgorithm ? '_graph' : '_basic';
        const cacheKey = `artist_recs_${collectionFingerprint}${algorithmSuffix}`;
        const cachedArtistRecs = await cacheService.getUserRecommendationsCache(userId, cacheKey);
        if (cachedArtistRecs && cachedArtistRecs.recommendations?.artists) {
          artistRecommendations = cachedArtistRecs.recommendations;
          fromCache = true;
          console.log(`✅ Using cached ${useGraphAlgorithm ? 'graph' : 'basic'} artist recommendations`);
        }
      }

      if (!artistRecommendations) {
        if (useGraphAlgorithm && graphService) {
          console.log('🕸️ Using graph-based algorithm for artist recommendations...');
          const graphResult = await graphService.generateGraphRecommendations(userId, albums, {
            maxIterations: 20,
            dampingFactor: 0.85,
            minSimilarityThreshold: 0.3
          });

          if (graphResult.success) {
            console.log('🎯 PPR algorithm succeeded, now fetching metadata for recommendations...');
            const allPPRCandidates = graphResult.recommendations.map(a => ({
              artist: a.artist,
              mbid: a.mbid || null
            }));
            console.log(`📊 Extracted ${allPPRCandidates.length} PPR candidates for metadata refresh`);

            const topCandidates = graphResult.recommendations.slice(0, 50);
            const artistNamesForPPRMetadata = [...new Set(topCandidates.map(a => a.artist))];

            console.time('🚀 Batch fetch PPR metadata');
            const artistMetadata = await recommendationService.cacheService.getBatchArtistMetadataCache(artistNamesForPPRMetadata);
            console.timeEnd('🚀 Batch fetch PPR metadata');
            console.log('📊 PPR metadata complete:', Object.keys(artistMetadata).length, 'artists');

            const artistsWithMetadata = mergeMetadataIntoArtists(graphResult.recommendations, artistMetadata);
            artistRecommendations = {
              artists: artistsWithMetadata,
              total: artistsWithMetadata.length,
              metadata: {
                ...graphResult.metadata,
                algorithm: 'personalized_pagerank',
                generatedAt: new Date().toISOString(),
                fullCandidateCount: artistsWithMetadata.length,
                allSimilarArtists: allPPRCandidates
              }
            };
            console.log(`✅ PPR recommendations with metadata ready (${artistsWithMetadata.length} candidates for filtering)`);
          } else {
            console.warn('Graph algorithm failed, falling back to basic algorithm');
            console.log('🔧 Graph failure reason:', graphResult.error);
            artistRecommendations = await generateBasicRecommendations(recommendationService, albums);
          }
        } else {
          console.log('📊 Using basic similarity algorithm for artist recommendations...');
          artistRecommendations = await generateBasicRecommendations(recommendationService, albums);
        }

        if (cacheService && userId && artistRecommendations && artistRecommendations.total > 0) {
          const collectionFingerprint = cacheService.generateCollectionFingerprint(albums);
          const algorithmSuffix = useGraphAlgorithm ? '_graph' : '_basic';
          const cacheKey = `artist_recs_${collectionFingerprint}${algorithmSuffix}`;
          await cacheService.setUserRecommendationsCache(userId, cacheKey, {
            artists: artistRecommendations.artists,
            total: artistRecommendations.total,
            metadata: {
              ...artistRecommendations.metadata,
              originalArtists: artistRecommendations.artists
            }
          });
        }
      }

      if (artistRecommendations && artistRecommendations.total > 0) {
        const originalArtists = artistRecommendations.metadata?.originalArtists || artistRecommendations.artists;
        console.log(diversityEnabled
          ? `🎯 Applying diversity filter to ${originalArtists.length} artist recommendations...`
          : `🎯 Diversity filter disabled - showing top 20 of ${originalArtists.length} recommendations`
        );
        const { artists: finalArtists, diversityStats } = applyDiversityToArtists(originalArtists, diversityEnabled);
        if (diversityStats) console.log('🎯 Diversity stats:', diversityStats);

        setRecommendations({
          ...artistRecommendations,
          artists: finalArtists,
          total: finalArtists.length,
          metadata: {
            ...artistRecommendations.metadata,
            cached: fromCache,
            diversityEnabled,
            diversityStats,
            originalArtists
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

  // Trigger recommendations when services and albums are ready
  useEffect(() => {
    if (!recommendationService || !graphService || !hasEnoughAlbums || !albums) return;
    if (!recommendations || recommendations.total === 0) {
      generateArtistRecommendations();
    }
  }, [recommendationService, graphService, hasEnoughAlbums, albums?.length, useGraphAlgorithm]);

  // Handle algorithm switching — load from cache or regenerate
  useEffect(() => {
    if (!recommendations || !recommendationService?.cacheService || !user?.id) return;

    const loadOrGenerateForAlgorithm = async () => {
      const cacheService = recommendationService.cacheService;
      const userId = user.id;
      const collectionFingerprint = cacheService.generateCollectionFingerprint(albums);
      const algorithmSuffix = useGraphAlgorithm ? '_graph' : '_basic';
      const cacheKey = `artist_recs_${collectionFingerprint}${algorithmSuffix}`;

      const cachedArtistRecs = await cacheService.getUserRecommendationsCache(userId, cacheKey);
      if (cachedArtistRecs && cachedArtistRecs.recommendations?.artists) {
        console.log(`✅ Switching to cached ${useGraphAlgorithm ? 'graph' : 'basic'} recommendations`);
        const originalArtists = cachedArtistRecs.recommendations.metadata?.originalArtists || cachedArtistRecs.recommendations.artists;
        const { artists: finalArtists, diversityStats } = applyDiversityToArtists(originalArtists, diversityEnabled);
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
        lastGeneratedFingerprintRef.current = null;
        await generateArtistRecommendations();
      }
    };

    loadOrGenerateForAlgorithm();
  }, [useGraphAlgorithm]);

  // Reapply diversity filter when toggle changes
  useEffect(() => {
    if (!recommendations || !recommendations.artists || recommendations.artists.length === 0) return;

    console.log(`🎯 Reapplying diversity filter (enabled: ${diversityEnabled}) to existing recommendations`);
    const originalArtists = recommendations.metadata?.originalArtists || recommendations.artists;
    const { artists: finalArtists, diversityStats } = applyDiversityToArtists(originalArtists, diversityEnabled);
    if (diversityStats) console.log('🎯 Diversity stats:', diversityStats);

    setRecommendations(prev => ({
      ...prev,
      artists: finalArtists,
      total: finalArtists.length,
      metadata: {
        ...prev.metadata,
        diversityEnabled,
        diversityStats,
        originalArtists: prev.metadata?.originalArtists || prev.artists
      }
    }));
  }, [diversityEnabled]);

  // Generate per-genre recommendations after main recommendations complete
  useEffect(() => {
    if (!recommendations || !recommendationService || !albums || Object.keys(genreRecommendations).length > 0) return;

    const generateGenreRecommendations = async () => {
      console.log('🎨 Generating per-genre recommendations...');
      const distinctGenres = getDistinctGenres(albums, 0.5, 10, 3);
      console.log(`✅ Selected ${distinctGenres.length} distinct genres for recommendations`);
      if (distinctGenres.length === 0) return;

      const genreRecs = {};
      for (const { genre, count, artists } of distinctGenres) {
        console.log(`📊 Generating recommendations for "${genre}" (${count} albums, ${artists.size} artists)...`);
        const genreAlbums = albums.filter(album =>
          album.genre && Array.isArray(album.genre) &&
          album.genre.some(g => g.toLowerCase() === genre.toLowerCase())
        );
        if (genreAlbums.length < 3) {
          console.log(`⚠️ Skipping "${genre}" - only ${genreAlbums.length} albums`);
          continue;
        }
        try {
          const genreArtistRecs = await generateBasicRecommendations(recommendationService, genreAlbums);
          if (genreArtistRecs && genreArtistRecs.artists && genreArtistRecs.artists.length > 0) {
            genreRecs[genre] = {
              artists: genreArtistRecs.artists.slice(0, 15),
              count
            };
            console.log(`✅ Generated ${genreRecs[genre].artists.length} recommendations for "${genre}"`);
          }
        } catch (err) {
          console.error(`❌ Failed to generate recommendations for "${genre}":`, err);
        }
      }

      setGenreRecommendations(genreRecs);
      console.log(`✅ Per-genre recommendations complete: ${Object.keys(genreRecs).length} genres`);
    };

    generateGenreRecommendations();
  }, [recommendations, recommendationService, albums, genreRecommendations]);

  const handleRefresh = useCallback(async () => {
    if (!recommendationService) return;
    recommendationService.clearCache();
    if (recommendationService.cacheService && user?.id) {
      console.log('🧹 Clearing artist metadata cache...');
      await recommendationService.cacheService.clearArtistMetadataCache();
    }
    lastGeneratedFingerprintRef.current = null;
    await generateArtistRecommendations(true);
  }, [recommendationService, generateArtistRecommendations, user]);

  const handleMetadataRefreshComplete = useCallback(async () => {
    console.log('🔄 Metadata refresh complete, regenerating recommendations...');
    if (recommendationService) recommendationService.clearCache();
    lastGeneratedFingerprintRef.current = null;
    await generateArtistRecommendations(true);
    console.log('✅ Recommendations regenerated with fresh metadata');
  }, [recommendationService, generateArtistRecommendations]);

  // Expose actions to parent
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

  return {
    recommendations,
    genreRecommendations,
    loading,
    error,
    hasEnoughAlbums,
    recommendationService,
    diversityEnabled,
    setDiversityEnabled,
    handleRefresh,
    handleMetadataRefreshComplete,
    showMetadataRefreshModal,
    setShowMetadataRefreshModal,
    showSpotifyBackfillModal,
    setShowSpotifyBackfillModal,
  };
}
