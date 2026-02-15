import { useState, useEffect, useMemo } from 'react';
import Database from '../services/database/index.js';

/**
 * Custom hook for managing album collection CRUD operations
 *
 * @param {boolean} useCloudDatabase - Whether to use cloud or local database
 * @param {boolean} authLoading - Whether authentication is still loading
 * @returns {Object} Album collection state and methods
 */
export function useAlbumCollection(useCloudDatabase = false, authLoading = false) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get provider info for logging
      const providerInfo = await Database.getProviderInfo();
      console.log(`Loading albums from ${providerInfo.name} (${providerInfo.isCloud ? 'cloud' : 'local'})...`);

      // Unified interface automatically selects the right provider
      const storedAlbums = await Database.getAllAlbums();

      setAlbums(storedAlbums);
      console.log(`Loaded ${storedAlbums.length} albums from ${providerInfo.name}`);
    } catch (err) {
      console.error('Failed to load albums:', err);
      setError(`Failed to load your vinyl collection. Please refresh the page.`);
    } finally {
      setLoading(false);
    }
  };

  // Initialize database and load albums
  useEffect(() => {
    if (!authLoading) {
      loadAlbums();
    }
  }, [authLoading, useCloudDatabase]);

  // Handle mobile app lifecycle - reload albums when app becomes visible again
  useEffect(() => {
    let reloadTimeout = null;

    const debouncedReload = () => {
      // Debounce to prevent multiple rapid reloads from different events
      if (reloadTimeout) clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => {
        console.log('App became visible - reloading albums...');
        loadAlbums();
      }, 100);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !authLoading) {
        debouncedReload();
      }
    };

    const handleFocus = () => {
      if (!authLoading) {
        debouncedReload();
      }
    };

    // Listen for mobile app lifecycle events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // iOS Safari specific - handles when user switches back to browser
    window.addEventListener('pageshow', handleFocus);

    return () => {
      if (reloadTimeout) clearTimeout(reloadTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [authLoading, useCloudDatabase]);

  const handleSaveAlbum = async (albumData, editingAlbum) => {
    // Check if this is editing an existing album in our database
    const isExistingAlbum = editingAlbum && albums.some(album => album.id === editingAlbum.id);
    console.log(isExistingAlbum ? 'Updating existing album:' : 'Saving new album:', albumData);

    // Use unified database interface (automatically selects provider)
    let savedAlbum;
    if (isExistingAlbum) {
      savedAlbum = await Database.updateAlbum(editingAlbum.id, albumData);
    } else {
      savedAlbum = await Database.addAlbum(albumData);
    }

    // Update local state
    if (isExistingAlbum) {
      setAlbums(prevAlbums =>
        prevAlbums.map(album =>
          album.id === savedAlbum.id ? savedAlbum : album
        )
      );
    } else {
      setAlbums(prevAlbums => [savedAlbum, ...prevAlbums]);
    }

    return savedAlbum;
  };

  const handleDeleteAlbum = async (album) => {
    // Use unified database interface (automatically selects provider)
    await Database.deleteAlbum(album.id);

    // Update local state
    setAlbums(prevAlbums => prevAlbums.filter(a => a.id !== album.id));

    return true;
  };

  const handleUpdateAlbum = async (albumId, updates) => {
    await Database.updateAlbum(albumId, updates);
    await loadAlbums(); // Reload albums to reflect changes
  };

  return {
    albums,
    loading,
    error,
    setError,
    loadAlbums,
    handleSaveAlbum,
    handleDeleteAlbum,
    handleUpdateAlbum
  };
}
