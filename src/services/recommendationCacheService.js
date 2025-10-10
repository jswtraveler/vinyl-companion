/**
 * Recommendation Cache Service
 * Handles persistent caching for recommendation data using Supabase
 * Implements the recommendation_caching_schema.sql database design
 */

import { supabase } from './supabase.js';

export class RecommendationCacheService {
  constructor(supabaseClient = null) {
    // Reuse existing Supabase client to avoid multiple instances
    this.supabase = supabaseClient || supabase;
    this.enableLogging = true;
  }

  /**
   * Get cached similar artists for a given artist
   * @param {string} artistName - Artist name to search for
   * @param {string} dataSource - Data source ('lastfm' or 'listenbrainz')
   * @returns {Promise<Object|null>} Cached similar artists data or null
   */
  async getSimilarArtistsCache(artistName, dataSource = 'lastfm') {
    try {
      const { data, error } = await this.supabase
        .from('artist_similarity_cache')
        .select('*')
        .eq('source_artist', artistName)
        .eq('data_source', dataSource)
        .order('similarity_score', { ascending: false });

      if (error) {
        console.warn('Error fetching similarity cache:', error);
        return null;
      }

      // Handle empty results
      if (!data || data.length === 0) {
        return null;
      }

      // Convert row-per-relationship format to array format
      const similarArtists = data.map(row => ({
        name: row.target_artist,
        mbid: row.target_mbid,
        match: row.similarity_score
      }));

      this.log(`✅ Cache hit: Similar artists for ${artistName} (${dataSource})`);
      return {
        similarArtists: similarArtists,
        metadata: {
          cached: true,
          cachedAt: data[0].cached_at,
          dataSource: data[0].data_source
        }
      };

    } catch (error) {
      console.error('Failed to get similarity cache:', error);
      return null;
    }
  }

  /**
   * Cache similar artists data
   * @param {string} artistName - Artist name
   * @param {string} artistMBID - MusicBrainz ID (optional)
   * @param {Array} similarArtists - Similar artists data
   * @param {string} dataSource - Data source ('lastfm' or 'listenbrainz')
   * @param {Object} metadata - Additional metadata
   */
  async setSimilarArtistsCache(artistName, artistMBID, similarArtists, dataSource = 'lastfm', metadata = {}) {
    try {
      // Convert array format to row-per-relationship format
      const cacheRows = similarArtists.map(similar => ({
        source_artist: artistName,
        source_mbid: artistMBID || null,
        target_artist: similar.name,
        target_mbid: similar.mbid || null,
        similarity_score: similar.match || 0.5,
        data_source: dataSource
      }));

      const { data, error } = await this.supabase
        .from('artist_similarity_cache')
        .upsert(cacheRows, {
          onConflict: 'source_artist,target_artist'
        })
        .select();

      if (error) {
        if (error.code === '42501') {
          console.warn('⚠️ Cache write blocked by RLS policy - this is expected until database policies are updated');
          console.warn('The app will continue to work but may make more API calls');
        } else {
          console.error('Failed to cache similarity data:', error);
        }
        return false;
      }

      this.log(`💾 Cached: ${cacheRows.length} similar artists for ${artistName} (${dataSource})`);
      return true;

    } catch (error) {
      console.error('Failed to set similarity cache:', error);
      return false;
    }
  }

  /**
   * Get cached artist metadata
   * @param {string} artistName - Artist name
   * @param {string} dataSource - Data source
   * @returns {Promise<Object|null>} Cached metadata or null
   */
  async getArtistMetadataCache(artistName, dataSource = 'lastfm') {
    try {
      const { data, error } = await this.supabase
        .from('artist_metadata_cache')
        .select('*')
        .eq('artist_name', artistName)
        .limit(1);

      if (error) {
        console.warn('Error fetching metadata cache:', error);
        return null;
      }

      // Handle empty results
      if (!data || data.length === 0) {
        return null;
      }

      const cacheRecord = data[0];

      this.log(`✅ Cache hit: Metadata for ${artistName} (${dataSource})`);
      return {
        metadata: {
          ...cacheRecord.metadata,
          // Include Spotify data if available
          spotifyImage: cacheRecord.spotify_image_url || null,
          spotifyId: cacheRecord.spotify_id || null,
          spotifyUrl: cacheRecord.spotify_url || null
        },
        cached: true,
        cachedAt: cacheRecord.cached_at
      };

    } catch (error) {
      console.error('Failed to get metadata cache:', error);
      return null;
    }
  }

  /**
   * Cache artist metadata
   * @param {string} artistName - Artist name
   * @param {string} artistMBID - MusicBrainz ID (optional)
   * @param {Object} metadata - Artist metadata
   * @param {string} dataSource - Data source
   */
  async setArtistMetadataCache(artistName, artistMBID, metadata, dataSource = 'lastfm') {
    try {
      // Extract Spotify data from metadata if present
      const { spotifyImage, spotifyId, spotifyUrl, ...otherMetadata } = metadata;

      const cacheData = {
        artist_name: artistName,
        artist_mbid: artistMBID || null,
        metadata: otherMetadata, // Store non-Spotify metadata as JSONB
        data_source: dataSource,
        // Store Spotify data in dedicated columns
        spotify_image_url: spotifyImage || null,
        spotify_id: spotifyId || null,
        spotify_url: spotifyUrl || null
      };

      const { data, error } = await this.supabase
        .from('artist_metadata_cache')
        .upsert(cacheData, {
          onConflict: 'artist_name'
        })
        .select();

      if (error) {
        if (error.code === '42501') {
          console.warn('⚠️ Metadata cache write blocked by RLS policy - this is expected until database policies are updated');
          console.warn('The app will continue to work but may make more API calls');
        } else {
          console.error('Failed to cache metadata:', error);
        }
        return false;
      }

      this.log(`💾 Cached: Metadata for ${artistName} (${dataSource})${spotifyImage ? ' with Spotify image' : ''}`);
      return true;

    } catch (error) {
      console.error('Failed to set metadata cache:', error);
      return false;
    }
  }

  /**
   * Get user's cached recommendations
   * @param {string} userId - User ID
   * @param {string} collectionFingerprint - Hash of user's collection
   * @returns {Promise<Object|null>} Cached recommendations or null
   */
  async getUserRecommendationsCache(userId, collectionFingerprint) {
    try {
      const { data, error } = await this.supabase
        .from('user_artist_recs_cache')
        .select('*')
        .eq('user_id', userId)
        .eq('collection_fingerprint', collectionFingerprint)
        .eq('is_stale', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('Error fetching user recommendations cache:', error);
        return null;
      }

      // Handle empty results
      if (!data || data.length === 0) {
        return null;
      }

      const cacheRecord = data[0];

      // Update view count
      await this.supabase
        .from('user_artist_recs_cache')
        .update({
          view_count: cacheRecord.view_count + 1,
          last_viewed_at: new Date().toISOString()
        })
        .eq('id', cacheRecord.id);

      this.log(`✅ Cache hit: User recommendations for ${userId}`);
      return {
        recommendations: cacheRecord.recommendations,
        lists: cacheRecord.recommendation_lists,
        metadata: {
          cached: true,
          cachedAt: cacheRecord.created_at,
          generationTime: cacheRecord.generation_time_ms,
          confidence: cacheRecord.confidence_score,
          diversity: cacheRecord.diversity_score,
          coverage: cacheRecord.coverage_percentage,
          viewCount: cacheRecord.view_count + 1
        }
      };

    } catch (error) {
      console.error('Failed to get user recommendations cache:', error);
      return null;
    }
  }

  /**
   * Cache user recommendations
   * @param {string} userId - User ID
   * @param {string} collectionFingerprint - Hash of user's collection
   * @param {Object} recommendations - Recommendations data
   * @param {Object} metadata - Generation metadata
   */
  async setUserRecommendationsCache(userId, collectionFingerprint, recommendations, metadata = {}) {
    try {
      const cacheData = {
        user_id: userId,
        collection_fingerprint: collectionFingerprint,
        algorithm_version: 'enhanced_mbid_v1',
        recommendations: recommendations.recommendations || recommendations,
        recommendation_lists: recommendations.lists || null,
        total_recommendations: recommendations.total || 0,
        generation_time_ms: metadata.duration || null,
        data_sources: metadata.dataSources || ['lastfm'],
        coverage_percentage: metadata.coverage || null,
        confidence_score: metadata.confidence || null,
        unique_genres: metadata.uniqueGenres || null,
        unique_decades: metadata.uniqueDecades || null,
        diversity_score: metadata.diversity || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      const { data, error } = await this.supabase
        .from('user_artist_recs_cache')
        .upsert(cacheData, {
          onConflict: 'user_id,collection_fingerprint'
        })
        .select();

      if (error) {
        console.error('Failed to cache user recommendations:', error);
        return false;
      }

      this.log(`💾 Cached: User recommendations for ${userId}`);
      return true;

    } catch (error) {
      console.error('Failed to set user recommendations cache:', error);
      return false;
    }
  }

  /**
   * Sync user's owned artists to database
   * @param {string} userId - User ID
   * @param {Array} albums - User's album collection
   */
  async syncUserOwnedArtists(userId, albums) {
    try {
      // Group albums by artist and calculate stats
      const artistMap = new Map();

      albums.forEach(album => {
        const artistName = album.artist;
        const artistMBID = this.extractArtistMBID(album.metadata);

        if (!artistMap.has(artistName)) {
          artistMap.set(artistName, {
            artist_name: artistName,
            artist_mbid: artistMBID,
            normalized_name: artistName.toLowerCase().trim(),
            album_count: 0,
            albums: []
          });
        }

        const artistData = artistMap.get(artistName);
        artistData.album_count += 1;
        artistData.albums.push(album);
      });

      // Convert to array and add user_id
      const ownedArtists = Array.from(artistMap.values()).map(artist => ({
        user_id: userId,
        artist_name: artist.artist_name,
        artist_mbid: artist.artist_mbid,
        normalized_name: artist.normalized_name,
        album_count: artist.album_count,
        total_albums_owned: artist.album_count,
        first_added_at: new Date(Math.min(...artist.albums.map(a => new Date(a.dateAdded || Date.now())))).toISOString(),
        last_added_at: new Date(Math.max(...artist.albums.map(a => new Date(a.dateAdded || Date.now())))).toISOString()
        // Note: albums array is only used for calculation, not stored in database
      }));

      // Clear existing entries for this user first
      const { error: deleteError } = await this.supabase
        .from('user_owned_artists')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Failed to clear existing owned artists:', deleteError);
        // Continue anyway - upsert below will handle conflicts
      }

      // Use upsert to handle any remaining duplicates
      const { data, error } = await this.supabase
        .from('user_owned_artists')
        .upsert(ownedArtists, {
          onConflict: 'user_id,artist_name'
        })
        .select();

      if (error) {
        console.error('Failed to sync owned artists:', error);
        return false;
      }

      this.log(`💾 Synced: ${ownedArtists.length} owned artists for user ${userId}`);
      return true;

    } catch (error) {
      console.error('Failed to sync owned artists:', error);
      return false;
    }
  }

  /**
   * Generate collection fingerprint for cache key
   * @param {Array} albums - User's album collection
   * @returns {string} Hash of collection
   */
  generateCollectionFingerprint(albums) {
    const sortedAlbums = albums
      .map(album => `${album.artist}:${album.title}`)
      .sort()
      .join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sortedAlbums.length; i++) {
      const char = sortedAlbums.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(16);
  }

  /**
   * Invalidate user's recommendation cache when collection changes
   * @param {string} userId - User ID
   */
  async invalidateUserRecommendations(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_artist_recs_cache')
        .update({ is_stale: true })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to invalidate recommendations:', error);
        return false;
      }

      this.log(`🗑️ Invalidated: Recommendations cache for user ${userId}`);
      return true;

    } catch (error) {
      console.error('Failed to invalidate recommendations:', error);
      return false;
    }
  }

  /**
   * Clean up expired cache entries
   * @returns {Promise<number>} Number of entries cleaned up
   */
  async cleanupExpiredCaches() {
    try {
      // Call the database cleanup function
      const { data, error } = await this.supabase
        .rpc('cleanup_expired_caches');

      if (error) {
        console.error('Failed to cleanup caches:', error);
        return 0;
      }

      this.log(`🧹 Cleaned up ${data || 0} expired cache entries`);
      return data || 0;

    } catch (error) {
      console.error('Failed to cleanup caches:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      const [similarityStats, metadataStats, userStats] = await Promise.all([
        this.supabase.from('artist_similarity_cache').select('count', { count: 'exact' }),
        this.supabase.from('artist_metadata_cache').select('count', { count: 'exact' }),
        this.supabase.from('user_artist_recs_cache').select('count', { count: 'exact' })
      ]);

      return {
        similarity_cache: similarityStats.count || 0,
        metadata_cache: metadataStats.count || 0,
        user_recommendations: userStats.count || 0,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        similarity_cache: 0,
        metadata_cache: 0,
        user_recommendations: 0,
        error: error.message
      };
    }
  }

  /**
   * Extract artist MBID from metadata
   * @private
   */
  extractArtistMBID(metadata) {
    if (!metadata) return null;

    // Try different possible MBID locations
    return metadata.musicbrainz?.artistId ||
           metadata.musicbrainz?.artist_id ||
           metadata.artistMBID ||
           metadata.mbid ||
           null;
  }

  /**
   * Clear all artist metadata cache entries
   * Used when user wants to refresh and get fresh Last.fm data
   * @returns {Promise<number>} Number of entries deleted
   */
  async clearArtistMetadataCache() {
    try {
      // Delete all rows from artist_metadata_cache
      const { error, count } = await this.supabase
        .from('artist_metadata_cache')
        .delete()
        .not('id', 'is', null); // Match all rows (id is always not null)

      if (error) {
        console.error('Error clearing artist metadata cache:', error);
        return 0;
      }

      this.log(`🧹 Cleared artist metadata cache (${count || 'unknown'} entries)`);
      return count || 0;
    } catch (error) {
      console.error('Failed to clear artist metadata cache:', error);
      return 0;
    }
  }

  /**
   * Logging helper
   * @private
   */
  log(message) {
    if (this.enableLogging) {
      console.log(`[RecommendationCache] ${message}`);
    }
  }
}

export default RecommendationCacheService;