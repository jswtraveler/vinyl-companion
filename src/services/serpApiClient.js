/**
 * SerpAPI Client Service - Google Reverse Image Search for Album Identification
 * Provides album cover identification using Google's reverse image search via SerpAPI
 */

class SerpApiError extends Error {
  constructor(message, status, type) {
    super(message);
    this.name = 'SerpApiError';
    this.status = status;
    this.type = type;
  }
}

export class SerpApiClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SERPAPI_KEY : null);
    this.baseUrl = 'https://serpapi.com/search';
    this.proxyUrl = this.getProxyUrl();
    this.requestCount = 0;
    this.lastRequestTime = null;
    this.isMobile = this.detectMobile();
  }

  /**
   * Get the appropriate proxy URL for the current environment
   */
  getProxyUrl() {
    // In production, use the deployed Netlify function
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return `${window.location.origin}/.netlify/functions/serpapi-proxy`;
    }
    // In development, use localhost (Netlify dev should handle this)
    return 'http://localhost:8888/.netlify/functions/serpapi-proxy';
  }

  /**
   * Detect if running on mobile browser
   */
  detectMobile() {
    if (typeof navigator === 'undefined') return false;
    
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get current usage statistics
   */
  getUsageStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      isConfigured: this.isConfigured()
    };
  }

  /**
   * Rate limiting - ensure we don't exceed reasonable limits
   */
  async rateLimit() {
    const now = Date.now();
    if (this.lastRequestTime) {
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minInterval = 1000; // 1 second minimum between requests
      
      if (timeSinceLastRequest < minInterval) {
        const waitTime = minInterval - timeSinceLastRequest;
        console.log(`SerpAPI: Rate limiting - waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Perform reverse image search using SerpAPI (direct or via proxy)
   * @param {string} imageUrl - URL of the image to search
   * @param {Object} options - Additional search options
   * @returns {Promise<Object>} Search results
   */
  async reverseImageSearch(imageUrl, options = {}) {
    if (!this.isConfigured()) {
      throw new SerpApiError('SerpAPI key not configured', 401, 'MISSING_API_KEY');
    }

    await this.rateLimit();

    // Use proxy on mobile browsers or if direct request fails
    if (this.isMobile) {
      console.log('SerpAPI: Using proxy for mobile browser');
      return await this.reverseImageSearchViaProxy(imageUrl, options);
    }

    try {
      // Try direct request first
      return await this.directReverseImageSearch(imageUrl, options);
    } catch (error) {
      console.warn('SerpAPI: Direct request failed, trying proxy:', error.message);
      // Fallback to proxy if direct request fails
      return await this.reverseImageSearchViaProxy(imageUrl, options);
    }
  }

  /**
   * Direct SerpAPI request (original method)
   */
  async directReverseImageSearch(imageUrl, options = {}) {
    const searchParams = new URLSearchParams({
      engine: 'google_reverse_image',
      image_url: imageUrl,
      api_key: this.apiKey,
      ...options
    });

    const url = `${this.baseUrl}?${searchParams.toString()}`;

    console.log('SerpAPI: Performing direct reverse image search...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'VinylCompanion/1.0 (Album Identification)'
      }
    });

    this.requestCount++;

    if (!response.ok) {
      const errorText = await response.text();
      throw new SerpApiError(
        `SerpAPI direct request failed: ${response.status} ${response.statusText}`,
        response.status,
        'API_ERROR'
      );
    }

    const data = await response.json();
    
    if (data.error) {
      throw new SerpApiError(data.error, 400, 'SEARCH_ERROR');
    }

    console.log('SerpAPI: Direct search completed successfully');
    return data;
  }

  /**
   * SerpAPI request via proxy (for mobile browsers)
   */
  async reverseImageSearchViaProxy(imageUrl, options = {}) {
    try {
      console.log('SerpAPI: Performing reverse image search via proxy...');
      
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          apiKey: this.apiKey,
          options
        })
      });

      this.requestCount++;

      if (!response.ok) {
        const errorText = await response.text();
        throw new SerpApiError(
          `Proxy request failed: ${response.status} ${response.statusText}`,
          response.status,
          'PROXY_ERROR'
        );
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new SerpApiError(
          result.error || 'Proxy request failed',
          400,
          'PROXY_ERROR'
        );
      }

      console.log('SerpAPI: Proxy search completed successfully');
      return result.data;

    } catch (error) {
      if (error instanceof SerpApiError) {
        throw error;
      }
      
      console.error('SerpAPI: Proxy request failed:', error);
      throw new SerpApiError(
        `Proxy network error: ${error.message}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Parse search results to extract album information
   * @param {Object} searchResults - Raw SerpAPI results
   * @returns {Array} Parsed album candidates
   */
  parseAlbumResults(searchResults) {
    const candidates = [];

    // Extract from knowledge graph (highest confidence)
    if (searchResults.knowledge_graph) {
      const kg = searchResults.knowledge_graph;
      if (kg.type === 'Album' || kg.type === 'Music Album' || 
          (kg.title && kg.artist)) {
        candidates.push({
          source: 'knowledge_graph',
          confidence: 0.95,
          title: kg.title,
          artist: kg.artist || kg.description,
          year: kg.year,
          type: kg.type,
          description: kg.description,
          thumbnail: kg.thumbnail
        });
      }
    }

    // Extract from image results
    if (searchResults.image_results) {
      searchResults.image_results.forEach((result, index) => {
        const albumInfo = this.extractAlbumFromTitle(result.title);
        if (albumInfo) {
          candidates.push({
            source: 'image_results',
            confidence: Math.max(0.8 - (index * 0.1), 0.3), // Decreasing confidence
            title: albumInfo.title,
            artist: albumInfo.artist,
            url: result.link,
            thumbnail: result.thumbnail,
            originalTitle: result.title,
            position: result.position
          });
        }
      });
    }

    // Extract from inline images
    if (searchResults.inline_images) {
      searchResults.inline_images.forEach((result, index) => {
        const albumInfo = this.extractAlbumFromTitle(result.title);
        if (albumInfo) {
          candidates.push({
            source: 'inline_images',
            confidence: Math.max(0.7 - (index * 0.1), 0.2),
            title: albumInfo.title,
            artist: albumInfo.artist,
            url: result.link,
            thumbnail: result.thumbnail,
            originalTitle: result.title,
            position: index + 1
          });
        }
      });
    }

    // Sort by confidence and remove duplicates
    return this.deduplicateAndSort(candidates);
  }

  /**
   * Extract album information from result titles using pattern matching
   * @param {string} title - Result title to parse
   * @returns {Object|null} Extracted album info or null
   */
  extractAlbumFromTitle(title) {
    if (!title) return null;

    // Common album title patterns
    const patterns = [
      // "Artist - Album Title" or "Artist – Album Title"
      /^(.+?)\s*[-–]\s*(.+?)(?:\s*[-–]\s*(?:Album|LP|CD))?$/i,
      // "Album Title by Artist"
      /^(.+?)\s+by\s+(.+)$/i,
      // "Artist: Album Title"
      /^(.+?):\s*(.+)$/i,
      // Just extract if contains music-related keywords
      /^(.+?)(?:\s*[-–]\s*)?(.+?)(?:\s*(?:album|LP|CD|vinyl|record))/i
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        let [, part1, part2] = match;
        
        // Clean up parts
        part1 = part1.trim().replace(/^["']|["']$/g, '');
        part2 = part2.trim().replace(/^["']|["']$/g, '');
        
        // Determine which is artist and which is album
        // First pattern: Artist - Album
        if (pattern === patterns[0]) {
          return { artist: part1, title: part2 };
        }
        // Second pattern: Album by Artist
        if (pattern === patterns[1]) {
          return { artist: part2, title: part1 };
        }
        // Default: Artist : Album
        return { artist: part1, title: part2 };
      }
    }

    // If no pattern matches but contains music keywords, return as-is
    const musicKeywords = /\b(album|LP|CD|vinyl|record|music|band|artist|song)\b/i;
    if (musicKeywords.test(title)) {
      return { title: title.trim(), artist: null };
    }

    return null;
  }

  /**
   * Remove duplicates and sort by confidence
   * @param {Array} candidates - Array of album candidates
   * @returns {Array} Sorted and deduplicated candidates
   */
  deduplicateAndSort(candidates) {
    // Group by artist + title combination
    const seen = new Map();
    
    candidates.forEach(candidate => {
      const key = `${candidate.artist || ''}|${candidate.title || ''}`.toLowerCase();
      const existing = seen.get(key);
      
      if (!existing || candidate.confidence > existing.confidence) {
        seen.set(key, candidate);
      }
    });

    // Convert back to array and sort by confidence
    return Array.from(seen.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Return top 5 candidates
  }

  /**
   * Get mock results for testing (when API key not available)
   * @param {string} imageUrl - Image URL (for mock context)
   * @returns {Promise<Object>} Mock search results
   */
  async getMockResults(imageUrl) {
    console.log('SerpAPI: Using mock results (no API key configured)');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      search_metadata: {
        status: "Success (Mock)",
        processing_time: 1.2,
        created_at: new Date().toISOString()
      },
      search_parameters: {
        engine: "google_reverse_image",
        image_url: imageUrl
      },
      knowledge_graph: {
        title: "Sample Album",
        artist: "Sample Artist",
        type: "Album",
        year: "2023",
        description: "A sample album for testing purposes"
      },
      image_results: [
        {
          position: 1,
          title: "Sample Artist - Sample Album - Full Album Information",
          link: "https://example.com/album-info",
          source: "discogs.com",
          thumbnail: imageUrl
        },
        {
          position: 2,
          title: "Sample Album by Sample Artist - Vinyl Record",
          link: "https://example.com/vinyl-record",
          source: "musicbrainz.org",
          thumbnail: imageUrl
        }
      ],
      inline_images: []
    };
  }

  /**
   * Main method to identify album from image URL
   * @param {string} imageUrl - URL of album cover image
   * @param {boolean} useMock - Whether to use mock results (for testing)
   * @returns {Promise<Object>} Album identification results
   */
  async identifyAlbum(imageUrl, useMock = false) {
    try {
      let searchResults;
      
      if (useMock || !this.isConfigured()) {
        searchResults = await this.getMockResults(imageUrl);
      } else {
        searchResults = await this.reverseImageSearch(imageUrl);
      }

      const candidates = this.parseAlbumResults(searchResults);
      
      return {
        success: true,
        imageUrl,
        timestamp: new Date().toISOString(),
        searchMetadata: searchResults.search_metadata,
        candidates: candidates,
        topResult: candidates[0] || null,
        requestMethod: this.isMobile ? 'proxy' : 'direct',
        rawResults: searchResults // For debugging/analysis
      };

    } catch (error) {
      console.error('Album identification failed:', error);
      
      return {
        success: false,
        imageUrl,
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          type: error.type || 'UNKNOWN_ERROR',
          status: error.status || 500
        },
        candidates: [],
        topResult: null,
        requestMethod: this.isMobile ? 'proxy' : 'direct'
      };
    }
  }

  /**
   * Get debugging information about the client configuration
   */
  getDebugInfo() {
    return {
      isMobile: this.isMobile,
      isConfigured: this.isConfigured(),
      proxyUrl: this.proxyUrl,
      baseUrl: this.baseUrl,
      requestCount: this.requestCount,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
    };
  }
}

// Export singleton instance
export const serpApiClient = new SerpApiClient();
export default serpApiClient;

// Export error class for external use
export { SerpApiError };