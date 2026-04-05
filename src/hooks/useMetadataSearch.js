import { useState, useEffect, useRef } from 'react';
import { MetadataEnricher, createAlbumFromMetadata } from '../services/metadataEnricher.js';

/**
 * Manages debounced metadata search and suggestion state for AlbumForm.
 *
 * @param {Object} formData - Current form state (read for preserved fields on apply)
 * @param {string} mode - 'add' | 'edit'
 * @param {Function} onApply - Called with enriched album data when user selects a suggestion
 */
export function useMetadataSearch(formData, mode, onApply) {
  const [metadataSuggestions, setMetadataSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [lastSearchFields, setLastSearchFields] = useState({ title: '', artist: '' });
  const debounceTimer = useRef(null);

  const reset = () => {
    setShowSuggestions(false);
    setMetadataSuggestions([]);
    setSearchAttempted(false);
    setLastSearchFields({ title: '', artist: '' });
  };

  // Reset state when mode changes
  useEffect(() => {
    if (mode === 'edit') {
      setSearchAttempted(true); // Suppress search for existing albums
      setShowSuggestions(false);
      setMetadataSuggestions([]);
      setLastSearchFields({ title: '', artist: '' });
    } else {
      setSearchAttempted(false);
      setLastSearchFields({ title: '', artist: '' });
    }
  }, [mode]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const searchMetadata = async (title, artist) => {
    const currentTitle = title?.trim() || '';
    const currentArtist = artist?.trim() || '';
    if (!currentTitle && !currentArtist) return;

    const hasNewInfo = currentTitle !== lastSearchFields.title || currentArtist !== lastSearchFields.artist;
    if (!hasNewInfo && searchAttempted) return;

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

  const triggerSearch = (title, artist) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchMetadata(title, artist), 1000);
  };

  const handleSelectSuggestion = async (suggestion) => {
    try {
      const detailedMetadata = await MetadataEnricher.getDetailedMetadata(suggestion);
      const enrichedData = createAlbumFromMetadata(detailedMetadata, {
        purchasePrice: formData.purchasePrice,
        purchaseLocation: formData.purchaseLocation,
        notes: formData.notes,
        condition: formData.condition,
        speed: formData.speed
      });
      onApply(enrichedData);
      reset();
    } catch (error) {
      console.error('Error applying metadata:', error);
    }
  };

  const handleSkipSuggestions = () => reset();

  return {
    metadataSuggestions,
    isLoadingSuggestions,
    showSuggestions,
    triggerSearch,
    handleSelectSuggestion,
    handleSkipSuggestions,
  };
}
