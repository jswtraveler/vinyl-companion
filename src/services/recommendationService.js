/**
 * Recommendation Service
 * Main orchestrator for the album recommendation engine
 * Combines user profile analysis, external data fetching, and caching
 */

import LastFmClient from './lastfmClient.js';
import RecommendationDataFetcher from './recommendationDataFetcher.js';
import CollectionProfiler from './collectionProfiler.js';
import { AlbumNormalizer } from '../utils/albumNormalization.js';

export class RecommendationService {
  constructor(options = {}) {
    // Configuration
    this.config = {
      lastfmApiKey: import.meta.env.VITE_LASTFM_API_KEY,
      enableCaching: true,
      cacheExpirationHours: 24,
      minCollectionSize: 3, // Minimum albums needed for recommendations
      maxCandidates: 1000,
      ...options
    };

    // Services
    this.lastfmClient = null;
    this.dataFetcher = null;
    this.currentProfile = null;
    this.currentData = null;

    // Cache (in-memory for now, could be moved to IndexedDB/Supabase later)
    this.cache = {
      profiles: new Map(),
      externalData: new Map(),
      recommendations: new Map()
    };

    this.initialize();
  }

  /**
   * Initialize the recommendation service
   */
  initialize() {
    try {
      if (!this.config.lastfmApiKey) {
        console.warn('⚠️ Last.fm API key not found. External recommendations will be limited.');
        return;
      }

      this.lastfmClient = new LastFmClient(this.config.lastfmApiKey);
      this.dataFetcher = new RecommendationDataFetcher(this.lastfmClient);

      console.log('🎵 Recommendation service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize recommendation service:', error);
    }
  }

  /**
   * Generate recommendations for a user's collection
   * @param {Object[]} albums - User's album collection
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Recommendation results
   */
  async generateRecommendations(albums = [], options = {}) {
    const startTime = Date.now();

    try {
      console.log(`🎵 Generating recommendations for ${albums.length} albums`);

      // Validate input
      if (!albums || albums.length < this.config.minCollectionSize) {
        return this.getEmptyRecommendations(`Collection too small (minimum ${this.config.minCollectionSize} albums required)`);
      }

      // Step 1: Build/update user profile
      const profile = await this.buildUserProfile(albums);
      if (!profile) {
        return this.getEmptyRecommendations('Failed to build user profile');
      }

      // Step 2: Fetch external data if needed and available
      let externalData = null;
      if (this.lastfmClient && options.includeExternal !== false) {
        externalData = await this.fetchExternalData(profile);
      }

      // Step 3: Generate basic recommendations (Steps 3-5 from plan would go here)
      const recommendations = await this.buildRecommendations(profile, externalData, albums);

      const result = {
        success: true,
        profile,
        externalData: externalData ? {
          candidateCount: externalData.candidateAlbums?.size || 0,
          sources: externalData.metadata || {}
        } : null,
        recommendations,
        metadata: {
          generatedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
          collectionSize: albums.length,
          recommendationCount: recommendations.total || 0
        }
      };

      console.log('✅ Recommendations generated successfully:', {
        duration: `${result.metadata.duration}ms`,
        recommendations: result.recommendations.total
      });

      return result;

    } catch (error) {
      console.error('❌ Failed to generate recommendations:', error);
      return {
        success: false,
        error: error.message,
        profile: null,
        recommendations: this.getEmptyRecommendations(error.message).recommendations,
        metadata: {
          generatedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
          collectionSize: albums.length
        }
      };
    }
  }

  /**
   * Build user profile from collection
   * @param {Object[]} albums - User's albums
   * @returns {Promise<Object>} User profile
   */
  async buildUserProfile(albums) {
    try {
      // Check cache first
      const cacheKey = this.generateProfileCacheKey(albums);
      if (this.config.enableCaching && this.cache.profiles.has(cacheKey)) {
        const cached = this.cache.profiles.get(cacheKey);
        if (this.isCacheValid(cached, this.config.cacheExpirationHours)) {
          console.log('🎵 Using cached user profile');
          this.currentProfile = cached.data;
          return cached.data;
        }
      }

      // Build new profile
      console.log('🎵 Building new user profile');
      const profile = CollectionProfiler.buildUserProfile(albums);

      // Cache the profile
      if (this.config.enableCaching) {
        this.cache.profiles.set(cacheKey, {
          data: profile,
          timestamp: Date.now()
        });
      }

      this.currentProfile = profile;
      return profile;

    } catch (error) {
      console.error('❌ Failed to build user profile:', error);
      return null;
    }
  }

  /**
   * Fetch external data based on user profile
   * @param {Object} profile - User profile
   * @returns {Promise<Object|null>} External data
   */
  async fetchExternalData(profile) {
    try {
      // Check cache first
      const cacheKey = this.generateExternalDataCacheKey(profile);
      if (this.config.enableCaching && this.cache.externalData.has(cacheKey)) {
        const cached = this.cache.externalData.get(cacheKey);
        if (this.isCacheValid(cached, this.config.cacheExpirationHours)) {
          console.log('🎵 Using cached external data');
          this.currentData = cached.data;
          return cached.data;
        }
      }

      // Fetch new external data
      console.log('🎵 Fetching fresh external data');
      const externalData = await this.dataFetcher.fetchForUserProfile(profile);

      // Cache the data
      if (this.config.enableCaching) {
        this.cache.externalData.set(cacheKey, {
          data: externalData,
          timestamp: Date.now()
        });
      }

      this.currentData = externalData;
      return externalData;

    } catch (error) {
      console.error('❌ Failed to fetch external data:', error);
      return null;
    }
  }

  /**
   * Build recommendations from profile and external data
   * @param {Object} profile - User profile
   * @param {Object|null} externalData - External data
   * @param {Object[]} userAlbums - User's existing albums for deduplication
   * @returns {Promise<Object>} Recommendations
   */
  async buildRecommendations(profile, externalData, userAlbums) {
    // For Steps 1&2 implementation, we'll create basic recommendations
    // Steps 3-5 (scoring, candidate generation, curated lists) will be added later

    const recommendations = {
      total: 0,
      lists: {},
      metadata: {
        generatedAt: Date.now(),
        sources: []
      }
    };

    // Create user fingerprints for deduplication
    const userFingerprints = new Set(
      userAlbums.map(album =>
        AlbumNormalizer.createFingerprint(album.artist, album.title)
      )
    );

    // Basic artist similarity recommendations
    if (externalData?.similarArtists) {
      const artistRecs = this.buildArtistSimilarityRecommendations(
        externalData.similarArtists,
        userFingerprints,
        10
      );

      if (artistRecs.length > 0) {
        recommendations.lists.similar_artists = {
          title: 'Because you listen to similar artists',
          description: 'Albums from artists similar to those in your collection',
          items: artistRecs,
          count: artistRecs.length
        };
        recommendations.total += artistRecs.length;
        recommendations.metadata.sources.push('similar_artists');
      }
    }

    // Basic genre recommendations
    if (externalData?.tagAlbums) {
      const genreRecs = this.buildGenreRecommendations(
        externalData.tagAlbums,
        userFingerprints,
        15
      );

      if (genreRecs.length > 0) {
        recommendations.lists.genre_matches = {
          title: 'More music you might like',
          description: 'Popular albums from your favorite genres',
          items: genreRecs,
          count: genreRecs.length
        };
        recommendations.total += genreRecs.length;
        recommendations.metadata.sources.push('genre_matches');
      }
    }

    // Profile-based recommendations (without external data)
    const profileRecs = this.buildProfileBasedRecommendations(profile, 5);
    if (profileRecs.length > 0) {
      recommendations.lists.profile_based = {
        title: 'Based on your collection',
        description: 'Recommendations derived from your listening patterns',
        items: profileRecs,
        count: profileRecs.length
      };
      recommendations.total += profileRecs.length;
      recommendations.metadata.sources.push('profile_analysis');
    }

    return recommendations;
  }

  /**
   * Build recommendations from similar artists
   * @param {Object} similarArtistsData - Similar artists data from Last.fm
   * @param {Set} userFingerprints - User's existing album fingerprints
   * @param {number} limit - Maximum recommendations
   * @returns {Object[]} Recommendations
   */
  buildArtistSimilarityRecommendations(similarArtistsData, userFingerprints, limit) {
    const recommendations = [];

    Object.values(similarArtistsData).forEach(artistData => {
      artistData.similarArtists.forEach(similarArtist => {
        // For now, create placeholder recommendations
        // In full implementation, we'd fetch top albums for each similar artist
        const placeholder = {
          type: 'similar_artist',
          artist: similarArtist.name,
          title: `Top Album by ${similarArtist.name}`, // Placeholder
          reason: `Because you listen to ${artistData.sourceArtist}`,
          similarity: similarArtist.match,
          image: similarArtist.image,
          metadata: {
            sourceArtist: artistData.sourceArtist,
            lastfmMatch: similarArtist.match
          }
        };

        recommendations.push(placeholder);
      });
    });

    return recommendations
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Build recommendations from genre data
   * @param {Object} tagAlbumsData - Tag albums data from Last.fm
   * @param {Set} userFingerprints - User's existing album fingerprints
   * @param {number} limit - Maximum recommendations
   * @returns {Object[]} Recommendations
   */
  buildGenreRecommendations(tagAlbumsData, userFingerprints, limit) {
    const recommendations = [];

    Object.values(tagAlbumsData).forEach(tagData => {
      tagData.albums.forEach(album => {
        // Skip if user already owns this album
        if (userFingerprints.has(album.fingerprint)) {
          return;
        }

        recommendations.push({
          type: 'genre_match',
          artist: album.artist.name,
          title: album.name,
          reason: `Popular in ${tagData.sourceTag}`,
          popularity: album.playcount,
          rank: album.rank,
          image: album.image,
          url: album.url,
          metadata: {
            sourceTag: tagData.sourceTag,
            playcount: album.playcount,
            rank: album.rank
          }
        });
      });
    });

    return recommendations
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  /**
   * Build recommendations based purely on profile analysis
   * @param {Object} profile - User profile
   * @param {number} limit - Maximum recommendations
   * @returns {Object[]} Recommendations
   */
  buildProfileBasedRecommendations(profile, limit) {
    const recommendations = [];

    // Create recommendations based on profile insights
    if (profile.preferences?.primaryGenres?.length > 0) {
      profile.preferences.primaryGenres.slice(0, 2).forEach(genre => {
        recommendations.push({
          type: 'profile_insight',
          artist: `Various Artists`,
          title: `Explore more ${genre}`,
          reason: `${genre} makes up ${profile.genres.find(g => g.genre === genre)?.percentage?.toFixed(1) || 0}% of your collection`,
          metadata: {
            insightType: 'genre_expansion',
            genre: genre
          }
        });
      });
    }

    if (profile.preferences?.primaryEras?.length > 0) {
      const topEra = profile.preferences.primaryEras[0];
      recommendations.push({
        type: 'profile_insight',
        artist: 'Various Artists',
        title: `More music from the ${topEra}s`,
        reason: `You have strong preference for ${topEra}s music`,
        metadata: {
          insightType: 'era_expansion',
          era: topEra
        }
      });
    }

    return recommendations.slice(0, limit);
  }

  /**
   * Generate cache key for user profile
   * @param {Object[]} albums - User's albums
   * @returns {string} Cache key
   */
  generateProfileCacheKey(albums) {
    // Simple hash based on collection fingerprint
    const fingerprints = albums
      .map(album => AlbumNormalizer.createFingerprint(album.artist, album.title))
      .sort()
      .join(',');

    return `profile_${this.simpleHash(fingerprints)}`;
  }

  /**
   * Generate cache key for external data
   * @param {Object} profile - User profile
   * @returns {string} Cache key
   */
  generateExternalDataCacheKey(profile) {
    const keyData = {
      topArtists: profile.artists.slice(0, 10).map(a => a.artist),
      topGenres: profile.genres.slice(0, 5).map(g => g.genre),
      totalAlbums: profile.collection.totalAlbums
    };

    return `external_${this.simpleHash(JSON.stringify(keyData))}`;
  }

  /**
   * Check if cached data is still valid
   * @param {Object} cached - Cached item
   * @param {number} expirationHours - Hours until expiration
   * @returns {boolean} Is valid
   */
  isCacheValid(cached, expirationHours) {
    const expirationMs = expirationHours * 60 * 60 * 1000;
    return Date.now() - cached.timestamp < expirationMs;
  }

  /**
   * Simple hash function for cache keys
   * @param {string} str - String to hash
   * @returns {string} Hash
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get empty recommendations structure
   * @param {string} reason - Reason for empty recommendations
   * @returns {Object} Empty recommendations
   */
  getEmptyRecommendations(reason = 'No recommendations available') {
    return {
      success: false,
      reason,
      recommendations: {
        total: 0,
        lists: {},
        metadata: {
          generatedAt: Date.now(),
          sources: []
        }
      }
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      profiles: {
        size: this.cache.profiles.size,
        entries: Array.from(this.cache.profiles.keys())
      },
      externalData: {
        size: this.cache.externalData.size,
        entries: Array.from(this.cache.externalData.keys())
      },
      recommendations: {
        size: this.cache.recommendations.size,
        entries: Array.from(this.cache.recommendations.keys())
      },
      lastfm: this.lastfmClient ? this.lastfmClient.getCacheStats() : null
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.profiles.clear();
    this.cache.externalData.clear();
    this.cache.recommendations.clear();

    if (this.lastfmClient) {
      this.lastfmClient.clearCache();
    }

    console.log('🎵 All caches cleared');
  }
}

export default RecommendationService;