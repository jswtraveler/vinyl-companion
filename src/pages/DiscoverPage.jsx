import { useState, useRef, useEffect } from 'react';
import ArtistRecommendationSection from '../components/ArtistRecommendationSection';

/**
 * DiscoverPage Component
 *
 * Artist recommendations based on user's vinyl collection
 */
const DiscoverPage = ({ albums, user, useCloudDatabase }) => {
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);
  const [recommendationActions, setRecommendationActions] = useState(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionsMenu]);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Discover</h2>

        {albums.length >= 5 && recommendationActions && (
          <div className="relative" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg border border-gray-600 transition-colors"
              title="Actions"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showActionsMenu && (
              <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 min-w-[180px]">
                <button
                  onClick={() => {
                    recommendationActions.onRefresh();
                    setShowActionsMenu(false);
                  }}
                  disabled={recommendationActions.loading}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 rounded-t-lg"
                >
                  🔄 Refresh Recommendations
                </button>
                <button
                  onClick={() => {
                    recommendationActions.onFixGenres();
                    setShowActionsMenu(false);
                  }}
                  disabled={recommendationActions.loading || !recommendationActions.hasRecommendations}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  🏷️ Fix Genres
                </button>
                <button
                  onClick={() => {
                    recommendationActions.onGetImages();
                    setShowActionsMenu(false);
                  }}
                  disabled={recommendationActions.loading}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 rounded-b-lg"
                >
                  🖼️ Get Images
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Artist Recommendations Section */}
      {albums.length > 0 ? (
        <ArtistRecommendationSection
          albums={albums}
          user={user}
          useCloudDatabase={useCloudDatabase}
          onActionsReady={setRecommendationActions}
        />
      ) : (
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No Recommendations Yet</h3>
          <p className="text-gray-400">
            Add at least 5 albums to your collection to discover new artists based on your taste.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
