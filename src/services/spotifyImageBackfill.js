/**
 * Spotify Image Backfill Service
 * Fetches Spotify artist images for all artists in the metadata cache
 */

import SpotifyClient from './api/music/SpotifyClient.js';

/**
 * Backfill Spotify images for all artists in the metadata cache
 * @param {Object} cacheService - RecommendationCacheService instance
 * @param {Function} onProgress - Progress callback (current, total, artist)
 * @returns {Promise<Object>} Results summary
 */
export async function backfillSpotifyImages(cacheService, onProgress = null) {
  if (!cacheService) {
    throw new Error('Cache service is required');
  }

  const results = {
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  try {
    // Initialize Spotify client (uses Edge Function proxy)
    const spotifyClient = new SpotifyClient();
    console.log('🎨 Spotify client initialized for backfill (using Edge Function)');

    // Get all artists from metadata cache that don't have Spotify images
    console.log('📊 Fetching artists from cache...');
    const artists = await getAllArtistsFromCache(cacheService);

    if (!artists || artists.length === 0) {
      console.log('⚠️ No artists found in cache');
      return results;
    }

    results.total = artists.length;
    console.log(`📊 Found ${artists.length} artists to process`);

    // Process each artist
    for (let i = 0; i < artists.length; i++) {
      const artist = artists[i];
      const artistName = artist.artist_name;

      try {
        // Report progress
        if (onProgress) {
          onProgress(i + 1, artists.length, { artist: artistName });
        }

        // Skip if already has Spotify image
        if (artist.spotify_image_url) {
          console.log(`⏭️  Skipping "${artistName}" - already has Spotify image`);
          results.skipped++;
          results.processed++;
          continue;
        }

        // Fetch Spotify image
        console.log(`🎨 Fetching Spotify image for: ${artistName}`);
        const imageData = await spotifyClient.getArtistImage(artistName);

        if (imageData) {
          // Update cache with Spotify data
          await cacheService.setArtistMetadataCache(
            artistName,
            artist.artist_mbid || null,
            {
              ...artist.metadata,
              spotifyImage: imageData.url,
              spotifyId: imageData.spotifyId,
              spotifyUrl: imageData.spotifyUrl
            },
            artist.data_source || 'lastfm'
          );

          console.log(`✅ Updated "${artistName}" with Spotify image`);
          results.updated++;
        } else {
          console.log(`⚠️  No Spotify image found for "${artistName}"`);
          results.skipped++;
        }

        results.processed++;

      } catch (error) {
        console.error(`❌ Error processing "${artistName}":`, error);
        results.errors++;
        results.processed++;
        results.errorDetails.push({
          artist: artistName,
          error: error.message
        });
      }
    }

    console.log(`✅ Spotify image backfill complete: ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors`);
    return results;

  } catch (error) {
    console.error('❌ Spotify image backfill failed:', error);
    throw error;
  }
}

/**
 * Get all artists from metadata cache
 * @param {Object} cacheService - RecommendationCacheService instance
 * @returns {Promise<Array>} Array of artist cache records
 */
async function getAllArtistsFromCache(cacheService) {
  try {
    // Query Supabase directly to get all artists
    const { data, error } = await cacheService.supabase
      .from('artist_metadata_cache')
      .select('artist_name, artist_mbid, metadata, data_source, spotify_image_url, spotify_id, spotify_url')
      .order('artist_name');

    if (error) {
      console.error('Error fetching artists from cache:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get artists from cache:', error);
    return [];
  }
}

/**
 * Get count of artists with/without Spotify images
 * @param {Object} cacheService - RecommendationCacheService instance
 * @returns {Promise<Object>} Statistics
 */
export async function getSpotifyImageStats(cacheService) {
  try {
    const { data, error } = await cacheService.supabase
      .from('artist_metadata_cache')
      .select('artist_name, spotify_image_url');

    if (error) {
      console.error('Error fetching stats:', error);
      return {
        total: 0,
        withImages: 0,
        withoutImages: 0
      };
    }

    const total = data.length;
    const withImages = data.filter(a => a.spotify_image_url).length;
    const withoutImages = total - withImages;

    return {
      total,
      withImages,
      withoutImages
    };
  } catch (error) {
    console.error('Failed to get Spotify image stats:', error);
    return {
      total: 0,
      withImages: 0,
      withoutImages: 0
    };
  }
}

/**
 * Estimate time to complete backfill
 * @param {number} artistCount - Number of artists to process
 * @returns {string} Human-readable time estimate
 */
export function estimateBackfillTime(artistCount) {
  // Spotify has rate limiting, ~20 requests/second but be conservative
  const secondsPerArtist = 0.1; // Optimistic estimate with caching
  const totalSeconds = Math.ceil(artistCount * secondsPerArtist);

  if (totalSeconds < 60) {
    return `~${totalSeconds} seconds`;
  } else if (totalSeconds < 3600) {
    const minutes = Math.ceil(totalSeconds / 60);
    return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.ceil((totalSeconds % 3600) / 60);
    return `~${hours}h ${minutes}m`;
  }
}
