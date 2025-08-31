import React, { useState, useMemo } from 'react';
import { MOOD_CATEGORIES, getRecommendedAlbumsForMood } from '../utils/moodUtils.js';

const SuggestionsSection = ({ albums = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  
  // Get suggested albums for the selected mood
  const suggestedAlbums = useMemo(() => {
    if (!selectedMood || !albums.length) return [];
    return getRecommendedAlbumsForMood(albums, selectedMood, 6);
  }, [albums, selectedMood]);
  
  const handleMoodSelect = (moodId) => {
    setSelectedMood(selectedMood === moodId ? null : moodId);
  };
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    // Reset mood selection when collapsing
    if (isExpanded) {
      setSelectedMood(null);
    }
  };
  
  // Don't show suggestions if no albums in collection
  if (!albums || albums.length === 0) {
    return null;
  }
  
  return (
    <div className="mb-6">
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
      >
        <h2 className="text-lg font-semibold text-white">Suggestions</h2>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 bg-gray-800 rounded-lg p-6">
          {/* Mood Filters */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Mood Filters</h3>
            <div className="flex flex-wrap gap-2">
              {MOOD_CATEGORIES.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => handleMoodSelect(mood.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedMood === mood.id
                      ? `${mood.color} text-white shadow-lg scale-105`
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white'
                  }`}
                >
                  {mood.label}
                </button>
              ))}
            </div>
            {selectedMood && (
              <div className="mt-2 text-sm text-gray-400">
                Showing albums that match "{MOOD_CATEGORIES.find(m => m.id === selectedMood)?.label}" mood
              </div>
            )}
          </div>
          
          {/* Album Suggestions */}
          {selectedMood && (
            <div>
              <h4 className="text-white font-medium mb-3">From your collection</h4>
              {suggestedAlbums.length > 0 ? (
                <div className="flex space-x-4 overflow-x-auto pb-2">
                  {suggestedAlbums.map((album) => (
                    <SuggestionCard key={album.id} album={album} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p>No albums in your collection match this mood yet.</p>
                  <p className="text-sm mt-1">Try adding some albums or selecting a different mood!</p>
                </div>
              )}
            </div>
          )}
          
          {/* Instructions when no mood selected */}
          {!selectedMood && (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Select a mood above to see album suggestions from your collection</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Individual suggestion card component
const SuggestionCard = ({ album }) => {
  return (
    <div className="flex-shrink-0 w-32 bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition-colors cursor-pointer group">
      {/* Album Cover */}
      <div className="aspect-square bg-gray-600 relative">
        {album.coverImage ? (
          <img 
            src={album.coverImage} 
            alt={`${album.title} cover`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" 
              />
            </svg>
          </div>
        )}
        
        {/* Play/View overlay on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* Album Info */}
      <div className="p-3">
        <h5 className="text-white text-sm font-medium truncate" title={album.title}>
          {album.title}
        </h5>
        <p className="text-gray-400 text-xs truncate mt-1" title={album.artist}>
          {album.artist}
        </p>
        {album.year && (
          <p className="text-gray-500 text-xs mt-1">
            {album.year}
          </p>
        )}
      </div>
    </div>
  );
};

export default SuggestionsSection;