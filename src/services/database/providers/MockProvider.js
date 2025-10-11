/**
 * Mock Provider
 *
 * In-memory mock implementation for testing.
 * Does not persist data - resets on page reload.
 */

import { DatabaseInterface } from '../DatabaseInterface.js';

export class MockProvider extends DatabaseInterface {
  constructor() {
    super();
    this.albums = [];
    this.cache = new Map();
    this.images = new Map();
    this.nextId = 1;
  }

  /**
   * Initialize mock database
   */
  async init() {
    console.log('Mock database initialized');
    return true;
  }

  /**
   * ALBUM OPERATIONS
   */

  async getAllAlbums(options = {}) {
    let results = [...this.albums];

    // Apply filters
    if (options.artist) {
      results = results.filter(a =>
        a.artist.toLowerCase().includes(options.artist.toLowerCase())
      );
    }
    if (options.title) {
      results = results.filter(a =>
        a.title.toLowerCase().includes(options.title.toLowerCase())
      );
    }
    if (options.year) {
      results = results.filter(a => a.year === options.year);
    }
    if (options.genre) {
      results = results.filter(a =>
        a.genre && a.genre.includes(options.genre)
      );
    }

    return results.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }

  async getAlbum(id) {
    const album = this.albums.find(a => a.id === id);
    return album || null;
  }

  async addAlbum(albumData) {
    const album = {
      ...albumData,
      id: albumData.id || `mock_album_${this.nextId++}`,
      dateAdded: albumData.dateAdded || new Date().toISOString()
    };

    this.albums.push(album);
    console.log('Mock album added:', album.title);
    return album;
  }

  async updateAlbum(id, albumData) {
    const index = this.albums.findIndex(a => a.id === id);
    if (index === -1) {
      throw new Error('Album not found');
    }

    this.albums[index] = {
      ...albumData,
      id: id,
      dateModified: new Date().toISOString()
    };

    console.log('Mock album updated:', this.albums[index].title);
    return this.albums[index];
  }

  async deleteAlbum(id) {
    const index = this.albums.findIndex(a => a.id === id);
    if (index === -1) {
      throw new Error('Album not found');
    }

    this.albums.splice(index, 1);
    this.images.delete(id);

    console.log('Mock album deleted');
    return true;
  }

  async checkAlbumExists(artist, title) {
    const existing = this.albums.find(
      a =>
        a.artist.toLowerCase().trim() === artist.toLowerCase().trim() &&
        a.title.toLowerCase().trim() === title.toLowerCase().trim()
    );
    return existing || null;
  }

  /**
   * SEARCH OPERATIONS
   */

  async searchAlbums(query) {
    const lowercaseQuery = query.toLowerCase();
    return this.albums.filter(
      album =>
        album.title.toLowerCase().includes(lowercaseQuery) ||
        album.artist.toLowerCase().includes(lowercaseQuery) ||
        (album.genre && album.genre.some(g => g.toLowerCase().includes(lowercaseQuery)))
    );
  }

  async getAlbumsByArtist(artist) {
    return this.albums.filter(a =>
      a.artist.toLowerCase().includes(artist.toLowerCase())
    );
  }

  /**
   * STATISTICS
   */

  async getCollectionStats() {
    if (this.albums.length === 0) {
      return {
        total_albums: 0,
        unique_artists: 0,
        oldest_album: null,
        newest_album: null,
        average_rating: 0,
        total_spent: 0
      };
    }

    const artistSet = new Set(this.albums.map(a => a.artist));
    const years = this.albums.map(a => a.year).filter(Boolean);
    const ratings = this.albums.map(a => a.rating).filter(Boolean);
    const prices = this.albums.map(a => a.purchasePrice).filter(Boolean);

    return {
      total_albums: this.albums.length,
      unique_artists: artistSet.size,
      oldest_album: years.length > 0 ? Math.min(...years) : null,
      newest_album: years.length > 0 ? Math.max(...years) : null,
      average_rating:
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      total_spent: prices.reduce((a, b) => a + b, 0)
    };
  }

  /**
   * CACHE OPERATIONS
   */

  async getCacheItem(key) {
    return this.cache.get(key) || null;
  }

  async setCacheItem(key, data) {
    this.cache.set(key, data);
  }

  /**
   * IMAGE OPERATIONS
   */

  async saveAlbumImage(albumId, imageData) {
    this.images.set(albumId, imageData);
  }

  async getAlbumImage(albumId) {
    return this.images.get(albumId) || null;
  }

  /**
   * DATA MIGRATION
   */

  async exportData() {
    return {
      albums: [...this.albums],
      exportDate: new Date().toISOString(),
      version: 1,
      provider: 'mock'
    };
  }

  async importData(data) {
    if (!data.albums) throw new Error('Invalid import data');

    this.albums = [...data.albums];
    return data.albums.length;
  }

  /**
   * UTILITY METHODS
   */

  async testConnection() {
    console.log('✅ Mock database connection successful');
    return true;
  }

  getProviderName() {
    return 'mock';
  }

  isCloudProvider() {
    return false;
  }

  /**
   * TESTING HELPERS
   */

  /**
   * Clear all data (useful for tests)
   */
  clear() {
    this.albums = [];
    this.cache.clear();
    this.images.clear();
    this.nextId = 1;
  }

  /**
   * Seed with test data
   */
  seedTestData(count = 5) {
    const artists = ['Radiohead', 'The National', 'Arcade Fire', 'Bon Iver', 'Sigur Rós'];
    const genres = [['Indie', 'Rock'], ['Alternative'], ['Folk'], ['Electronic'], ['Ambient']];

    for (let i = 0; i < count; i++) {
      this.albums.push({
        id: `test_album_${i + 1}`,
        title: `Test Album ${i + 1}`,
        artist: artists[i % artists.length],
        year: 2020 + i,
        genre: genres[i % genres.length],
        format: 'LP',
        condition: 'Near Mint',
        dateAdded: new Date(Date.now() - i * 86400000).toISOString()
      });
    }

    console.log(`Seeded ${count} test albums`);
  }
}

export default MockProvider;
