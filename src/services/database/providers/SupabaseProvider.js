/**
 * Supabase Provider
 *
 * Cloud storage implementation using Supabase (PostgreSQL).
 * Requires authentication and internet connection.
 */

import { supabase } from '../supabaseClient.js';
import { DatabaseInterface } from '../DatabaseInterface.js';

export class SupabaseProvider extends DatabaseInterface {
  constructor() {
    super();
  }

  /**
   * Initialize connection (Supabase client is already initialized)
   */
  async init() {
    // Supabase client is already initialized, just verify auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return true;
  }

  /**
   * ALBUM OPERATIONS
   */

  async getAllAlbums(options = {}) {
    try {
      let query = supabase
        .from('albums')
        .select(`
          *,
          tracks (
            id,
            track_number,
            side,
            title,
            duration
          )
        `)
        .order('created_at', { ascending: false });

      // Add filters if provided
      if (options.artist) {
        query = query.ilike('artist', `%${options.artist}%`);
      }
      if (options.title) {
        query = query.ilike('title', `%${options.title}%`);
      }
      if (options.year) {
        query = query.eq('year', options.year);
      }
      if (options.genre) {
        query = query.contains('genre', [options.genre]);
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log(`Retrieved ${data?.length || 0} albums from Supabase`);

      // Map Supabase field names to frontend expected field names
      const mappedData = (data || []).map(album => this._mapFromSupabase(album));

      return mappedData;
    } catch (error) {
      console.error('Error fetching albums:', error);
      throw error;
    }
  }

  async getAlbum(id) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select(`
          *,
          tracks (
            id,
            track_number,
            side,
            title,
            duration
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return this._mapFromSupabase(data);
    } catch (error) {
      console.error('Error fetching album:', error);
      throw error;
    }
  }

  async addAlbum(albumData) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Prepare album data with proper field mapping
      const albumToInsert = this._mapToSupabase(albumData, user.id);

      const { data, error } = await supabase
        .from('albums')
        .insert([albumToInsert])
        .select()
        .single();

      if (error) throw error;

      console.log('Album added successfully to Supabase:', data.title);
      return this._mapFromSupabase(data);
    } catch (error) {
      console.error('Error adding album:', error);
      if (error.code === '23505') {
        throw new Error('Album already exists in your collection');
      }
      throw error;
    }
  }

  async updateAlbum(id, albumData) {
    try {
      const updateData = this._mapToSupabase(albumData);

      // Remove undefined values
      Object.keys(updateData).forEach(key =>
        updateData[key] === undefined && delete updateData[key]
      );

      const { data, error } = await supabase
        .from('albums')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log('Album updated successfully:', data.title);
      return this._mapFromSupabase(data);
    } catch (error) {
      console.error('Error updating album:', error);
      throw error;
    }
  }

  async deleteAlbum(id) {
    try {
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log('Album deleted successfully from Supabase');
      return true;
    } catch (error) {
      console.error('Error deleting album:', error);
      throw error;
    }
  }

  async checkAlbumExists(artist, title) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, title, artist, created_at')
        .ilike('artist', artist.trim())
        .ilike('title', title.trim())
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? this._mapFromSupabase(data[0]) : null;
    } catch (error) {
      console.error('Error checking album existence:', error);
      throw error;
    }
  }

  /**
   * SEARCH OPERATIONS
   */

  async searchAlbums(searchText) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, title, artist, year, cover_image_url, created_at')
        .or(`title.ilike.%${searchText}%,artist.ilike.%${searchText}%,notes.ilike.%${searchText}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []).map(album => this._mapFromSupabase(album));
    } catch (error) {
      console.error('Error searching albums:', error);
      throw error;
    }
  }

  async getAlbumsByArtist(artist) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, title, year, cover_image_url')
        .ilike('artist', `%${artist}%`)
        .order('year', { ascending: true });

      if (error) throw error;
      return (data || []).map(album => this._mapFromSupabase(album));
    } catch (error) {
      console.error('Error fetching albums by artist:', error);
      throw error;
    }
  }

  /**
   * STATISTICS
   */

  async getCollectionStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_collection_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // If no stats found, return empty stats
      return data || {
        user_id: user.id,
        total_albums: 0,
        unique_artists: 0,
        oldest_album: null,
        newest_album: null,
        average_rating: 0,
        total_spent: 0
      };
    } catch (error) {
      console.error('Error fetching collection stats:', error);
      throw error;
    }
  }

  /**
   * CACHE OPERATIONS (Not applicable for Supabase - use external_data_cache table instead)
   */

  async getCacheItem(key) {
    console.warn('getCacheItem not implemented for Supabase provider');
    return null;
  }

  async setCacheItem(key, data) {
    console.warn('setCacheItem not implemented for Supabase provider');
  }

  /**
   * IMAGE OPERATIONS (Images stored in cover_image_url field)
   */

  async saveAlbumImage(albumId, imageData) {
    try {
      const { error } = await supabase
        .from('albums')
        .update({ cover_image_url: imageData })
        .eq('id', albumId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save album image:', error);
      throw error;
    }
  }

  async getAlbumImage(albumId) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('cover_image_url')
        .eq('id', albumId)
        .single();

      if (error) throw error;
      return data?.cover_image_url || null;
    } catch (error) {
      console.error('Failed to get album image:', error);
      return null;
    }
  }

  /**
   * DATA MIGRATION
   */

  async exportData() {
    try {
      const albums = await this.getAllAlbums();
      return {
        albums,
        exportDate: new Date().toISOString(),
        version: 1,
        provider: 'supabase'
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async importData(data) {
    try {
      if (!data.albums) throw new Error('Invalid import data');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (const album of data.albums) {
        try {
          // Check if album already exists
          const existing = await this.checkAlbumExists(album.artist, album.title);
          if (existing) {
            skipped++;
            continue;
          }

          await this.addAlbum(album);
          imported++;
        } catch (error) {
          console.error(`Failed to import album: ${album.title} by ${album.artist}`, error);
          errors++;
        }
      }

      console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
      return imported;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * UTILITY METHODS
   */

  async testConnection() {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('count(*)', { count: 'exact', head: true });

      if (error) throw error;
      console.log('✅ Supabase database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Supabase database connection failed:', error);
      return false;
    }
  }

  getProviderName() {
    return 'supabase';
  }

  isCloudProvider() {
    return true;
  }

  /**
   * HELPER METHODS FOR FIELD MAPPING
   */

  _mapFromSupabase(data) {
    if (!data) return null;

    return {
      ...data,
      coverImage: data.cover_image_url,
      catalogNumber: data.catalog_number,
      purchasePrice: data.purchase_price,
      purchaseDate: data.purchase_date,
      purchaseLocation: data.purchase_location,
      identificationMethod: data.identification_method,
      identificationConfidence: data.identification_confidence,
      thumb: data.thumb || null,
      listeningCount: data.listening_count,
      lastPlayed: data.last_played,
      aiAnalysis: data.ai_analysis,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  _mapToSupabase(data, userId = null) {
    const mapped = {
      title: data.title,
      artist: data.artist,
      year: data.year,
      genre: Array.isArray(data.genre) ? data.genre : [data.genre].filter(Boolean),
      label: data.label,
      catalog_number: data.catalogNumber,
      format: data.format || 'LP',
      speed: data.speed || '33 RPM',
      size: data.size || '12"',
      condition: data.condition || 'Near Mint',
      purchase_price: data.purchasePrice,
      purchase_date: data.purchaseDate,
      purchase_location: data.purchaseLocation,
      cover_image_url: data.coverImage || data.coverImageUrl,
      identification_method: data.identificationMethod || 'manual',
      identification_confidence: data.confidence || data.identificationConfidence,
      musicbrainz_id: data.metadata?.musicbrainzId || data.musicbrainz_id,
      discogs_id: data.metadata?.discogsId || data.discogs_id,
      spotify_id: data.metadata?.spotifyId || data.spotify_id,
      notes: data.notes,
      rating: data.rating,
      thumb: data.thumb || null,
      listening_count: data.listeningCount || 0,
      last_played: data.lastPlayed,
      moods: data.moods || [],
      ai_analysis: data.aiAnalysis || null
    };

    if (userId) {
      mapped.user_id = userId;
    }

    return mapped;
  }
}

export default SupabaseProvider;
