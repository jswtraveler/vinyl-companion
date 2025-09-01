import React, { useState, useEffect, useRef } from 'react';
import { 
  ALBUM_FORMATS, 
  RECORD_SPEEDS, 
  CONDITION_GRADES, 
  MUSIC_GENRES, 
  createNewAlbum,
  validateAlbum 
} from '../models/Album';
import { MetadataEnricher, createAlbumFromMetadata } from '../services/metadataEnricher.js';

const AlbumForm = ({ 
  album, 
  onSave, 
  onCancel, 
  mode = 'add' // 'add' or 'edit'
}) => {
  const [formData, setFormData] = useState(() => {
    if (album) {
      return { ...album };
    }
    return createNewAlbum();
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metadataSuggestions, setMetadataSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [lastSearchFields, setLastSearchFields] = useState({ title: '', artist: '' });
  const debounceTimer = useRef(null);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    basic: true,      // Always expanded
    physical: false,  // Minimized by default
    genres: false,    // Minimized by default
    collection: false // Minimized by default
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    
    // Handle special field types
    if (name === 'year') {
      processedValue = value ? parseInt(value, 10) : null;
    } else if (name === 'purchasePrice') {
      processedValue = value ? parseFloat(value) : null;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }

    // Trigger metadata search when title or artist changes
    if ((name === 'title' || name === 'artist') && mode === 'add') {
      debouncedMetadataSearch(name === 'title' ? processedValue : formData.title, name === 'artist' ? processedValue : formData.artist);
    }
  };

  const handleGenreChange = (genre) => {
    const currentGenres = formData.genre || [];
    const newGenres = currentGenres.includes(genre)
      ? currentGenres.filter(g => g !== genre)
      : [...currentGenres, genre];
    
    setFormData(prev => ({
      ...prev,
      genre: newGenres
    }));
  };

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Debounced metadata search to avoid too many API calls
  const debouncedMetadataSearch = (title, artist) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchMetadata(title, artist);
    }, 1000); // Wait 1 second after user stops typing
  };

  const searchMetadata = async (title, artist) => {
    const currentTitle = title?.trim() || '';
    const currentArtist = artist?.trim() || '';
    
    // Don't search if no fields are filled
    if (!currentTitle && !currentArtist) {
      return;
    }

    // Check if this is a new search worth doing
    const hasNewInfo = (
      currentTitle !== lastSearchFields.title || 
      currentArtist !== lastSearchFields.artist
    );

    // Skip if no new information and we already searched
    if (!hasNewInfo && searchAttempted) {
      return;
    }

    setIsLoadingSuggestions(true);
    setSearchAttempted(true);
    setLastSearchFields({ title: currentTitle, artist: currentArtist });

    try {
      const suggestions = await MetadataEnricher.searchAlbumMetadata(title, artist);
      setMetadataSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Metadata search error:', error);
      setMetadataSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (suggestion) => {
    try {
      // Get detailed metadata if needed
      const detailedMetadata = await MetadataEnricher.getDetailedMetadata(suggestion);
      
      // Create album data from metadata, preserving user's existing data
      const enrichedData = createAlbumFromMetadata(detailedMetadata, {
        // Preserve manually entered data that user might want to keep
        purchasePrice: formData.purchasePrice,
        purchaseLocation: formData.purchaseLocation,
        notes: formData.notes,
        condition: formData.condition,
        speed: formData.speed
      });

      setFormData(enrichedData);
      setShowSuggestions(false);
      setMetadataSuggestions([]);
      
      // Reset search state to allow future searches if user modifies fields
      setSearchAttempted(false);
      setLastSearchFields({ title: '', artist: '' });
    } catch (error) {
      console.error('Error applying metadata:', error);
    }
  };

  const handleSkipSuggestions = () => {
    setShowSuggestions(false);
    setMetadataSuggestions([]);
    
    // Reset search state to allow future searches if user modifies fields
    setSearchAttempted(false);
    setLastSearchFields({ title: '', artist: '' });
  };

  // Clear search state when switching between add/edit modes
  useEffect(() => {
    if (mode === 'edit') {
      setSearchAttempted(true); // Don't search for existing albums
      setShowSuggestions(false);
      setMetadataSuggestions([]);
      setLastSearchFields({ title: '', artist: '' });
    } else {
      // Reset everything for add mode
      setSearchAttempted(false);
      setLastSearchFields({ title: '', artist: '' });
    }
  }, [mode]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    
    // Validate form data
    const validation = validateAlbum(formData, mode);
    
    if (!validation.isValid) {
      const fieldErrors = {};
      validation.errors.forEach(error => {
        if (error.includes('title')) fieldErrors.title = error;
        else if (error.includes('artist')) fieldErrors.artist = error;
        else if (error.includes('year')) fieldErrors.year = error;
        else fieldErrors.general = error;
      });
      
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }
    
    try {
      await onSave({
        ...formData,
        dateModified: mode === 'edit' ? new Date().toISOString() : undefined
      });
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full">
      <div className="mb-6">
        <p className="text-gray-400">
          {mode === 'edit' ? 'Update your album details' : 'Add a new record to your collection'}
        </p>
      </div>

      {errors.general && (
        <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-md">
          <p className="text-red-200 text-sm">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto pr-2" style={{maxHeight: 'calc(100vh - 200px)'}}>
        {/* Basic Information */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-600">
          <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Album Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title || ''}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white ${
                  errors.title ? 'border-red-500' : 'border-gray-500'
                }`}
                placeholder="Enter album title"
              />
              {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Artist *
              </label>
              <input
                type="text"
                name="artist"
                value={formData.artist || ''}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white ${
                  errors.artist ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter artist name"
              />
              {errors.artist && <p className="text-red-600 text-xs mt-1">{errors.artist}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Release Year
              </label>
              <input
                type="number"
                name="year"
                value={formData.year || ''}
                onChange={handleChange}
                min="1877"
                max={new Date().getFullYear() + 1}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white ${
                  errors.year ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g. 1973"
              />
              {errors.year && <p className="text-red-600 text-xs mt-1">{errors.year}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Record Label
              </label>
              <input
                type="text"
                name="label"
                value={formData.label || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                placeholder="e.g. Harvest Records"
              />
            </div>
          </div>
        </div>

        {/* Metadata Suggestions */}
        {mode === 'add' && (showSuggestions || isLoadingSuggestions) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Album Suggestions
              </h3>
              {!isLoadingSuggestions && (
                <button
                  type="button"
                  onClick={handleSkipSuggestions}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Skip suggestions
                </button>
              )}
            </div>
            
            {isLoadingSuggestions ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-3">
                  <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                  </svg>
                  <span className="text-gray-600">Searching for album metadata...</span>
                </div>
              </div>
            ) : metadataSuggestions.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  We found some matches for your album. Click on one to auto-fill the form:
                </p>
                <div className="grid gap-3">
                  {metadataSuggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.source}-${suggestion.id}-${index}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="flex items-start p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      {suggestion.coverUrl && (
                        <img
                          src={suggestion.coverUrl}
                          alt={`${suggestion.title} cover`}
                          className="w-16 h-16 rounded-lg object-cover mr-4 flex-shrink-0"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-grow min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {suggestion.title}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          by {suggestion.artist}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          {suggestion.year && <span>{suggestion.year}</span>}
                          {suggestion.label && <span>{suggestion.label}</span>}
                          {suggestion.format && <span>{suggestion.format}</span>}
                          <span className="capitalize bg-gray-100 px-2 py-1 rounded">
                            {suggestion.source}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  You can still modify any field after selecting a suggestion.
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600">No matches found for this album.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Continue filling out the form manually.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Physical Details */}
        <div className="bg-gray-800 rounded-lg border border-gray-600">
          <button
            type="button"
            onClick={() => toggleSection('physical')}
            className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Physical Details</h3>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expandedSections.physical ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.physical && (
            <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Format
              </label>
              <select
                name="format"
                value={formData.format || 'LP'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              >
                {ALBUM_FORMATS.map(format => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Speed
              </label>
              <select
                name="speed"
                value={formData.speed || '33⅓ RPM'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              >
                {RECORD_SPEEDS.map(speed => (
                  <option key={speed} value={speed}>{speed}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Condition
              </label>
              <select
                name="condition"
                value={formData.condition || 'Very Good (VG)'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              >
                {CONDITION_GRADES.map(condition => (
                  <option key={condition} value={condition}>{condition}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Catalog Number
              </label>
              <input
                type="text"
                name="catalogNumber"
                value={formData.catalogNumber || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                placeholder="e.g. SHVL 804"
              />
            </div>
          </div>
            </div>
          )}
        </div>

        {/* Genres */}
        <div className="bg-gray-800 rounded-lg border border-gray-600">
          <button
            type="button"
            onClick={() => toggleSection('genres')}
            className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Genres</h3>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expandedSections.genres ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.genres && (
            <div className="px-6 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {MUSIC_GENRES.map(genre => (
              <label key={genre} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.genre || []).includes(genre)}
                  onChange={() => handleGenreChange(genre)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">{genre}</span>
              </label>
            ))}
          </div>
            </div>
          )}
        </div>

        {/* Collection Details */}
        <div className="bg-gray-800 rounded-lg border border-gray-600">
          <button
            type="button"
            onClick={() => toggleSection('collection')}
            className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Collection Details</h3>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expandedSections.collection ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.collection && (
            <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Purchase Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice || ''}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Purchase Location
              </label>
              <input
                type="text"
                name="purchaseLocation"
                value={formData.purchaseLocation || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                placeholder="e.g. Downtown Records, NYC"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Personal notes, pressing details, condition notes..."
            />
            <p className="text-xs text-gray-400 mt-1">
              {(formData.notes || '').length}/1000 characters
            </p>
          </div>
            </div>
          )}
        </div>

        </div>
        
        {/* Sticky Form Actions */}
        <div className="flex-shrink-0 flex justify-end space-x-3 pt-6 border-t border-gray-600 bg-gray-800 -mx-6 px-6 -mb-6 pb-6 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2 text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {isSubmitting && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
              </svg>
            )}
            <span>{mode === 'edit' ? 'Update Album' : 'Save Album'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AlbumForm;