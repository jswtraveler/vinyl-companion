import { useEffect, useRef, useCallback } from 'react';
import KeepItGoingPanel from './KeepItGoingPanel';

export default function AlbumDetailModal({ album, allAlbums, onClose, onEdit, onSelectSimilar }) {
  const touchStartX = useRef(null);
  const modalRef = useRef(null);

  // Find current index in allAlbums for navigation
  const currentIndex = allAlbums ? allAlbums.findIndex(a => a.id === album?.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < allAlbums.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) onSelectSimilar(allAlbums[currentIndex - 1]);
  }, [hasPrev, currentIndex, allAlbums, onSelectSimilar]);

  const goToNext = useCallback(() => {
    if (hasNext) onSelectSimilar(allAlbums[currentIndex + 1]);
  }, [hasNext, currentIndex, allAlbums, onSelectSimilar]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToPrev, goToNext, onClose]);

  // Touch swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 50) goToPrev();
    else if (dx < -50) goToNext();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!album) return null;

  // Group tracks by side if any track has a side value
  const tracks = album.tracks || [];
  const hasSides = tracks.some(t => t.side);
  const tracksBySide = hasSides
    ? tracks.reduce((acc, t) => {
        const side = t.side || '?';
        if (!acc[side]) acc[side] = [];
        acc[side].push(t);
        return acc;
      }, {})
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Cover Image + nav arrows */}
        <div className="aspect-square bg-gray-700 relative rounded-t-lg overflow-hidden">
          {album.coverImage ? (
            <img
              src={album.coverImage}
              alt={`${album.title} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}

          {/* Prev / Next overlay buttons */}
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
              aria-label="Previous album"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {hasNext && (
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-colors"
              aria-label="Next album"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Position indicator */}
          {allAlbums && allAlbums.length > 1 && currentIndex !== -1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {allAlbums.length}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-5">
          <h2 className="text-xl font-bold text-white">{album.title}</h2>
          <p className="text-gray-300 mt-1">{album.artist}</p>
          {album.year && <p className="text-gray-400 text-sm mt-1">{album.year}</p>}

          {/* Genre Tags */}
          {album.genre && album.genre.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {album.genre.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 text-xs rounded-full bg-purple-600 bg-opacity-20 text-purple-300 border border-purple-500 border-opacity-30"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Mood Tags */}
          {album.moods && album.moods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {album.moods.map((mood) => (
                <span
                  key={mood}
                  className="px-2 py-0.5 text-xs rounded-full bg-blue-600 bg-opacity-20 text-blue-300 border border-blue-500 border-opacity-30"
                >
                  {mood}
                </span>
              ))}
            </div>
          )}

          {/* Thumb Status */}
          {album.thumb && (
            <div className="mt-3">
              {album.thumb === 'up' ? (
                <span className="text-green-400 flex items-center gap-1 text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zm-9 11H3a2 2 0 01-2-2v-7a2 2 0 012-2h2" />
                  </svg>
                  Liked
                </span>
              ) : (
                <span className="text-red-400 flex items-center gap-1 text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zm9-13h2a2 2 0 012 2v7a2 2 0 01-2 2h-2" />
                  </svg>
                  Disliked
                </span>
              )}
            </div>
          )}

          {/* Track Listing */}
          {tracks.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Tracks</h3>
              {hasSides ? (
                Object.entries(tracksBySide)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([side, sideTracks]) => (
                    <div key={side} className="mb-3">
                      <p className="text-xs text-gray-500 font-medium mb-1">Side {side}</p>
                      <div className="space-y-1">
                        {sideTracks
                          .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                          .map((track) => (
                            <div key={track.id} className="flex items-center gap-3 text-sm">
                              <span className="text-gray-500 w-5 text-right flex-shrink-0">
                                {track.track_number}
                              </span>
                              <span className="text-gray-200 flex-1 truncate">{track.title}</span>
                              {track.duration && (
                                <span className="text-gray-500 flex-shrink-0">{track.duration}</span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="space-y-1">
                  {tracks
                    .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                    .map((track) => (
                      <div key={track.id} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-5 text-right flex-shrink-0">
                          {track.track_number}
                        </span>
                        <span className="text-gray-200 flex-1 truncate">{track.title}</span>
                        {track.duration && (
                          <span className="text-gray-500 flex-shrink-0">{track.duration}</span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Keep It Going */}
          <div className="mt-4">
            <KeepItGoingPanel
              targetAlbum={album}
              allAlbums={allAlbums}
              onSelectAlbum={onSelectSimilar}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            {onEdit && (
              <button
                onClick={() => onEdit(album)}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
