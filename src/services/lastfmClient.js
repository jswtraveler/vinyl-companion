/**
 * Last.fm API Client
 * Handles authenticated requests to Last.fm web services for music data
 */

export class LastFmClient {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Last.fm API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = 'https://ws.audioscrobbler.com/2.0/';
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests to respect rate limits
  }

  /**
   * Make a rate-limited request to Last.fm API
   * @param {string} method - Last.fm API method
   * @param {Object} params - Request parameters
   * @param {number} cacheTTL - Cache time-to-live in milliseconds (default: 24 hours)
   * @returns {Promise<Object>} API response
   */
  async makeRequest(method, params = {}, cacheTTL = 24 * 60 * 60 * 1000) {
    const cacheKey = this.generateCacheKey(method, params);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTTL) {
        console.log(`🎵 Last.fm cache hit: ${method}`);
        return cached.data;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    // Add to request queue
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        method,
        params,
        cacheKey,
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

        const data = await this.executeRequest(request.method, request.params);

        // Cache the response
        this.cache.set(request.cacheKey, {
          data,
          timestamp: Date.now()
        });

        this.lastRequestTime = Date.now();
        request.resolve(data);

      } catch (error) {
        console.error(`Last.fm API error for ${request.method}:`, error);
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute the actual HTTP request
   * @param {string} method - API method
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} API response
   */
  async executeRequest(method, params) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('method', method);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('format', 'json');

    // Add custom parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, value.toString());
      }
    });

    console.log(`🎵 Last.fm API request: ${method} with params:`, params);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'VinylCompanion/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      throw new Error(`Last.fm API error: ${data.message} (Code: ${data.error})`);
    }

    return data;
  }

  /**
   * Generate cache key for request
   * @param {string} method - API method
   * @param {Object} params - Parameters
   * @returns {string} Cache key
   */
  generateCacheKey(method, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `lastfm_${method}_${sortedParams}`;
  }

  /**
   * Delay helper for rate limiting
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Core API Methods

  /**
   * Get similar artists to a given artist
   * @param {string} artist - Artist name
   * @param {number} limit - Maximum number of results (default: 50)
   * @returns {Promise<Object>} Similar artists data
   */
  async getSimilarArtists(artist, limit = 50) {
    if (!artist) throw new Error('Artist name is required');

    return this.makeRequest('artist.getsimilar', {
      artist: artist.trim(),
      limit: Math.min(limit, 100) // Last.fm max is 100
    });
  }

  /**
   * Get top albums for a specific tag
   * @param {string} tag - Tag/genre name
   * @param {number} limit - Maximum number of results (default: 50)
   * @returns {Promise<Object>} Top albums by tag
   */
  async getTopAlbumsByTag(tag, limit = 50) {
    if (!tag) throw new Error('Tag is required');

    return this.makeRequest('tag.gettopalbums', {
      tag: tag.trim(),
      limit: Math.min(limit, 100)
    });
  }

  /**
   * Get artist information including tags and bio
   * @param {string} artist - Artist name
   * @param {string} lang - Language for biography (default: 'en')
   * @returns {Promise<Object>} Artist information
   */
  async getArtistInfo(artist, lang = 'en') {
    if (!artist) throw new Error('Artist name is required');

    return this.makeRequest('artist.getinfo', {
      artist: artist.trim(),
      lang
    });
  }

  /**
   * Get album information including tracks and tags
   * @param {string} artist - Artist name
   * @param {string} album - Album name
   * @returns {Promise<Object>} Album information
   */
  async getAlbumInfo(artist, album) {
    if (!artist || !album) throw new Error('Artist and album names are required');

    return this.makeRequest('album.getinfo', {
      artist: artist.trim(),
      album: album.trim()
    });
  }

  /**
   * Get top artists for a specific tag
   * @param {string} tag - Tag/genre name
   * @param {number} limit - Maximum number of results (default: 50)
   * @returns {Promise<Object>} Top artists by tag
   */
  async getTopArtistsByTag(tag, limit = 50) {
    if (!tag) throw new Error('Tag is required');

    return this.makeRequest('tag.gettopartists', {
      tag: tag.trim(),
      limit: Math.min(limit, 100)
    });
  }

  /**
   * Get top tags (genres) from Last.fm
   * @param {number} limit - Maximum number of results (default: 100)
   * @returns {Promise<Object>} Top tags
   */
  async getTopTags(limit = 100) {
    return this.makeRequest('tag.gettoptags', {
      limit: Math.min(limit, 1000)
    });
  }

  /**
   * Search for artists
   * @param {string} artist - Artist name to search for
   * @param {number} limit - Maximum number of results (default: 30)
   * @returns {Promise<Object>} Artist search results
   */
  async searchArtist(artist, limit = 30) {
    if (!artist) throw new Error('Artist name is required');

    return this.makeRequest('artist.search', {
      artist: artist.trim(),
      limit: Math.min(limit, 100)
    });
  }

  /**
   * Search for albums
   * @param {string} album - Album name to search for
   * @param {number} limit - Maximum number of results (default: 30)
   * @returns {Promise<Object>} Album search results
   */
  async searchAlbum(album, limit = 30) {
    if (!album) throw new Error('Album name is required');

    return this.makeRequest('album.search', {
      album: album.trim(),
      limit: Math.min(limit, 100)
    });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp < 24 * 60 * 60 * 1000) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      queueLength: this.requestQueue.length
    };
  }

  /**
   * Clear expired cache entries
   * @returns {number} Number of entries cleared
   */
  clearExpiredCache() {
    const now = Date.now();
    let cleared = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= 24 * 60 * 60 * 1000) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default LastFmClient;