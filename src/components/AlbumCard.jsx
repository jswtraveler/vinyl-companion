import React, { useState } from 'react';

const AlbumCard = ({
  album,
  onClick,
  onEdit,
  onDelete,
  onUpdateAlbum,
  showActions = true
}) => {
  const [showDescription, setShowDescription] = useState(false);
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

  const handleThumb = (e, value) => {
    e.stopPropagation();
    if (!onUpdateAlbum) return;
    const newThumb = album.thumb === value ? null : value;
    onUpdateAlbum(album.id, { thumb: newThumb });
  };

  const hasAIDescription = album.aiAnalysis && album.aiAnalysis.reasoning;

  const toggleDescription = (e) => {
    e.stopPropagation();
    setShowDescription(!showDescription);
  };

  return (
    <article
      className="bg-gray-800 shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden group relative cursor-pointer"
      onClick={() => onClick?.(album)}
    >
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
          <div className="flex items-center justify-between">
            {album.year && (
              <p className="text-xs mt-1">
                {album.year}
              </p>
            )}
            
            {/* AI Description Button */}
            {hasAIDescription && (
              <button
                onClick={toggleDescription}
                className="text-purple-400 hover:text-purple-300 transition-colors"
                title="View AI mood analysis"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Mood Tags */}
          {album.moods && album.moods.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {album.moods.slice(0, 3).map((mood) => (
                <span
                  key={mood}
                  className="px-2 py-0.5 text-xs rounded-full bg-purple-600 bg-opacity-20 text-purple-300 border border-purple-500 border-opacity-30"
                >
                  {mood}
                </span>
              ))}
              {album.moods.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{album.moods.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Thumb Up / Down */}
          {onUpdateAlbum && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => handleThumb(e, 'up')}
                className={`p-1 rounded transition-colors ${
                  album.thumb === 'up'
                    ? 'text-green-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Thumbs up"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={album.thumb === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zm-9 11H3a2 2 0 01-2-2v-7a2 2 0 012-2h2" />
                </svg>
              </button>
              <button
                onClick={(e) => handleThumb(e, 'down')}
                className={`p-1 rounded transition-colors ${
                  album.thumb === 'down'
                    ? 'text-red-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Thumbs down"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={album.thumb === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zm9-13h2a2 2 0 012 2v7a2 2 0 01-2 2h-2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* AI Description Popup */}
      {showDescription && hasAIDescription && (
        <div className="absolute inset-0 bg-black bg-opacity-90 p-4 z-20 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-medium text-sm">AI Analysis</h4>
            <button
              onClick={toggleDescription}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <p className="text-gray-300 text-xs leading-relaxed flex-1 overflow-y-auto">
            "{album.aiAnalysis.reasoning}"
          </p>
          
          {album.aiAnalysis.timestamp && (
            <p className="text-gray-500 text-xs mt-2">
              Analyzed: {formatDate(album.aiAnalysis.timestamp)}
            </p>
          )}
        </div>
      )}
    </article>
  );
};

export default AlbumCard;