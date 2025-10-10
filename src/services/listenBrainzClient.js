/**
 * ListenBrainz API Client
 * Open source music discovery service with native MusicBrainz ID integration
 * Uses Supabase Edge Function proxy to keep token secure
 */

import { supabase } from './supabase.js';

export class ListenBrainzClient {
  constructor(options = {}) {
    this.baseURL = 'https://api.listenbrainz.org';
    this.userToken = options.userToken || null;
    this.useProxy = !this.userToken; // Use proxy if no token provided
    this.options = {
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      enableCaching: true,
      cacheExpirationHours: 24,
      ...options
    };

    // In-memory cache for API responses
    this.cache = new Map();
    this.storageKey = 'listenbrainz_cache';

    // Load cached data from localStorage
    this.loadCacheFromStorage();

    if (this.useProxy) {
      console.log('🎵 ListenBrainz client using Edge Function proxy');
    }
  }

  /**
   * Get similar artists for a given artist MBID
   * @param {string} artistMBID - MusicBrainz artist ID
   * @param {number} limit - Maximum number of similar artists to return
   * @returns {Promise<Object>} Similar artists data
   */
  async getSimilarArtists(artistMBID, limit = 25) {
    if (!artistMBID) {
      throw new Error('Artist MBID is required');
    }

    const endpoint = `/1/explore/similar-artists/${artistMBID}`;
    const cacheKey = `similar_artists_${artistMBID}_${limit}`;

    return this.makeRequest(endpoint, { limit }, cacheKey);
  }

  /**
   * Get artist statistics and listening data
   * @param {string} artistMBID - MusicBrainz artist ID
   * @returns {Promise<Object>} Artist statistics
   */
  async getArtistStats(artistMBID) {
    if (!artistMBID) {
      throw new Error('Artist MBID is required');
    }

    const endpoint = `/1/stats/artist/${artistMBID}`;
    const cacheKey = `artist_stats_${artistMBID}`;

    return this.makeRequest(endpoint, {}, cacheKey);
  }

  /**
   * Get recording information by MBID
   * @param {string} recordingMBID - MusicBrainz recording ID
   * @returns {Promise<Object>} Recording data
   */
  async getRecording(recordingMBID) {
    if (!recordingMBID) {
      throw new Error('Recording MBID is required');
    }

    const endpoint = `/1/explore/recording/${recordingMBID}`;
    const cacheKey = `recording_${recordingMBID}`;

    return this.makeRequest(endpoint, {}, cacheKey);
  }

  /**
   * Search for artists by name (fallback when MBID not available)
   * @param {string} artistName - Artist name to search
   * @returns {Promise<Object>} Search results with MBIDs
   */
  async searchArtists(artistName) {
    if (!artistName) {
      throw new Error('Artist name is required');
    }

    // ListenBrainz doesn't have direct search, so we'll use MusicBrainz search
    // and then fetch ListenBrainz data for found MBIDs
    const searchEndpoint = 'https://musicbrainz.org/ws/2/artist';
    const params = new URLSearchParams({
      query: `artist:"${artistName}"`,
      fmt: 'json',
      limit: 5
    });

    try {
      const response = await fetch(`${searchEndpoint}?${params}`, {
        headers: {
          'User-Agent': 'VinylCollectionApp/1.0 (contact@example.com)'
        }
      });

      if (!response.ok) {
        throw new Error(`MusicBrainz search failed: ${response.status}`);
      }

      const data = await response.json();
      const artists = data.artists || [];

      // For each found artist, try to get ListenBrainz data
      const enrichedArtists = [];
      for (const artist of artists.slice(0, 3)) { // Limit to top 3 matches
        try {
          const similarArtists = await this.getSimilarArtists(artist.id);
          enrichedArtists.push({
            ...artist,
            listenbrainz_data: similarArtists
          });
        } catch (error) {
          // Include artist even if ListenBrainz data unavailable
          enrichedArtists.push(artist);
        }
      }

      return {
        artists: enrichedArtists,
        total: data.count || 0
      };

    } catch (error) {
      console.error('Artist search failed:', error);
      throw error;
    }
  }

  /**
   * Get recommendation statistics and coverage info
   * @returns {Promise<Object>} Service statistics
   */
  async getServiceStats() {
    try {
      const endpoint = '/1/stats/sitewide/artists';
      return this.makeRequest(endpoint, {}, 'service_stats');
    } catch (error) {
      console.warn('Failed to fetch service stats:', error);
      return {
        artists_covered: 'unknown',
        last_updated: 'unknown'
      };
    }
  }

  /**
   * Make HTTP request with caching, retries, and error handling
   * @private
   */
  async makeRequest(endpoint, params = {}, cacheKey = null) {
    // Check cache first
    if (cacheKey && this.options.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Use Edge Function proxy if no token provided
    if (this.useProxy) {
      return this.executeProxyRequest(endpoint, params, cacheKey);
    }

    // Direct API call (legacy support)
    const url = new URL(endpoint, this.baseURL);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    let lastError;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        console.log(`🎵 ListenBrainz API call: ${url.pathname} (attempt ${attempt})`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        const headers = {
          'Accept': 'application/json',
          'User-Agent': 'VinylCollectionApp/1.0'
        };

        // Add authorization header if user token is available
        if (this.userToken) {
          headers['Authorization'] = `Token ${this.userToken}`;
        }

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: headers
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache successful responses
        if (cacheKey && this.options.enableCaching) {
          this.setCache(cacheKey, data);
        }

        console.log(`✅ ListenBrainz API success: ${url.pathname}`);
        return data;

      } catch (error) {
        lastError = error;
        console.warn(`❌ ListenBrainz API attempt ${attempt} failed:`, error.message);

        if (attempt < this.options.maxRetries) {
          await this.delay(this.options.retryDelay * attempt);
        }
      }
    }

    throw new Error(`ListenBrainz API failed after ${this.options.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Execute request through Edge Function proxy
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @param {string} cacheKey - Cache key for result
   * @returns {Promise<Object>} API response
   */
  async executeProxyRequest(endpoint, params, cacheKey = null) {
    try {
      const { data, error } = await supabase.functions.invoke('listenbrainz-proxy', {
        body: { endpoint, params }
      });

      if (error) {
        console.error('ListenBrainz proxy error:', error);
        throw new Error(`ListenBrainz proxy error: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      // Cache successful responses
      if (cacheKey && this.options.enableCaching) {
        this.setCache(cacheKey, data.data);
      }

      return data.data;
    } catch (error) {
      console.error('Failed to call ListenBrainz proxy:', error);
      throw error;
    }
  }

  /**
   * Get item from cache
   * @private
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const expirationTime = this.options.cacheExpirationHours * 60 * 60 * 1000;
    if (Date.now() - cached.timestamp > expirationTime) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set item in cache
   * @private
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Persist to localStorage
    this.saveCacheToStorage();
  }

  /**
   * Load cache from localStorage
   * @private
   */
  loadCacheFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load ListenBrainz cache from storage:', error);
    }
  }

  /**
   * Save cache to localStorage
   * @private
   */
  saveCacheToStorage() {
    try {
      const data = Array.from(this.cache.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save ListenBrainz cache to storage:', error);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear ListenBrainz cache from storage:', error);
    }
    console.log('🎵 ListenBrainz cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const totalSize = JSON.stringify(entries).length;
    const validEntries = entries.filter(entry => {
      const expirationTime = this.options.cacheExpirationHours * 60 * 60 * 1000;
      return Date.now() - entry.timestamp <= expirationTime;
    });

    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      totalSize: `${(totalSize / 1024).toFixed(1)}KB`,
      hitRate: this.cache.size > 0 ? `${((validEntries.length / this.cache.size) * 100).toFixed(1)}%` : '0%'
    };
  }

  /**
   * Format similar artists data for recommendation engine
   * @param {Object} similarArtistsData - Raw ListenBrainz similar artists response
   * @returns {Array} Formatted similar artists
   */
  formatSimilarArtists(similarArtistsData) {
    if (!similarArtistsData?.similar_artists) {
      return [];
    }

    return similarArtistsData.similar_artists.map(artist => ({
      name: artist.artist_name,
      mbid: artist.artist_mbid,
      similarity: artist.similarity_score || 0,
      listeners: artist.total_listen_count || 0,
      metadata: {
        source: 'listenbrainz',
        reference_mbid: similarArtistsData.artist_mbid,
        algorithm: 'collaborative_filtering'
      }
    }));
  }

  /**
   * Delay helper for retries
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ListenBrainzClient;