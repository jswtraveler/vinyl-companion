import { MusicBrainzClient, DiscogsClient, CoverArtClient } from './apiClients.js';
import { LastFmClient } from './api/music/LastFmClient.js';
import { isValidGenre } from '../data/musicbrainz-genres.js';

// Initialize Last.fm client
const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;
let lastfmClient = null;

// Lazy initialization of Last.fm client
const getLastFmClient = () => {
  if (!lastfmClient && LASTFM_API_KEY) {
    lastfmClient = new LastFmClient(LASTFM_API_KEY);
  }
  return lastfmClient;
};

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
    // Allow search with either title or artist (or both)
    if (!title?.trim() && !artist?.trim()) {
      return [];
    }

    // Create cache key from available fields
    const titlePart = title?.trim() ? title.toLowerCase() : 'no-title';
    const artistPart = artist?.trim() ? artist.toLowerCase() : 'no-artist';
    const cacheKey = `${artistPart}_${titlePart}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    try {
      // Build query from available fields
      const queryParts = [];
      if (artist?.trim()) queryParts.push(artist.trim());
      if (title?.trim()) queryParts.push(title.trim());
      const query = queryParts.join(' ');
      
      console.log(`Searching metadata for: "${query}" (artist: ${artist?.trim() || 'none'}, title: ${title?.trim() || 'none'})`);

      // Search both APIs in parallel
      const [musicBrainzResults, discogsResults] = await Promise.all([
        MusicBrainzClient.searchReleases(query),
        DiscogsClient.searchReleases(query)
      ]);

      // Combine and rank results (prioritize Discogs for vinyl collection)
      const allResults = [...discogsResults, ...musicBrainzResults];
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
      .map(result => {
        let relevanceScore = this.calculateRelevance(result, searchTitle, searchArtist);
        
        // Give Discogs results a bonus for vinyl collections (prioritize vinyl marketplace)
        if (result.source === 'discogs') {
          relevanceScore += 0.1; // 10% bonus for Discogs results
        }
        
        return {
          ...result,
          relevanceScore
        };
      })
      .sort((a, b) => {
        // Sort by relevance score first (now includes Discogs bonus), then confidence
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
    const queryTitle = normalize(searchTitle || '');
    const queryArtist = normalize(searchArtist || '');

    // Calculate similarity scores
    const titleScore = queryTitle ? this.stringSimilarity(resultTitle, queryTitle) : 0;
    const artistScore = queryArtist ? this.stringSimilarity(resultArtist, queryArtist) : 0;

    // Handle cases where only one field is available
    if (!queryTitle && queryArtist) {
      // Only artist provided - weight artist match heavily
      return artistScore;
    } else if (queryTitle && !queryArtist) {
      // Only title provided - weight title match heavily
      return titleScore;
    } else {
      // Both fields provided - use weighted scoring
      return (artistScore * 0.6) + (titleScore * 0.4);
    }
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
   * Add album cover images and Last.fm tags to metadata results
   * @param {Array} results - Metadata results
   * @returns {Promise<Array>} Results with cover images and tags
   */
  static async addAlbumCovers(results) {
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        let coverUrl = null;
        let lastfmTags = [];

        try {
          // Try MusicBrainz Cover Art Archive first (highest quality)
          if (result.source === 'musicbrainz' && result.id) {
            coverUrl = await CoverArtClient.getCoverArt(result.id);
          }

          // Use Discogs cover if available and no Cover Art Archive found
          if (!coverUrl && result.source === 'discogs' && result.coverImage) {
            coverUrl = result.coverImage;
          }

          // Fetch Last.fm tags for the album
          lastfmTags = await this.fetchLastFmTags(result.artist, result.title);

          return {
            ...result,
            coverUrl,
            hasCover: !!coverUrl,
            lastfmTags
          };

        } catch (error) {
          console.error(`Error fetching cover for ${result.title}:`, error);
          return {
            ...result,
            coverUrl: null,
            hasCover: false,
            lastfmTags: []
          };
        }
      })
    );

    return enrichedResults;
  }

  /**
   * Fetch Last.fm tags for an album
   * @param {string} artist - Artist name
   * @param {string} album - Album title
   * @returns {Promise<Array>} Array of genre/tag strings
   */
  static async fetchLastFmTags(artist, album) {
    const client = getLastFmClient();
    if (!client || !artist || !album) {
      return [];
    }

    try {
      console.log(`🎵 Fetching Last.fm tags for: ${artist} - ${album}`);
      const albumInfo = await client.getAlbumInfo(artist, album);

      if (albumInfo?.album?.tags?.tag) {
        const tags = Array.isArray(albumInfo.album.tags.tag)
          ? albumInfo.album.tags.tag
          : [albumInfo.album.tags.tag];

        // Filter tags against MusicBrainz genre whitelist
        const genreTags = tags
          .map(tag => {
            const name = typeof tag === 'string' ? tag : tag.name;
            return name;
          })
          .filter(tagName => {
            // Check if tag is a valid MusicBrainz genre
            if (!isValidGenre(tagName)) {
              console.log(`  ⏭️  Skipping invalid genre tag "${tagName}" (not in MusicBrainz)`);
              return false;
            }
            return true;
          })
          .slice(0, 5) // Take top 5 after filtering
          .map(tagName => this.capitalizeGenre(tagName))
          .filter(Boolean);

        console.log(`🎵 Found ${genreTags.length} valid MusicBrainz genres:`, genreTags);
        return genreTags;
      }

      return [];
    } catch (error) {
      console.error(`Error fetching Last.fm tags for ${artist} - ${album}:`, error);
      return [];
    }
  }

  /**
   * Capitalize genre names properly
   * @param {string} genre - Genre name
   * @returns {string} Properly capitalized genre
   */
  static capitalizeGenre(genre) {
    if (!genre) return '';

    // Special cases
    const specialCases = {
      'r&b': 'R&B',
      'rnb': 'R&B',
      'hiphop': 'Hip Hop',
      'hip-hop': 'Hip Hop',
      'hip hop': 'Hip Hop',
      'dnb': 'Drum & Bass',
      'drum and bass': 'Drum & Bass',
      'uk garage': 'UK Garage',
      'edm': 'EDM'
    };

    const lower = genre.toLowerCase().trim();
    if (specialCases[lower]) {
      return specialCases[lower];
    }

    // Title case for normal genres
    return genre
      .split(/[\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
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
  // Merge genres from different sources
  const genresFromApi = Array.isArray(metadata.genre) ? metadata.genre : (metadata.genre ? [metadata.genre] : []);
  const genresFromLastFm = metadata.lastfmTags || [];

  // Combine and deduplicate genres (prioritize Last.fm tags as they're more specific)
  const allGenres = [...new Set([...genresFromLastFm, ...genresFromApi])];

  const baseAlbum = {
    title: metadata.title || '',
    artist: metadata.artist || '',
    year: metadata.year || null,
    genre: allGenres,
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
      relevanceScore: metadata.relevanceScore || 0.5,
      lastfmTagCount: genresFromLastFm.length
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