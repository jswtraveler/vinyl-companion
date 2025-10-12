/**
 * Spotify API Client
 * Uses Supabase Edge Function proxy to keep credentials secure
 */

import { supabase } from '../../database/supabaseClient.js';

export class SpotifyClient {
  constructor() {
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.lastRequestTime = 0;
    this.minRequestInterval = 50; // Rate limiting
  }

  /**
   * Make a request through the Spotify Edge Function proxy
   * @param {string} action - Action to perform
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} API response
   */
  async makeProxyRequest(action, params = {}) {
    try {
      console.log('🎵 Calling Spotify proxy with:', { action, ...params });

      const { data, error } = await supabase.functions.invoke('spotify-proxy', {
        body: { action, ...params }
      });

      console.log('🎵 Spotify proxy response:', { data, error });

      if (error) {
        console.error('Spotify proxy error object:', error);
        console.error('Error message:', error.message);
        console.error('Error context:', error.context);
        throw new Error(`Spotify proxy error: ${error.message}`);
      }

      if (!data) {
        console.error('No data returned from Spotify proxy');
        throw new Error('No data returned from Spotify proxy');
      }

      if (!data.success) {
        console.error('Spotify proxy returned error:', data.error);
        console.error('Error details:', data.details);
        throw new Error(data.error || 'Unknown error');
      }

      return data.data;
    } catch (error) {
      console.error('Failed to call Spotify proxy:', error);
      throw error;
    }
  }

  /**
   * Make a rate-limited request
   * @param {string} cacheKey - Cache key
   * @param {Function} requestFn - Function that makes the request
   * @param {number} cacheTTL - Cache time-to-live in milliseconds
   * @returns {Promise<Object>} API response
   */
  async makeRequest(cacheKey, requestFn, cacheTTL = 24 * 60 * 60 * 1000) {
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTTL) {
        console.log(`🎵 Spotify cache hit: ${cacheKey}`);
        return cached.data;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    // Add to request queue
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        cacheKey,
        requestFn,
        resolve,
        reject
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();

      try {
        // Ensure rate limiting
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
          await this.delay(this.minRequestInterval - timeSinceLastRequest);
        }

        const data = await request.requestFn();

        // Cache the response
        this.cache.set(request.cacheKey, {
          data,
          timestamp: Date.now()
        });

        this.lastRequestTime = Date.now();
        request.resolve(data);

      } catch (error) {
        console.error(`Spotify API error:`, error);
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Delay helper for rate limiting
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Search for an artist by name
   * @param {string} artistName - Artist name to search for
   * @param {number} limit - Maximum number of results (default: 1)
   * @returns {Promise<Object>} Search results
   */
  async searchArtist(artistName, limit = 1) {
    if (!artistName) throw new Error('Artist name is required');

    const cacheKey = `spotify_search_${artistName.toLowerCase().trim()}`;

    return this.makeRequest(
      cacheKey,
      () => this.makeProxyRequest('search', { artistName }),
      24 * 60 * 60 * 1000 // 24 hour cache
    );
  }

  /**
   * Get artist image URL
   * @param {string} artistName - Artist name
   * @returns {Promise<string|null>} Image URL (highest resolution) or null if not found
   */
  async getArtistImage(artistName) {
    try {
      const result = await this.searchArtist(artistName, 1);

      if (result) {
        console.log(`✅ Found Spotify image for ${artistName}`);
        return {
          url: result.image,
          width: result.imageWidth,
          height: result.imageHeight,
          spotifyId: result.id,
          spotifyUrl: result.spotifyUrl
        };
      }

      console.log(`⚠️ No Spotify image found for ${artistName}`);
      return null;

    } catch (error) {
      console.error(`❌ Error fetching Spotify image for ${artistName}:`, error);
      return null;
    }
  }

  /**
   * Get images for multiple artists (batched)
   * @param {Array<string>} artistNames - Array of artist names
   * @param {Function} onProgress - Progress callback (current, total, artistName)
   * @returns {Promise<Object>} Map of artistName -> image data
   */
  async getArtistImages(artistNames, onProgress = null) {
    const results = {};
    let processed = 0;

    for (const artistName of artistNames) {
      const imageData = await this.getArtistImage(artistName);
      results[artistName] = imageData;

      processed++;
      if (onProgress) {
        onProgress(processed, artistNames.length, artistName);
      }
    }

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Spotify cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      totalEntries: this.cache.size,
      queueLength: this.requestQueue.length
    };
  }
}

export default SpotifyClient;
