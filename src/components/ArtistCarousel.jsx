import { useRef, useState, useEffect } from 'react';
import { ListenBrainzClient } from '../services/api/music/ListenBrainzClient.js';

/**
 * ArtistCarousel Component
 * Horizontal scrolling carousel for artist recommendations
 */
const ArtistCarousel = ({ title, artists, showCount = false, albumCount = null }) => {
  const scrollRef = useRef(null);
  const [listenBrainzClient] = useState(() => new ListenBrainzClient());

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
          <ArtistCard
            key={`${artist.artist}-${index}`}
            artist={artist}
            listenBrainzClient={listenBrainzClient}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * ArtistCard Component
 * Individual artist card for carousel with expandable top albums
 */
const ArtistCard = ({ artist, listenBrainzClient }) => {
  const [expanded, setExpanded] = useState(false);
  const [topAlbums, setTopAlbums] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);

  // Auto-center the card when expanded
  useEffect(() => {
    if (expanded && cardRef.current) {
      // Short delay to let the width transition start
      setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 50);
    }
  }, [expanded]);

  const handleToggleExpand = async () => {
    if (!expanded) {
      // Expanding - fetch albums if we don't have them
      if (!topAlbums && artist.mbid) {
        setLoading(true);
        setError(null);
        try {
          console.log(`🎵 Fetching top albums for ${artist.artist} (${artist.mbid})...`);
          const albums = await listenBrainzClient.getTopAlbumsForArtist(artist.mbid, 5, true);
          const formatted = listenBrainzClient.formatTopAlbumsForUI(albums);
          setTopAlbums(formatted);
          console.log(`✅ Fetched ${formatted.length} albums for ${artist.artist}`);
        } catch (err) {
          console.error(`❌ Failed to fetch albums for ${artist.artist}:`, err);
          setError('Failed to load albums');
        } finally {
          setLoading(false);
        }
      }
    }
    setExpanded(!expanded);
  };

  return (
    <div ref={cardRef} className={`flex-shrink-0 bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-all ${
      expanded ? 'w-80' : 'w-48'
    }`}>
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
        <div className="text-xs text-gray-400 mb-2">
          <p className="truncate" title={artist.connections.map(c => c.sourceArtist).join(', ')}>
            {artist.connectionCount === 1
              ? `Similar to ${artist.connections[0].sourceArtist}`
              : `${artist.connectionCount} connections`}
          </p>
        </div>
      )}

      {/* Expand Button - Only show if artist has MBID */}
      {artist.mbid && (
        <button
          onClick={handleToggleExpand}
          className="w-full mt-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Hide albums
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6m0 0a2 2 0 012-2h2a2 2 0 012 2v0m-6 0V6m0 13a2 2 0 002 2h2a2 2 0 002-2m0 0V6m0 13v0" />
              </svg>
              Show top albums
            </>
          )}
        </button>
      )}

      {/* Expanded Top Albums Section */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full"></div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 text-center py-2">
              {error}
            </div>
          )}

          {!loading && !error && (!topAlbums || topAlbums.length === 0) && (
            <div className="text-xs text-gray-500 text-center py-2">
              No album data available
            </div>
          )}

          {!loading && !error && topAlbums && topAlbums.length > 0 && (
            <TopAlbumsList albums={topAlbums} />
          )}
        </div>
      )}
    </div>
  );
};

/**
 * TopAlbumsList Component
 * Displays a list of top albums for an artist
 */
const TopAlbumsList = ({ albums }) => {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-gray-400 mb-2">Top Albums</h5>
      {albums.map((album, index) => (
        <div
          key={`${album.mbid || album.name}-${index}`}
          className="flex items-start gap-2 text-xs"
        >
          <span className="text-purple-400 font-medium flex-shrink-0">{album.rank}.</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate" title={album.name}>
              {album.name}
            </p>
            <p className="text-gray-400 text-xs">
              {album.displaySubtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ArtistCarousel;
