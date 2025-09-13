/**
 * Supabase Database Service - Cloud Database Operations for Vinyl Collection
 * Replaces local IndexedDB with cloud-based PostgreSQL via Supabase
 */

import { supabase } from './supabase.js';

export class SupabaseDatabase {
  
  /**
   * ALBUM OPERATIONS
   */

  /**
   * Get all albums for the current user
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of albums
   */
  static async getAllAlbums(options = {}) {
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
      const mappedData = (data || []).map(album => ({
        ...album,
        coverImage: album.cover_image_url, // Map cover_image_url to coverImage
        catalogNumber: album.catalog_number, // Map catalog_number to catalogNumber
        purchasePrice: album.purchase_price, // Map purchase_price to purchasePrice
        purchaseDate: album.purchase_date, // Map purchase_date to purchaseDate
        purchaseLocation: album.purchase_location, // Map purchase_location to purchaseLocation
        identificationMethod: album.identification_method, // Map identification_method to identificationMethod
        identificationConfidence: album.identification_confidence, // Map identification_confidence to identificationConfidence
        listeningCount: album.listening_count, // Map listening_count to listeningCount
        lastPlayed: album.last_played, // Map last_played to lastPlayed
        aiAnalysis: album.ai_analysis, // Map ai_analysis to aiAnalysis
        createdAt: album.created_at, // Map created_at to createdAt
        updatedAt: album.updated_at // Map updated_at to updatedAt
      }));
      
      return mappedData;
    } catch (error) {
      console.error('Error fetching albums:', error);
      throw error;
    }
  }

  /**
   * Get a single album by ID
   * @param {string} albumId - Album UUID
   * @returns {Promise<Object>} Album object
   */
  static async getAlbumById(albumId) {
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
        .eq('id', albumId)
        .single();

      if (error) throw error;
      
      // Map Supabase field names to frontend expected field names
      const mappedData = {
        ...data,
        coverImage: data.cover_image_url,
        catalogNumber: data.catalog_number,
        purchasePrice: data.purchase_price,
        purchaseDate: data.purchase_date,
        purchaseLocation: data.purchase_location,
        identificationMethod: data.identification_method,
        identificationConfidence: data.identification_confidence,
        listeningCount: data.listening_count,
        lastPlayed: data.last_played,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      return mappedData;
    } catch (error) {
      console.error('Error fetching album:', error);
      throw error;
    }
  }

  /**
   * Add a new album
   * @param {Object} albumData - Album data
   * @returns {Promise<Object>} Created album
   */
  static async addAlbum(albumData) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Prepare album data with proper field mapping
      const albumToInsert = {
        user_id: user.id,
        title: albumData.title,
        artist: albumData.artist,
        year: albumData.year,
        genre: Array.isArray(albumData.genre) ? albumData.genre : [albumData.genre].filter(Boolean),
        label: albumData.label,
        catalog_number: albumData.catalogNumber,
        format: albumData.format || 'LP',
        speed: albumData.speed || '33 RPM',
        size: albumData.size || '12"',
        condition: albumData.condition || 'Near Mint',
        purchase_price: albumData.purchasePrice,
        purchase_date: albumData.purchaseDate,
        purchase_location: albumData.purchaseLocation,
        cover_image_url: albumData.coverImage || albumData.coverImageUrl,
        identification_method: albumData.identificationMethod || 'manual',
        identification_confidence: albumData.confidence,
        musicbrainz_id: albumData.metadata?.musicbrainzId,
        discogs_id: albumData.metadata?.discogsId,
        spotify_id: albumData.metadata?.spotifyId,
        notes: albumData.notes,
        rating: albumData.rating,
        listening_count: albumData.listeningCount || 0,
        last_played: albumData.lastPlayed,
        moods: albumData.moods || [],
        ai_analysis: albumData.aiAnalysis || null
      };

      const { data, error } = await supabase
        .from('albums')
        .insert([albumToInsert])
        .select()
        .single();

      if (error) throw error;
      
      console.log('Album added successfully to Supabase:', data.title);
      return data;
    } catch (error) {
      console.error('Error adding album:', error);
      if (error.code === '23505') {
        throw new Error('Album already exists in your collection');
      }
      throw error;
    }
  }

  /**
   * Update an existing album
   * @param {string} albumId - Album UUID
   * @param {Object} albumData - Updated album data
   * @returns {Promise<Object>} Updated album
   */
  static async updateAlbum(albumId, albumData) {
    try {
      const updateData = {
        title: albumData.title,
        artist: albumData.artist,
        year: albumData.year,
        genre: Array.isArray(albumData.genre) ? albumData.genre : [albumData.genre].filter(Boolean),
        label: albumData.label,
        catalog_number: albumData.catalogNumber,
        format: albumData.format,
        speed: albumData.speed,
        size: albumData.size,
        condition: albumData.condition,
        purchase_price: albumData.purchasePrice,
        purchase_date: albumData.purchaseDate,
        purchase_location: albumData.purchaseLocation,
        cover_image_url: albumData.coverImage || albumData.coverImageUrl,
        identification_method: albumData.identificationMethod,
        identification_confidence: albumData.confidence,
        musicbrainz_id: albumData.metadata?.musicbrainzId,
        discogs_id: albumData.metadata?.discogsId,
        spotify_id: albumData.metadata?.spotifyId,
        notes: albumData.notes,
        rating: albumData.rating,
        listening_count: albumData.listeningCount,
        last_played: albumData.lastPlayed,
        moods: albumData.moods,
        ai_analysis: albumData.aiAnalysis
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      const { data, error } = await supabase
        .from('albums')
        .update(updateData)
        .eq('id', albumId)
        .select()
        .single();

      if (error) throw error;
      
      console.log('Album updated successfully:', data.title);
      return data;
    } catch (error) {
      console.error('Error updating album:', error);
      throw error;
    }
  }

  /**
   * Delete an album
   * @param {string} albumId - Album UUID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteAlbum(albumId) {
    try {
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', albumId);

      if (error) throw error;
      
      console.log('Album deleted successfully from Supabase');
      return true;
    } catch (error) {
      console.error('Error deleting album:', error);
      throw error;
    }
  }

  /**
   * Check if an album already exists for the current user
   * @param {string} artist - Artist name
   * @param {string} title - Album title
   * @returns {Promise<Object|null>} Existing album or null
   */
  static async checkAlbumExists(artist, title) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, title, artist, created_at')
        .ilike('artist', artist.trim())
        .ilike('title', title.trim())
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error checking album existence:', error);
      throw error;
    }
  }

  /**
   * SEARCH AND STATISTICS
   */

  /**
   * Search albums by text
   * @param {string} searchText - Search query
   * @returns {Promise<Array>} Matching albums
   */
  static async searchAlbums(searchText) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, title, artist, year, cover_image_url, created_at')
        .or(`title.ilike.%${searchText}%,artist.ilike.%${searchText}%,notes.ilike.%${searchText}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching albums:', error);
      throw error;
    }
  }

  /**
   * Get user's collection statistics
   * @returns {Promise<Object>} Collection stats
   */
  static async getCollectionStats() {
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
   * Get albums by artist
   * @param {string} artist - Artist name
   * @returns {Promise<Array>} Albums by artist
   */
  static async getAlbumsByArtist(artist) {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, title, year, cover_image_url')
        .ilike('artist', `%${artist}%`)
        .order('year', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching albums by artist:', error);
      throw error;
    }
  }

  /**
   * MIGRATION UTILITIES
   */

  /**
   * Import albums from local IndexedDB to Supabase
   * @param {Array} albums - Albums from local database
   * @returns {Promise<Object>} Import results
   */
  static async importFromLocal(albums) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (const album of albums) {
        try {
          // Check if album already exists
          const existing = await this.checkAlbumExists(album.artist, album.title);
          if (existing) {
            skipped++;
            continue;
          }

          // Convert local format to Supabase format
          const supabaseAlbum = {
            title: album.title,
            artist: album.artist,
            year: album.year,
            genre: album.genre || [],
            label: album.label,
            catalogNumber: album.catalogNumber,
            format: album.format,
            condition: album.condition,
            purchasePrice: album.purchasePrice,
            purchaseDate: album.purchaseDate,
            purchaseLocation: album.purchaseLocation,
            coverImage: album.coverImage,
            notes: album.notes,
            identificationMethod: album.identificationMethod || 'imported-from-local'
          };

          await this.addAlbum(supabaseAlbum);
          imported++;
        } catch (error) {
          console.error(`Failed to import album: ${album.title} by ${album.artist}`, error);
          errors++;
        }
      }

      return { imported, skipped, errors, total: albums.length };
    } catch (error) {
      console.error('Error importing from local database:', error);
      throw error;
    }
  }

  /**
   * UTILITY FUNCTIONS
   */

  /**
   * Test database connection
   * @returns {Promise<boolean>} Connection status
   */
  static async testConnection() {
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

  /**
   * Get current user info
   * @returns {Promise<Object>} User object
   */
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }
}

export default SupabaseDatabase;