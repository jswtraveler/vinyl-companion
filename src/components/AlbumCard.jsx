import React from 'react';

const AlbumCard = ({ album }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gray-200 rounded-lg mb-4">
        {album.coverImage ? (
          <img 
            src={album.coverImage} 
            alt={`${album.title} cover`}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span>No Image</span>
          </div>
        )}
      </div>
      <h3 className="font-semibold text-lg truncate">{album.title}</h3>
      <p className="text-gray-600 truncate">{album.artist}</p>
      <p className="text-sm text-gray-500">{album.year}</p>
    </div>
  );
};

export default AlbumCard;