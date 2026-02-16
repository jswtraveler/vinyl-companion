import KeepItGoingPanel from './KeepItGoingPanel';

export default function AlbumDetailModal({ album, allAlbums, onClose, onEdit, onSelectSimilar }) {
  if (!album) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Cover Image */}
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
                  className="px-2 py-0.5 text-xs rounded-full bg-purple-600 bg-opacity-20 text-purple-300 border border-purple-500 border-opacity-30"
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
