/**
 * Spotify API Client
 * Uses Client Credentials Flow for public data access (artist info, images, etc.)
 */

export class SpotifyClient {
  constructor(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
      throw new Error('Spotify Client ID and Client Secret are required');
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = 'https://api.spotify.com/v1';
    this.tokenUrl = 'https://accounts.spotify.com/api/token';

    this.accessToken = null;
    this.tokenExpiry = null;
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.lastRequestTime = 0;
    this.minRequestInterval = 50; // Spotify allows ~20 requests per second, be conservative
  }

  /**
   * Get access token using Client Credentials Flow
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🎵 Requesting new Spotify access token...');

    try {
      const credentials = btoa(`${this.clientId}:${this.clientSecret}`);

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`Spotify auth failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry with 5 minute buffer
      this.tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);

      console.log('✅ Spotify access token obtained, expires in', data.expires_in, 'seconds');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get Spotify access token:', error);
      throw error;
    }
  }

  /**
   * Make a rate-limited request to Spotify API
   * @param {string} endpoint - API endpoint (e.g., '/search')
   * @param {Object} params - Query parameters
   * @param {number} cacheTTL - Cache time-to-live in milliseconds (default: 24 hours)
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, params = {}, cacheTTL = 24 * 60 * 60 * 1000) {
    const cacheKey = this.generateCacheKey(endpoint, params);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTTL) {
        console.log(`🎵 Spotify cache hit: ${endpoint}`);
        return cached.data;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    // Add to request queue
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        endpoint,
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

        const data = await this.executeRequest(request.endpoint, request.params);

        // Cache the response
        this.cache.set(request.cacheKey, {
          data,
          timestamp: Date.now()
        });

        this.lastRequestTime = Date.now();
        request.resolve(data);

      } catch (error) {
        console.error(`Spotify API error for ${request.endpoint}:`, error);
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute the actual HTTP request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} API response
   */
  async executeRequest(endpoint, params) {
    const token = await this.getAccessToken();

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, value.toString());
      }
    });

    console.log(`🎵 Spotify API request: ${endpoint}`);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      // Token might have expired, try refreshing once
      if (response.status === 401) {
        console.log('🔄 Spotify token expired, refreshing...');
        this.accessToken = null;
        this.tokenExpiry = null;
        const newToken = await this.getAccessToken();

        // Retry request with new token
        const retryResponse = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${newToken}`
          }
        });

        if (!retryResponse.ok) {
          throw new Error(`Spotify API error: ${retryResponse.status} ${retryResponse.statusText}`);
        }

        return retryResponse.json();
      }

      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate cache key for request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Parameters
   * @returns {string} Cache key
   */
  generateCacheKey(endpoint, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `spotify_${endpoint}_${sortedParams}`;
  }

  /**
   * Delay helper for rate limiting
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // API Methods

  /**
   * Search for an artist by name
   * @param {string} artistName - Artist name to search for
   * @param {number} limit - Maximum number of results (default: 1)
   * @returns {Promise<Object>} Search results
   */
  async searchArtist(artistName, limit = 1) {
    if (!artistName) throw new Error('Artist name is required');

    return this.makeRequest('/search', {
      q: artistName.trim(),
      type: 'artist',
      limit: Math.min(limit, 50)
    });
  }

  /**
   * Get artist information by Spotify ID
   * @param {string} artistId - Spotify artist ID
   * @returns {Promise<Object>} Artist information
   */
  async getArtist(artistId) {
    if (!artistId) throw new Error('Artist ID is required');

    return this.makeRequest(`/artists/${artistId}`);
  }

  /**
   * Get artist image URL
   * @param {string} artistName - Artist name
   * @returns {Promise<string|null>} Image URL (highest resolution) or null if not found
   */
  async getArtistImage(artistName) {
    try {
      const searchResults = await this.searchArtist(artistName, 1);

      if (searchResults?.artists?.items && searchResults.artists.items.length > 0) {
        const artist = searchResults.artists.items[0];

        // Spotify returns images sorted by size (largest first)
        if (artist.images && artist.images.length > 0) {
          console.log(`✅ Found Spotify image for ${artistName}`);
          return {
            url: artist.images[0].url, // Largest image
            width: artist.images[0].width,
            height: artist.images[0].height,
            spotifyId: artist.id,
            spotifyUrl: artist.external_urls.spotify
          };
        }
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
      queueLength: this.requestQueue.length,
      hasValidToken: !!(this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry)
    };
  }
}

export default SpotifyClient;
