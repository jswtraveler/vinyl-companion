/**
 * IndexedDB Provider
 *
 * Local storage implementation using IndexedDB.
 * Works offline and stores data in the browser.
 */

import { openDB } from 'idb';
import { DatabaseInterface } from '../DatabaseInterface.js';

const DB_NAME = 'VinylCollection';
const DB_VERSION = 1;

export class IndexedDBProvider extends DatabaseInterface {
  constructor() {
    super();
    this.dbInstance = null;
  }

  /**
   * Initialize IndexedDB connection
   */
  async init() {
    if (this.dbInstance) return this.dbInstance;

    try {
      this.dbInstance = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Albums store
          if (!db.objectStoreNames.contains('albums')) {
            const albumStore = db.createObjectStore('albums', { keyPath: 'id' });
            albumStore.createIndex('title', 'title');
            albumStore.createIndex('artist', 'artist');
            albumStore.createIndex('year', 'year');
            albumStore.createIndex('dateAdded', 'dateAdded');
          }

          // Cache store for API responses
          if (!db.objectStoreNames.contains('cache')) {
            const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
            cacheStore.createIndex('timestamp', 'timestamp');
          }

          // Images store for album covers
          if (!db.objectStoreNames.contains('images')) {
            db.createObjectStore('images', { keyPath: 'albumId' });
          }

          // Audio fingerprints store
          if (!db.objectStoreNames.contains('audio')) {
            db.createObjectStore('audio', { keyPath: 'albumId' });
          }
        },
      });

      console.log('IndexedDB initialized successfully');
      return this.dbInstance;
    } catch (error) {
      console.error('IndexedDB initialization failed:', error);
      throw error;
    }
  }

  /**
   * ALBUM OPERATIONS
   */

  async getAllAlbums(options = {}) {
    try {
      const db = await this.init();
      const albums = await db.getAll('albums');

      console.log(`Retrieved ${albums.length} albums from IndexedDB`);
      return albums.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    } catch (error) {
      console.error('Failed to get all albums:', error);
      throw new Error(`Failed to retrieve albums: ${error.message}`);
    }
  }

  async getAlbum(id) {
    try {
      if (!id) throw new Error('Album ID is required');

      const db = await this.init();
      const album = await db.get('albums', id);

      if (!album) {
        console.warn(`Album with ID ${id} not found`);
      }

      return album;
    } catch (error) {
      console.error('Failed to get album:', error);
      throw new Error(`Failed to retrieve album: ${error.message}`);
    }
  }

  async addAlbum(albumData) {
    try {
      if (!albumData || !albumData.title || !albumData.artist) {
        throw new Error('Album must have title and artist');
      }

      const db = await this.init();
      const tx = db.transaction('albums', 'readwrite');

      const albumToSave = {
        ...albumData,
        id: albumData.id || `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dateAdded: albumData.dateAdded || new Date().toISOString()
      };

      await tx.objectStore('albums').add(albumToSave);
      await tx.complete;

      console.log('Album added successfully:', albumToSave.title);
      return albumToSave;
    } catch (error) {
      console.error('Failed to add album:', error);
      if (error.name === 'ConstraintError') {
        throw new Error('Album with this ID already exists');
      }
      throw new Error(`Failed to add album: ${error.message}`);
    }
  }

  async updateAlbum(id, albumData) {
    try {
      if (!id) {
        throw new Error('Album ID is required for updates');
      }
      if (!albumData.title || !albumData.artist) {
        throw new Error('Album must have title and artist');
      }

      const db = await this.init();

      // Check if album exists
      const existing = await db.get('albums', id);
      if (!existing) {
        throw new Error('Album not found');
      }

      const tx = db.transaction('albums', 'readwrite');
      const updatedAlbum = {
        ...albumData,
        id: id, // Ensure ID is preserved
        dateModified: new Date().toISOString()
      };

      await tx.objectStore('albums').put(updatedAlbum);
      await tx.complete;

      console.log('Album updated successfully:', updatedAlbum.title);
      return updatedAlbum;
    } catch (error) {
      console.error('Failed to update album:', error);
      throw new Error(`Failed to update album: ${error.message}`);
    }
  }

  async deleteAlbum(id) {
    try {
      if (!id) throw new Error('Album ID is required');

      const db = await this.init();

      // Check if album exists
      const existing = await db.get('albums', id);
      if (!existing) {
        throw new Error('Album not found');
      }

      const tx = db.transaction(['albums', 'images', 'audio'], 'readwrite');

      await tx.objectStore('albums').delete(id);
      await tx.objectStore('images').delete(id);
      await tx.objectStore('audio').delete(id);

      await tx.complete;

      console.log('Album deleted successfully:', existing.title);
      return true;
    } catch (error) {
      console.error('Failed to delete album:', error);
      throw new Error(`Failed to delete album: ${error.message}`);
    }
  }

  async checkAlbumExists(artist, title) {
    try {
      const albums = await this.getAllAlbums();
      const existing = albums.find(
        album =>
          album.artist.toLowerCase().trim() === artist.toLowerCase().trim() &&
          album.title.toLowerCase().trim() === title.toLowerCase().trim()
      );
      return existing || null;
    } catch (error) {
      console.error('Error checking album existence:', error);
      throw error;
    }
  }

  /**
   * SEARCH OPERATIONS
   */

  async searchAlbums(query) {
    try {
      const albums = await this.getAllAlbums();
      const lowercaseQuery = query.toLowerCase();

      return albums.filter(
        album =>
          album.title.toLowerCase().includes(lowercaseQuery) ||
          album.artist.toLowerCase().includes(lowercaseQuery) ||
          (album.genre && album.genre.some(g => g.toLowerCase().includes(lowercaseQuery)))
      );
    } catch (error) {
      console.error('Failed to search albums:', error);
      throw error;
    }
  }

  async getAlbumsByArtist(artist) {
    try {
      const albums = await this.getAllAlbums();
      return albums.filter(album =>
        album.artist.toLowerCase().includes(artist.toLowerCase())
      );
    } catch (error) {
      console.error('Error fetching albums by artist:', error);
      throw error;
    }
  }

  /**
   * STATISTICS
   */

  async getCollectionStats() {
    try {
      const albums = await this.getAllAlbums();

      if (albums.length === 0) {
        return {
          total_albums: 0,
          unique_artists: 0,
          oldest_album: null,
          newest_album: null,
          average_rating: 0,
          total_spent: 0
        };
      }

      const artistSet = new Set(albums.map(a => a.artist));
      const years = albums.map(a => a.year).filter(Boolean);
      const ratings = albums.map(a => a.rating).filter(Boolean);
      const prices = albums.map(a => a.purchasePrice).filter(Boolean);

      return {
        total_albums: albums.length,
        unique_artists: artistSet.size,
        oldest_album: years.length > 0 ? Math.min(...years) : null,
        newest_album: years.length > 0 ? Math.max(...years) : null,
        average_rating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        total_spent: prices.reduce((a, b) => a + b, 0)
      };
    } catch (error) {
      console.error('Error fetching collection stats:', error);
      throw error;
    }
  }

  /**
   * CACHE OPERATIONS
   */

  async getCacheItem(key) {
    try {
      const db = await this.init();
      const item = await db.get('cache', key);

      if (!item) return null;

      // Check if cache item is expired (7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - item.timestamp > maxAge) {
        await db.delete('cache', key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.error('Failed to get cache item:', error);
      return null;
    }
  }

  async setCacheItem(key, data) {
    try {
      const db = await this.init();
      await db.put('cache', {
        key,
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to set cache item:', error);
      throw error;
    }
  }

  /**
   * IMAGE OPERATIONS
   */

  async saveAlbumImage(albumId, imageData) {
    try {
      const db = await this.init();
      await db.put('images', { albumId, imageData });
    } catch (error) {
      console.error('Failed to save album image:', error);
      throw error;
    }
  }

  async getAlbumImage(albumId) {
    try {
      const db = await this.init();
      const result = await db.get('images', albumId);
      return result?.imageData || null;
    } catch (error) {
      console.error('Failed to get album image:', error);
      return null;
    }
  }

  /**
   * DATA MIGRATION
   */

  async exportData() {
    try {
      const albums = await this.getAllAlbums();
      return {
        albums,
        exportDate: new Date().toISOString(),
        version: DB_VERSION,
        provider: 'indexeddb'
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async importData(data) {
    try {
      if (!data.albums) throw new Error('Invalid import data');

      const db = await this.init();
      const tx = db.transaction('albums', 'readwrite');

      for (const album of data.albums) {
        await tx.objectStore('albums').put(album);
      }

      await tx.complete;
      return data.albums.length;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * UTILITY METHODS
   */

  async testConnection() {
    try {
      await this.init();
      console.log('✅ IndexedDB connection successful');
      return true;
    } catch (error) {
      console.error('❌ IndexedDB connection failed:', error);
      return false;
    }
  }

  getProviderName() {
    return 'indexeddb';
  }

  isCloudProvider() {
    return false;
  }
}

export default IndexedDBProvider;
