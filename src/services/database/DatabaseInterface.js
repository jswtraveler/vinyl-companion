/**
 * Database Interface Definition
 *
 * This defines the contract that all database providers must implement.
 * Provides a consistent API regardless of the underlying storage mechanism.
 */

export class DatabaseInterface {
  /**
   * ALBUM OPERATIONS
   */

  /**
   * Get all albums
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of albums
   */
  async getAllAlbums(options = {}) {
    throw new Error('getAllAlbums must be implemented by provider');
  }

  /**
   * Get a single album by ID
   * @param {string} id - Album ID
   * @returns {Promise<Object|null>} Album object or null if not found
   */
  async getAlbum(id) {
    throw new Error('getAlbum must be implemented by provider');
  }

  /**
   * Add a new album
   * @param {Object} albumData - Album data
   * @returns {Promise<Object>} Created album with ID
   */
  async addAlbum(albumData) {
    throw new Error('addAlbum must be implemented by provider');
  }

  /**
   * Update an existing album
   * @param {string} id - Album ID
   * @param {Object} albumData - Updated album data
   * @returns {Promise<Object>} Updated album
   */
  async updateAlbum(id, albumData) {
    throw new Error('updateAlbum must be implemented by provider');
  }

  /**
   * Delete an album
   * @param {string} id - Album ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAlbum(id) {
    throw new Error('deleteAlbum must be implemented by provider');
  }

  /**
   * Check if an album exists
   * @param {string} artist - Artist name
   * @param {string} title - Album title
   * @returns {Promise<Object|null>} Existing album or null
   */
  async checkAlbumExists(artist, title) {
    throw new Error('checkAlbumExists must be implemented by provider');
  }

  /**
   * SEARCH OPERATIONS
   */

  /**
   * Search albums by query
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching albums
   */
  async searchAlbums(query) {
    throw new Error('searchAlbums must be implemented by provider');
  }

  /**
   * Get albums by artist
   * @param {string} artist - Artist name
   * @returns {Promise<Array>} Albums by artist
   */
  async getAlbumsByArtist(artist) {
    throw new Error('getAlbumsByArtist must be implemented by provider');
  }

  /**
   * STATISTICS
   */

  /**
   * Get collection statistics
   * @returns {Promise<Object>} Collection stats
   */
  async getCollectionStats() {
    throw new Error('getCollectionStats must be implemented by provider');
  }

  /**
   * CACHE OPERATIONS
   */

  /**
   * Get cached item
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached data or null
   */
  async getCacheItem(key) {
    throw new Error('getCacheItem must be implemented by provider');
  }

  /**
   * Set cache item
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @returns {Promise<void>}
   */
  async setCacheItem(key, data) {
    throw new Error('setCacheItem must be implemented by provider');
  }

  /**
   * IMAGE OPERATIONS
   */

  /**
   * Save album image
   * @param {string} albumId - Album ID
   * @param {string} imageData - Image data (base64 or URL)
   * @returns {Promise<void>}
   */
  async saveAlbumImage(albumId, imageData) {
    throw new Error('saveAlbumImage must be implemented by provider');
  }

  /**
   * Get album image
   * @param {string} albumId - Album ID
   * @returns {Promise<string|null>} Image data or null
   */
  async getAlbumImage(albumId) {
    throw new Error('getAlbumImage must be implemented by provider');
  }

  /**
   * DATA MIGRATION
   */

  /**
   * Export data
   * @returns {Promise<Object>} Exported data
   */
  async exportData() {
    throw new Error('exportData must be implemented by provider');
  }

  /**
   * Import data
   * @param {Object} data - Data to import
   * @returns {Promise<number>} Number of items imported
   */
  async importData(data) {
    throw new Error('importData must be implemented by provider');
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Initialize the database connection
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('init must be implemented by provider');
  }

  /**
   * Test the database connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    throw new Error('testConnection must be implemented by provider');
  }

  /**
   * Get the provider name
   * @returns {string} Provider name ('indexeddb', 'supabase', 'mock')
   */
  getProviderName() {
    throw new Error('getProviderName must be implemented by provider');
  }

  /**
   * Check if the provider is online/cloud-based
   * @returns {boolean} True if cloud-based
   */
  isCloudProvider() {
    throw new Error('isCloudProvider must be implemented by provider');
  }
}

export default DatabaseInterface;
