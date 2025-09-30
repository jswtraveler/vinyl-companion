import ArtistRecommendationSection from '../components/ArtistRecommendationSection';

/**
 * DiscoverPage Component
 *
 * Artist recommendations based on user's vinyl collection
 */
const DiscoverPage = ({ albums, user, useCloudDatabase }) => {
  return (
    <div className="pb-20">
      {/* Artist Recommendations Section */}
      {albums.length > 0 ? (
        <ArtistRecommendationSection
          albums={albums}
          user={user}
          useCloudDatabase={useCloudDatabase}
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
