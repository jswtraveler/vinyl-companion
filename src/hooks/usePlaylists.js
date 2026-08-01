import { useState, useEffect } from 'react';
import Database from '../services/database/index.js';

/**
 * Custom hook for managing saved Vibes playlists (CRUD).
 * Mirrors the shape of useAlbumCollection.
 *
 * @param {boolean} useCloudDatabase - Whether to use cloud or local database
 * @param {boolean} authLoading - Whether authentication is still loading
 * @returns {Object} Playlist state and methods
 */
export function usePlaylists(useCloudDatabase = false, authLoading = false) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);

      const storedPlaylists = await Database.getPlaylists();
      setPlaylists(storedPlaylists);
    } catch (err) {
      console.error('Failed to load playlists:', err);
      setError('Failed to load your saved playlists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadPlaylists();
    }
  }, [authLoading, useCloudDatabase]);

  const savePlaylist = async (playlist) => {
    const saved = await Database.savePlaylist(playlist);

    setPlaylists(prev => {
      const exists = prev.some(p => p.id === saved.id);
      return exists
        ? prev.map(p => (p.id === saved.id ? saved : p))
        : [saved, ...prev];
    });

    return saved;
  };

  const deletePlaylist = async (id) => {
    await Database.deletePlaylist(id);
    setPlaylists(prev => prev.filter(p => p.id !== id));
    return true;
  };

  return {
    playlists,
    loading,
    error,
    setError,
    loadPlaylists,
    savePlaylist,
    deletePlaylist
  };
}

export default usePlaylists;
