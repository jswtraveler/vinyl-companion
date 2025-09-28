import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RecommendationService } from '../services/recommendationService.js';
import { GraphRecommendationService } from '../services/graphRecommendationService.js';

const ArtistRecommendationSection = ({ albums, user, useCloudDatabase }) => {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [recommendationService, setRecommendationService] = useState(null);
  const [graphService, setGraphService] = useState(null);
  const [useGraphAlgorithm, setUseGraphAlgorithm] = useState(false); // Temporarily disabled for local dev
  const isGeneratingRef = useRef(false); // Prevent duplicate calls

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

      // Initialize graph recommendation service
      const graphRecommendationService = new GraphRecommendationService({
        maxWalkDepth: 3,
        restartProbability: 0.15,
        minSimilarityThreshold: 0.3,
        maxRecommendations: 20,
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

          // Use graph algorithm for enhanced discovery
          const graphResult = await graphService.generateGraphRecommendations(userId, albums, {
            maxWalkDepth: 3,
            restartProbability: 0.15,
            minSimilarityThreshold: 0.3
          });

          if (graphResult.success) {
            artistRecommendations = {
              artists: graphResult.recommendations,
              total: graphResult.recommendations.length,
              metadata: {
                ...graphResult.metadata,
                algorithm: 'graph_random_walk',
                generatedAt: new Date().toISOString()
              }
            };
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
            metadata: artistRecommendations.metadata
          });
        }
      }

      if (artistRecommendations && artistRecommendations.total > 0) {
        setRecommendations({
          ...artistRecommendations,
          metadata: {
            ...artistRecommendations.metadata,
            cached: fromCache
          }
        });
        console.log('✅ Artist recommendations ready');
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

    generateArtistRecommendations();
  }, [generateArtistRecommendations, hasEnoughAlbums]);

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

      // Extract artist names from profile (it's an array of objects with artist and count)
      const artistNames = profile.artists?.map(a => a.artist || a.name || a) || [];
      console.log('📊 Artist names to fetch:', artistNames.slice(0, 3));

      // Ensure we fetch similar artists data
      const externalData = await dataFetcher.fetchSimilarArtistsData(artistNames);
      console.log('📊 Similarity data fetched:', Object.keys(externalData || {}));

      if (externalData && Object.keys(externalData).length > 0) {
        console.log('📊 Building artist recommendations from similarity data...');

        // Create the data structure expected by buildArtistRecommendations
        const formattedData = {
          similarArtists: externalData,
          metadata: {
            source: 'basic_similarity_fetch',
            timestamp: Date.now()
          }
        };

        const artistRecs = await buildArtistRecommendations(formattedData, albums);
        console.log('📊 Built recommendations:', artistRecs?.total || 0, 'artists');
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
            artistScores.set(normalizedName, {
              artist: artistName,
              totalScore: 0,
              connectionCount: 0,
              connections: [],
              maxSimilarity: 0,
              mbid: similarArtist.mbid,
              image: similarArtist.image
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

    // Sort by score and take top recommendations
    const topArtists = scoredArtists
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return {
      total: topArtists.length,
      artists: topArtists,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalCandidates: artistScores.size,
        averageConnections: topArtists.length > 0
          ? Math.round(topArtists.reduce((sum, a) => sum + a.connectionCount, 0) / topArtists.length * 10) / 10
          : 0
      }
    };
  };

  const handleRefresh = useCallback(() => {
    if (recommendationService) {
      recommendationService.clearCache();
      generateArtistRecommendations();
    }
  }, [recommendationService, generateArtistRecommendations]);

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
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Check These Artists Out</h3>
            {recommendations && (
              <span className="text-sm text-gray-400">
                ({recommendations.total} suggestions)
              </span>
            )}
            {recommendations?.metadata?.algorithm && (
              <span className="text-xs text-purple-300 bg-purple-900/30 px-2 py-1 rounded">
                {recommendations.metadata.algorithm === 'graph_random_walk' ? '🕸️ Graph' : '📊 Basic'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newAlgorithm = !useGraphAlgorithm;
                setUseGraphAlgorithm(newAlgorithm);
                console.log(`🔄 Switching to ${newAlgorithm ? 'Graph' : 'Basic'} algorithm`);
              }}
              disabled={loading}
              className={`px-3 py-1 text-xs rounded border ${
                useGraphAlgorithm
                  ? 'bg-purple-700 border-purple-600 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300'
              } hover:bg-opacity-80 disabled:opacity-50`}
              title={`Switch to ${useGraphAlgorithm ? 'Basic' : 'Graph'} algorithm`}
            >
              {useGraphAlgorithm ? '🕸️ Graph' : '📊 Basic'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 disabled:opacity-50"
            >
              {loading ? 'Finding...' : 'Refresh'}
            </button>
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
                {recommendations.metadata.algorithm === 'graph_random_walk' ? (
                  <>
                    🕸️ Graph algorithm • {recommendations.metadata.seedArtists} seed artists •
                    Walk depth: {recommendations.metadata.walkDepth} •
                    Found {recommendations.metadata.totalCandidates} candidates •
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