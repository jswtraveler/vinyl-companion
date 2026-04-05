import { useRecommendations } from '../hooks/useRecommendations.js';
import ArtistMetadataRefreshModal from './ArtistMetadataRefreshModal.jsx';
import SpotifyImageBackfillModal from './SpotifyImageBackfillModal.jsx';
import ArtistCarousel from './ArtistCarousel.jsx';

const ArtistRecommendationSection = ({ albums, user, useCloudDatabase, onActionsReady }) => {
  const {
    recommendations,
    genreRecommendations,
    loading,
    error,
    hasEnoughAlbums,
    recommendationService,
    showMetadataRefreshModal,
    setShowMetadataRefreshModal,
    showSpotifyBackfillModal,
    setShowSpotifyBackfillModal,
    handleMetadataRefreshComplete,
  } = useRecommendations({ albums, user, useCloudDatabase, onActionsReady });

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
      {loading && (
        <div className="flex items-center gap-3 text-gray-400 mb-6">
          <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
          <span className="text-sm">Analyzing your collection and finding artists you might like...</span>
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm mb-6">
          ⚠️ {error}
        </div>
      )}

      {recommendations && !loading && (
        <div>
          <ArtistCarousel
            title="Based On Your Collection"
            artists={recommendations.artists}
            showCount={false}
          />

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

      <ArtistMetadataRefreshModal
        isOpen={showMetadataRefreshModal}
        onClose={() => setShowMetadataRefreshModal(false)}
        artists={recommendations?.metadata?.allSimilarArtists || recommendations?.artists || []}
        cacheService={recommendationService?.cacheService}
        onRefreshComplete={handleMetadataRefreshComplete}
      />

      <SpotifyImageBackfillModal
        isOpen={showSpotifyBackfillModal}
        onClose={() => setShowSpotifyBackfillModal(false)}
        cacheService={recommendationService?.cacheService}
      />
    </div>
  );
};

export default ArtistRecommendationSection;
