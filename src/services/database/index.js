/**
 * Unified Database Interface
 *
 * This is the main entry point for all database operations.
 * It automatically selects the appropriate provider (IndexedDB or Supabase)
 * based on authentication status.
 *
 * Usage:
 *   import Database from './services/database';
 *
 *   const albums = await Database.getAllAlbums();
 *   await Database.addAlbum(albumData);
 */

import { IndexedDBProvider } from './providers/IndexedDBProvider.js';
import { SupabaseProvider } from './providers/SupabaseProvider.js';
import { supabase } from './supabaseClient.js';

class DatabaseFactory {
  constructor() {
    this.currentProvider = null;
    this.indexedDBProvider = null;
    this.supabaseProvider = null;
  }

  /**
   * Get the appropriate database provider
   * Auto-detects based on authentication status
   */
  async getProvider() {
    try {
      // Check if user is authenticated
      const { data: { user }, error } = await supabase.auth.getUser();

      if (user && !error) {
        // User is authenticated, use Supabase
        if (!this.supabaseProvider) {
          this.supabaseProvider = new SupabaseProvider();
        }
        this.currentProvider = this.supabaseProvider;
        return this.supabaseProvider;
      } else {
        // No user, use IndexedDB
        if (!this.indexedDBProvider) {
          this.indexedDBProvider = new IndexedDBProvider();
        }
        this.currentProvider = this.indexedDBProvider;
        return this.indexedDBProvider;
      }
    } catch (error) {
      // If error checking auth, fall back to IndexedDB
      console.warn('Error checking auth status, falling back to IndexedDB:', error);
      if (!this.indexedDBProvider) {
        this.indexedDBProvider = new IndexedDBProvider();
      }
      this.currentProvider = this.indexedDBProvider;
      return this.indexedDBProvider;
    }
  }

  /**
   * Force use of a specific provider
   * @param {string} providerName - 'indexeddb' or 'supabase'
   */
  async setProvider(providerName) {
    if (providerName === 'indexeddb') {
      if (!this.indexedDBProvider) {
        this.indexedDBProvider = new IndexedDBProvider();
      }
      this.currentProvider = this.indexedDBProvider;
      return this.indexedDBProvider;
    } else if (providerName === 'supabase') {
      if (!this.supabaseProvider) {
        this.supabaseProvider = new SupabaseProvider();
      }
      this.currentProvider = this.supabaseProvider;
      return this.supabaseProvider;
    } else {
      throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Get current provider info
   */
  async getProviderInfo() {
    const provider = await this.getProvider();
    return {
      name: provider.getProviderName(),
      isCloud: provider.isCloudProvider()
    };
  }

  /**
   * ALBUM OPERATIONS
   */

  async getAllAlbums(options = {}) {
    const provider = await this.getProvider();
    return provider.getAllAlbums(options);
  }

  async getAlbum(id) {
    const provider = await this.getProvider();
    return provider.getAlbum(id);
  }

  async addAlbum(albumData) {
    const provider = await this.getProvider();
    return provider.addAlbum(albumData);
  }

  async updateAlbum(id, albumData) {
    const provider = await this.getProvider();
    return provider.updateAlbum(id, albumData);
  }

  async deleteAlbum(id) {
    const provider = await this.getProvider();
    return provider.deleteAlbum(id);
  }

  async checkAlbumExists(artist, title) {
    const provider = await this.getProvider();
    return provider.checkAlbumExists(artist, title);
  }

  /**
   * SEARCH OPERATIONS
   */

  async searchAlbums(query) {
    const provider = await this.getProvider();
    return provider.searchAlbums(query);
  }

  async getAlbumsByArtist(artist) {
    const provider = await this.getProvider();
    return provider.getAlbumsByArtist(artist);
  }

  /**
   * STATISTICS
   */

  async getCollectionStats() {
    const provider = await this.getProvider();
    return provider.getCollectionStats();
  }

  /**
   * CACHE OPERATIONS
   */

  async getCacheItem(key) {
    const provider = await this.getProvider();
    return provider.getCacheItem(key);
  }

  async setCacheItem(key, data) {
    const provider = await this.getProvider();
    return provider.setCacheItem(key, data);
  }

  /**
   * IMAGE OPERATIONS
   */

  async saveAlbumImage(albumId, imageData) {
    const provider = await this.getProvider();
    return provider.saveAlbumImage(albumId, imageData);
  }

  async getAlbumImage(albumId) {
    const provider = await this.getProvider();
    return provider.getAlbumImage(albumId);
  }

  /**
   * DATA MIGRATION
   */

  async exportData() {
    const provider = await this.getProvider();
    return provider.exportData();
  }

  async importData(data) {
    const provider = await this.getProvider();
    return provider.importData(data);
  }

  /**
   * MIGRATION UTILITIES
   */

  /**
   * Migrate data from IndexedDB to Supabase
   * @returns {Promise<Object>} Migration results
   */
  async migrateToCloud() {
    try {
      // Get data from IndexedDB
      if (!this.indexedDBProvider) {
        this.indexedDBProvider = new IndexedDBProvider();
      }
      const localData = await this.indexedDBProvider.exportData();

      // Import to Supabase
      if (!this.supabaseProvider) {
        this.supabaseProvider = new SupabaseProvider();
      }
      const count = await this.supabaseProvider.importData(localData);

      return {
        success: true,
        count,
        message: `Successfully migrated ${count} albums to cloud storage`
      };
    } catch (error) {
      console.error('Migration to cloud failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to migrate to cloud storage'
      };
    }
  }

  /**
   * Migrate data from Supabase to IndexedDB
   * @returns {Promise<Object>} Migration results
   */
  async migrateToLocal() {
    try {
      // Get data from Supabase
      if (!this.supabaseProvider) {
        this.supabaseProvider = new SupabaseProvider();
      }
      const cloudData = await this.supabaseProvider.exportData();

      // Import to IndexedDB
      if (!this.indexedDBProvider) {
        this.indexedDBProvider = new IndexedDBProvider();
      }
      const count = await this.indexedDBProvider.importData(cloudData);

      return {
        success: true,
        count,
        message: `Successfully migrated ${count} albums to local storage`
      };
    } catch (error) {
      console.error('Migration to local failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to migrate to local storage'
      };
    }
  }

  /**
   * UTILITY METHODS
   */

  async init() {
    const provider = await this.getProvider();
    return provider.init();
  }

  async testConnection() {
    const provider = await this.getProvider();
    return provider.testConnection();
  }
}

// Create singleton instance
const Database = new DatabaseFactory();

// Export singleton as default
export default Database;

// Also export providers for direct use if needed
export { IndexedDBProvider, SupabaseProvider, DatabaseFactory };
