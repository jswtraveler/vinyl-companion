import { useState, useMemo } from 'react';
import { findSimilarOwned } from '../utils/collectionSimilarity';

export default function KeepItGoingPanel({ targetAlbum, allAlbums, onSelectAlbum }) {
  const [expanded, setExpanded] = useState(false);

  const similar = useMemo(
    () => findSimilarOwned(targetAlbum, allAlbums),
    [targetAlbum, allAlbums]
  );

  if (!targetAlbum) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-purple-300 transition-colors"
      >
        <span>Keep it going</span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2">
          {similar.length === 0 ? (
            <p className="text-gray-400 text-sm px-2">No similar albums found</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {similar.map(({ album, reasons }) => (
                <button
                  key={album.id}
                  onClick={() => onSelectAlbum(album)}
                  className="flex-shrink-0 w-28 bg-gray-700 hover:bg-gray-600 rounded-lg overflow-hidden text-left transition-colors"
                >
                  <div className="aspect-square bg-gray-800">
                    {album.coverImage ? (
                      <img
                        src={album.coverImage}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-white text-xs font-medium truncate">{album.title}</p>
                    <p className="text-gray-400 text-xs truncate">{album.artist}</p>
                    <p className="text-purple-400 text-xs mt-1 truncate">{reasons[0]}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
