import React from 'react';

const AlbumCard = ({ 
  album, 
  onEdit, 
  onDelete, 
  showActions = true 
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const formatGenres = (genres) => {
    if (!genres || !Array.isArray(genres) || genres.length === 0) return '';
    return genres.slice(0, 2).join(', ') + (genres.length > 2 ? '...' : '');
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(album);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(album);
  };

  return (
    <article className="bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden group">
      {/* Cover Image */}
      <div className="aspect-square bg-gray-700 relative">
        {album.coverImage ? (
          <img 
            src={album.coverImage} 
            alt={`${album.title} cover`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" 
              />
            </svg>
          </div>
        )}
        
        {/* Action buttons overlay */}
        {showActions && (
          <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex gap-1">
              {onEdit && (
                <button
                  onClick={handleEdit}
                  className="bg-white/90 hover:bg-blue-500 hover:text-white text-gray-700 p-1.5 rounded-full shadow-md transition-colors"
                  title="Edit album"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                    />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="bg-white/90 hover:bg-red-500 hover:text-white text-gray-700 p-1.5 rounded-full shadow-md transition-colors"
                  title="Delete album"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Album Information */}
      <div className="p-4">
        {/* Title and Artist */}
        <h3 className="font-semibold text-lg text-white truncate" title={album.title}>
          {album.title}
        </h3>
        <p className="text-gray-300 truncate mb-2" title={album.artist}>
          {album.artist}
        </p>

        {/* Album Details - Simplified */}
        <div className="text-sm text-gray-400">
          {album.year && (
            <p className="text-xs mt-1">
              {album.year}
            </p>
          )}
        </div>
      </div>
    </article>
  );
};

export default AlbumCard;