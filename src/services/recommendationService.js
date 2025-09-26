/**
 * Recommendation Service
 * Main orchestrator for the album recommendation engine
 * Combines user profile analysis, external data fetching, and caching
 */

import LastFmClient from './lastfmClient.js';
import RecommendationDataFetcher from './recommendationDataFetcher.js';
import CollectionProfiler from './collectionProfiler.js';
import RecommendationScoring from './recommendationScoring.js';
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
    this.scoringEngine = new RecommendationScoring();
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
        externalData = await this.fetchExternalData(profile, albums);
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
   * @param {Array} userCollection - User's album collection for enhanced matching
   * @returns {Promise<Object|null>} External data
   */
  async fetchExternalData(profile, userCollection = []) {
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

      // Fetch new external data with enhanced matching
      console.log('🎵 Fetching fresh external data with enhanced MBID matching');
      const externalData = await this.dataFetcher.fetchForUserProfile(profile, userCollection);

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
   * Build recommendations from profile and external data using advanced scoring
   * @param {Object} profile - User profile
   * @param {Object|null} externalData - External data
   * @param {Object[]} userAlbums - User's existing albums for deduplication
   * @returns {Promise<Object>} Recommendations
   */
  async buildRecommendations(profile, externalData, userAlbums) {
    console.log('🎵 Building recommendations with advanced scoring...');

    const recommendations = {
      total: 0,
      lists: {},
      metadata: {
        generatedAt: Date.now(),
        sources: [],
        scoringEngine: 'advanced',
        version: '3.0'
      }
    };

    // Collect all candidate albums from various sources
    const candidates = this.collectCandidateAlbums(externalData, userAlbums);
    console.log(`🎵 Found ${candidates.length} candidate albums for scoring`);

    if (candidates.length === 0) {
      return recommendations;
    }

    // Score all candidates using advanced algorithm
    const scoredCandidates = this.scoringEngine.scoreMultipleCandidates(
      candidates,
      profile,
      userAlbums,
      externalData
    );

    console.log(`🎵 Scored ${scoredCandidates.length} candidates (${candidates.length - scoredCandidates.length} filtered out)`);

    // Create recommendation lists based on scores and sources
    this.createScoredRecommendationLists(scoredCandidates, recommendations);

    return recommendations;
  }

  /**
   * Collect candidate albums from all available sources
   */
  collectCandidateAlbums(externalData, userAlbums) {
    const candidates = [];
    const userFingerprints = new Set(
      userAlbums.map(album =>
        AlbumNormalizer.createFingerprint(album.artist, album.title)
      )
    );

    // Skip similar artists extraction since candidateAlbums already contains processed similar artist data with real album titles

    // From external data genre albums
    if (externalData?.tagAlbums) {
      const genreCandidates = this.extractCandidatesFromGenreAlbums(
        externalData.tagAlbums,
        userFingerprints
      );
      candidates.push(...genreCandidates);
    }

    // From candidate albums in external data
    if (externalData?.candidateAlbums) {
      const externalCandidates = Array.from(externalData.candidateAlbums.values())
        .filter(candidate => !userFingerprints.has(candidate.fingerprint));
      candidates.push(...externalCandidates);
    }

    return candidates;
  }

  /**
   * Extract candidates from similar artists data with enhanced MBID matching
   */
  extractCandidatesFromSimilarArtists(similarArtistsData, userFingerprints, userCollection = []) {
    const candidates = [];

    Object.values(similarArtistsData).forEach(artistData => {
      // Use enhanced matching to find which user artists connect to these similar artists
      const matchedArtists = AlbumNormalizer.matchArtistsWithCollection(
        artistData.similarArtists,
        userCollection
      );

      artistData.similarArtists.forEach(similarArtist => {
        // Find if this artist was matched to user's collection
        const enhancedMatch = matchedArtists.find(m => m.name === similarArtist.name);

        // Create candidate with enhanced similarity metadata
        const candidate = {
          artist: similarArtist.name,
          title: `Popular Album by ${similarArtist.name}`, // Placeholder
          type: 'similar_artist',
          similarity: similarArtist.match,
          image: similarArtist.image,
          mbid: similarArtist.mbid,
          metadata: {
            sourceArtist: artistData.sourceArtist,
            lastfmMatch: similarArtist.match,
            source: 'similar_artists',
            // Enhanced matching metadata
            matchConfidence: enhancedMatch?.matchConfidence || 0,
            matchType: enhancedMatch?.matchType || 'unmatched',
            connectedToUser: !!enhancedMatch,
            userArtist: enhancedMatch?.userArtist?.artist
          }
        };

        const fingerprint = AlbumNormalizer.createFingerprint(candidate.artist, candidate.title);
        if (!userFingerprints.has(fingerprint)) {
          candidate.fingerprint = fingerprint;
          candidates.push(candidate);
        }
      });
    });

    return candidates;
  }

  /**
   * Extract candidates from genre albums data
   */
  extractCandidatesFromGenreAlbums(tagAlbumsData, userFingerprints) {
    const candidates = [];

    Object.values(tagAlbumsData).forEach(tagData => {
      tagData.albums.forEach(album => {
        if (!userFingerprints.has(album.fingerprint)) {
          const candidate = {
            artist: album.artist.name,
            title: album.name,
            type: 'genre_match',
            popularity: album.playcount,
            rank: album.rank,
            image: album.image,
            url: album.url,
            fingerprint: album.fingerprint,
            metadata: {
              sourceTag: tagData.sourceTag,
              playcount: album.playcount,
              rank: album.rank,
              source: 'genre_albums'
            }
          };
          candidates.push(candidate);
        }
      });
    });

    return candidates;
  }

  /**
   * Create recommendation lists from scored candidates
   */
  createScoredRecommendationLists(scoredCandidates, recommendations) {
    // Top recommendations (highest scores across all sources)
    const topRecommendations = scoredCandidates
      .slice(0, 10)
      .map(result => this.formatRecommendationItem(result));

    if (topRecommendations.length > 0) {
      recommendations.lists.top_picks = {
        title: 'Top Picks for You',
        description: 'Our highest-rated recommendations based on your music taste',
        items: topRecommendations,
        count: topRecommendations.length
      };
      recommendations.total += topRecommendations.length;
      recommendations.metadata.sources.push('top_picks');
    }

    // Similar artists with high scores
    const similarArtistRecs = scoredCandidates
      .filter(result => result.candidate.type === 'similar_artist')
      .slice(0, 8)
      .map(result => this.formatRecommendationItem(result));

    if (similarArtistRecs.length > 0) {
      recommendations.lists.similar_artists = {
        title: 'Because you listen to similar artists',
        description: 'Albums from artists similar to those in your collection',
        items: similarArtistRecs,
        count: similarArtistRecs.length
      };
      recommendations.total += similarArtistRecs.length;
      recommendations.metadata.sources.push('similar_artists');
    }

    // Genre matches with high scores
    const genreMatches = scoredCandidates
      .filter(result => result.candidate.type === 'genre_match')
      .slice(0, 12)
      .map(result => this.formatRecommendationItem(result));

    if (genreMatches.length > 0) {
      recommendations.lists.genre_matches = {
        title: 'More music you might like',
        description: 'Popular albums from your favorite genres',
        items: genreMatches,
        count: genreMatches.length
      };
      recommendations.total += genreMatches.length;
      recommendations.metadata.sources.push('genre_matches');
    }

    // Hidden gems (lower popularity but high personal match)
    const hiddenGems = scoredCandidates
      .filter(result =>
        result.totalScore > 0.6 &&
        (!result.candidate.popularity || result.candidate.popularity < 50000)
      )
      .slice(0, 6)
      .map(result => this.formatRecommendationItem(result));

    if (hiddenGems.length > 0) {
      recommendations.lists.hidden_gems = {
        title: 'Hidden Gems',
        description: 'Lesser-known albums that match your taste perfectly',
        items: hiddenGems,
        count: hiddenGems.length
      };
      recommendations.total += hiddenGems.length;
      recommendations.metadata.sources.push('hidden_gems');
    }
  }

  /**
   * Format scored result into recommendation item
   */
  formatRecommendationItem(scoredResult) {
    const { candidate, totalScore, explanation, confidence, reasons } = scoredResult;

    return {
      type: candidate.type,
      artist: candidate.artist,
      title: candidate.title,
      image: candidate.image,
      url: candidate.url,
      reason: explanation,
      score: Math.round(totalScore * 100), // Convert to percentage
      confidence: Math.round(confidence * 100),
      reasons: reasons,
      similarity: candidate.similarity,
      popularity: candidate.popularity,
      rank: candidate.rank,
      metadata: {
        ...candidate.metadata,
        scoredAt: Date.now()
      }
    };
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