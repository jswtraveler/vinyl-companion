import { MusicBrainzClient, DiscogsClient, CoverArtClient } from './apiClients.js';

/**
 * Album Metadata Enrichment Service
 * Searches multiple APIs to find album metadata and covers
 */
export class MetadataEnricher {
  static cache = new Map();
  static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Search for album metadata using title and artist
   * @param {string} title - Album title
   * @param {string} artist - Artist name
   * @returns {Promise<Array>} Array of enriched album suggestions
   */
  static async searchAlbumMetadata(title, artist) {
    if (!title?.trim() || !artist?.trim()) {
      return [];
    }

    const cacheKey = `${artist.toLowerCase()}_${title.toLowerCase()}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    try {
      const query = `${artist} ${title}`.trim();
      console.log(`Searching metadata for: "${query}"`);

      // Search both APIs in parallel
      const [musicBrainzResults, discogsResults] = await Promise.all([
        MusicBrainzClient.searchReleases(query),
        DiscogsClient.searchReleases(query)
      ]);

      // Combine and rank results
      const allResults = [...musicBrainzResults, ...discogsResults];
      const rankedResults = this.rankResults(allResults, title, artist);

      // Get album covers for top results
      const enrichedResults = await this.addAlbumCovers(rankedResults.slice(0, 5));

      // Cache results
      this.cache.set(cacheKey, {
        data: enrichedResults,
        timestamp: Date.now()
      });

      console.log(`Found ${enrichedResults.length} metadata suggestions`);
      return enrichedResults;

    } catch (error) {
      console.error('Metadata enrichment error:', error);
      return [];
    }
  }

  /**
   * Rank results by relevance to search query
   * @param {Array} results - Combined API results
   * @param {string} searchTitle - Original title search
   * @param {string} searchArtist - Original artist search
   * @returns {Array} Ranked results
   */
  static rankResults(results, searchTitle, searchArtist) {
    return results
      .map(result => ({
        ...result,
        relevanceScore: this.calculateRelevance(result, searchTitle, searchArtist)
      }))
      .sort((a, b) => {
        // Sort by relevance score first, then confidence
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return (b.confidence || 0) - (a.confidence || 0);
      });
  }

  /**
   * Calculate relevance score based on title/artist similarity
   * @param {Object} result - API result
   * @param {string} searchTitle - Original title
   * @param {string} searchArtist - Original artist
   * @returns {number} Relevance score (0-1)
   */
  static calculateRelevance(result, searchTitle, searchArtist) {
    const normalize = str => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    const resultTitle = normalize(result.title || '');
    const resultArtist = normalize(result.artist || '');
    const queryTitle = normalize(searchTitle);
    const queryArtist = normalize(searchArtist);

    // Calculate similarity scores
    const titleScore = this.stringSimilarity(resultTitle, queryTitle);
    const artistScore = this.stringSimilarity(resultArtist, queryArtist);

    // Weight artist match more heavily than title
    return (artistScore * 0.6) + (titleScore * 0.4);
  }

  /**
   * Simple string similarity using common substring ratio
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} Similarity score (0-1)
   */
  static stringSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;

    // Check for exact substring matches
    if (a.includes(b) || b.includes(a)) {
      return 0.8;
    }

    // Simple word overlap scoring
    const wordsA = a.split(' ').filter(w => w.length > 2);
    const wordsB = b.split(' ').filter(w => w.length > 2);
    
    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    const commonWords = wordsA.filter(word => 
      wordsB.some(w => w.includes(word) || word.includes(w))
    ).length;

    return commonWords / Math.max(wordsA.length, wordsB.length);
  }

  /**
   * Add album cover images to metadata results
   * @param {Array} results - Metadata results
   * @returns {Promise<Array>} Results with cover images
   */
  static async addAlbumCovers(results) {
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        let coverUrl = null;

        try {
          // Try MusicBrainz Cover Art Archive first (highest quality)
          if (result.source === 'musicbrainz' && result.id) {
            coverUrl = await CoverArtClient.getCoverArt(result.id);
          }

          // Use Discogs cover if available and no Cover Art Archive found
          if (!coverUrl && result.source === 'discogs' && result.coverImage) {
            coverUrl = result.coverImage;
          }

          return {
            ...result,
            coverUrl,
            hasCover: !!coverUrl
          };

        } catch (error) {
          console.error(`Error fetching cover for ${result.title}:`, error);
          return {
            ...result,
            coverUrl: null,
            hasCover: false
          };
        }
      })
    );

    return enrichedResults;
  }

  /**
   * Get detailed metadata for a specific result
   * @param {Object} result - Selected metadata result
   * @returns {Promise<Object>} Detailed album information
   */
  static async getDetailedMetadata(result) {
    try {
      if (result.source === 'musicbrainz' && result.id) {
        const detailed = await MusicBrainzClient.getReleaseById(result.id);
        if (detailed && detailed.coverUrl === undefined) {
          detailed.coverUrl = await CoverArtClient.getCoverArt(result.id);
        }
        return detailed;
      }

      // For Discogs or other sources, return the result as-is
      return result;

    } catch (error) {
      console.error('Error fetching detailed metadata:', error);
      return result;
    }
  }

  /**
   * Clear the metadata cache
   */
  static clearCache() {
    this.cache.clear();
    console.log('Metadata cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [, value] of this.cache) {
      if (now - value.timestamp < this.CACHE_DURATION) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries
    };
  }
}

/**
 * Utility function to create album object from enriched metadata
 * @param {Object} metadata - Enriched metadata result
 * @param {Object} userOverrides - User-provided field overrides
 * @returns {Object} Album object ready for database
 */
export function createAlbumFromMetadata(metadata, userOverrides = {}) {
  const baseAlbum = {
    title: metadata.title || '',
    artist: metadata.artist || '',
    year: metadata.year || null,
    genre: Array.isArray(metadata.genre) ? metadata.genre : (metadata.genre ? [metadata.genre] : []),
    label: metadata.label || '',
    catalogNumber: metadata.catalogNumber || '',
    format: metadata.format || 'LP',
    country: metadata.country || '',
    coverImage: metadata.coverUrl || '',
    identificationMethod: 'api-enrichment',
    metadata: {
      musicbrainzId: metadata.source === 'musicbrainz' ? metadata.id : null,
      discogsId: metadata.source === 'discogs' ? metadata.id : null,
      source: metadata.source,
      confidence: metadata.confidence || 0.5,
      relevanceScore: metadata.relevanceScore || 0.5
    }
  };

  // Apply user overrides
  return {
    ...baseAlbum,
    ...userOverrides,
    // Ensure metadata is preserved even with overrides
    metadata: {
      ...baseAlbum.metadata,
      ...(userOverrides.metadata || {})
    }
  };
}