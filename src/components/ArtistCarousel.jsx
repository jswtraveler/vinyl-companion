import { useRef } from 'react';

/**
 * ArtistCarousel Component
 * Horizontal scrolling carousel for artist recommendations
 */
const ArtistCarousel = ({ title, artists, showCount = false, albumCount = null }) => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!artists || artists.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          {title}
          {showCount && albumCount !== null && (
            <span className="text-sm text-gray-400 ml-2">({albumCount} albums)</span>
          )}
        </h3>
        {artists.length > 3 && (
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded border border-gray-600 transition-colors"
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded border border-gray-600 transition-colors"
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Carousel Container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {artists.map((artist, index) => (
          <ArtistCard key={`${artist.artist}-${index}`} artist={artist} />
        ))}
      </div>
    </div>
  );
};

/**
 * ArtistCard Component
 * Individual artist card for carousel
 */
const ArtistCard = ({ artist }) => {
  return (
    <div className="flex-shrink-0 w-48 bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
      {/* Artist Image */}
      <div className="w-full aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {artist.image && artist.image !== '' ? (
          <img
            src={artist.image}
            alt={artist.artist}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = `
                <svg class="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              `;
            }}
          />
        ) : (
          <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </div>

      {/* Artist Info */}
      <div className="mb-2">
        <h4 className="text-sm font-medium text-white truncate" title={artist.artist}>
          {artist.artist}
        </h4>
        <p className="text-xs text-purple-400 font-medium">
          {artist.score}% match
        </p>
      </div>

      {/* Connection Info */}
      {artist.connections && artist.connections.length > 0 && (
        <div className="text-xs text-gray-400">
          <p className="truncate" title={artist.connections.map(c => c.sourceArtist).join(', ')}>
            {artist.connectionCount === 1
              ? `Similar to ${artist.connections[0].sourceArtist}`
              : `${artist.connectionCount} connections`}
          </p>
        </div>
      )}
    </div>
  );
};

export default ArtistCarousel;
