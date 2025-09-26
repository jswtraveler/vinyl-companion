import { useState, useEffect, useMemo } from 'react';
import { RecommendationService } from '../services/recommendationService.js';

const RecommendationSection = ({ albums, user, useCloudDatabase }) => {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [recommendationService, setRecommendationService] = useState(null);

  // Initialize recommendation service
  useEffect(() => {
    try {
      const service = new RecommendationService({
        enableCaching: true,
        minCollectionSize: 5, // Require at least 5 albums for recommendations
        useListenBrainz: true, // Feature flag - set to true to test ListenBrainz
        listenBrainzFallbackToLastfm: true, // Graceful degradation
        listenBrainzToken: import.meta.env.VITE_LISTENBRAINZ_TOKEN // Add your token here
      });
      setRecommendationService(service);
    } catch (err) {
      console.error('Failed to initialize recommendation service:', err);
      setError('Recommendation service unavailable');
    }
  }, []);

  // Check if we have enough albums for recommendations
  const hasEnoughAlbums = useMemo(() => {
    return albums && albums.length >= 5;
  }, [albums]);

  // Generate recommendations when albums change
  useEffect(() => {
    if (!recommendationService || !hasEnoughAlbums || !albums) {
      return;
    }

    generateRecommendations();
  }, [recommendationService, albums, hasEnoughAlbums]);

  const generateRecommendations = async () => {
    if (!recommendationService || !albums || albums.length < 5) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🎵 Generating recommendations for collection...');
      const result = await recommendationService.generateRecommendations(albums, {
        includeExternal: true // Include Last.fm data if available
      });

      if (result.success) {
        setRecommendations(result);
        console.log('✅ Recommendations generated successfully');
      } else {
        setError(result.error || 'Failed to generate recommendations');
      }
    } catch (err) {
      console.error('❌ Failed to generate recommendations:', err);
      setError('Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (recommendationService) {
      recommendationService.clearCache();
      generateRecommendations();
    }
  };

  // Don't render if not enough albums
  if (!hasEnoughAlbums) {
    return (
      <div className="mb-6 bg-gray-900 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-semibold text-white">Album Recommendations</h3>
        </div>
        <p className="text-gray-400 text-sm">
          Add at least 5 albums to your collection to get personalized recommendations based on your music taste.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-gray-900 rounded-lg border border-gray-700">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Album Recommendations</h3>
            {recommendations && (
              <span className="text-sm text-gray-400">
                ({recommendations.recommendations.total} suggestions)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Refresh'}
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
            <span className="text-sm">Analyzing your collection and finding recommendations...</span>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        {recommendations && !loading && (
          <div className="space-y-4">
            {/* Profile Summary */}
            {expanded && recommendations.profile && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-white mb-2">Your Music Profile</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400">Top Genres:</span>
                    <div className="text-white mt-1">
                      {recommendations.profile.preferences.primaryGenres.slice(0, 3).join(', ') || 'Various'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Favorite Eras:</span>
                    <div className="text-white mt-1">
                      {recommendations.profile.preferences.primaryEras.slice(0, 2).map(era => `${era}s`).join(', ') || 'Various'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Collection Style:</span>
                    <div className="text-white mt-1">
                      {recommendations.profile.preferences.isEclectic ? 'Eclectic' : 'Focused'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendation Lists */}
            {Object.entries(recommendations.recommendations.lists).map(([listKey, listData]) => (
              <RecommendationList
                key={listKey}
                listData={listData}
                expanded={expanded}
              />
            ))}

            {recommendations.recommendations.total === 0 && (
              <div className="text-gray-400 text-sm text-center py-4">
                No recommendations available at this time. Try adding more albums to improve suggestions.
              </div>
            )}

            {/* Metadata */}
            {expanded && recommendations.metadata && (
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                Generated in {recommendations.metadata.duration}ms •
                {recommendations.metadata.scoringEngine && (
                  <> {recommendations.metadata.scoringEngine} scoring • </>
                )}
                {recommendations.externalData && (
                  <> {recommendations.externalData.candidateCount} candidates • </>
                )}
                {new Date(recommendations.metadata.generatedAt).toLocaleTimeString()}
                {recommendations.metadata.version && (
                  <> • v{recommendations.metadata.version}</>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RecommendationList = ({ listData, expanded }) => {
  const [showAll, setShowAll] = useState(false);

  const displayItems = showAll ? listData.items : listData.items.slice(0, 3);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-white">{listData.title}</h4>
        {listData.count > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-gray-400 hover:text-white"
          >
            {showAll ? 'Show Less' : `Show All (${listData.count})`}
          </button>
        )}
      </div>

      {listData.description && (
        <p className="text-sm text-gray-400 mb-3">{listData.description}</p>
      )}

      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <RecommendationItem
            key={`${item.artist}-${item.title}-${item.type}-${index}`}
            item={item}
            expanded={expanded}
          />
        ))}
      </div>
    </div>
  );
};

const RecommendationItem = ({ item, expanded }) => {
  return (
    <div className="flex items-center gap-3 p-2 bg-gray-750 rounded hover:bg-gray-700 transition-colors">
      {/* Album Art */}
      {item.image && (
        <div className="w-10 h-10 bg-gray-600 rounded flex-shrink-0 overflow-hidden">
          <img
            src={item.image}
            alt={`${item.artist} - ${item.title}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Album Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {item.title || `Explore ${item.artist}`}
        </div>
        <div className="text-xs text-gray-400 truncate">
          {item.artist}
        </div>
        {expanded && item.reason && (
          <div className="text-xs text-gray-500 mt-1">
            {item.reason}
          </div>
        )}
        {expanded && item.reasons && item.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.reasons.slice(0, 2).map((reason, index) => (
              <span
                key={index}
                className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-300 rounded"
                title={`${reason.reason} (${Math.round(reason.strength * 100)}%)`}
              >
                {reason.reason}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Metadata and Scores */}
      <div className="flex-shrink-0 text-right">
        {item.score && (
          <div className="text-xs font-medium text-blue-400">
            {item.score}% match
          </div>
        )}
        {expanded && item.confidence && (
          <div className="text-xs text-gray-500">
            {item.confidence}% confidence
          </div>
        )}
        {item.similarity && !item.score && (
          <div className="text-xs text-gray-400">
            {Math.round(item.similarity * 100)}% similar
          </div>
        )}
        {item.popularity && (
          <div className="text-xs text-gray-400">
            {item.popularity.toLocaleString()} plays
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationSection;