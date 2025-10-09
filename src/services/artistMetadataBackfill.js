/**
 * Artist Metadata Backfill Service
 * Re-fetches Last.fm metadata for artist recommendations to fix empty genre tags
 */

import { LastFmClient } from './lastfmClient.js';
import { isValidGenre } from '../data/musicbrainz-genres.js';

const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;

/**
 * Backfill Last.fm metadata for artists in recommendations
 * @param {Array} artists - Array of artist recommendation objects
 * @param {Function} onProgress - Callback for progress updates (current, total, artist)
 * @param {Object} cacheService - RecommendationCacheService instance for updating cache
 * @param {boolean} force - If true, re-fetch metadata for all artists regardless of existing data
 * @returns {Promise<Object>} Results summary
 */
export async function backfillArtistMetadata(artists, onProgress, cacheService, force = true) {
  if (!LASTFM_API_KEY) {
    throw new Error('Last.fm API key not configured');
  }

  const client = new LastFmClient(LASTFM_API_KEY);
  const results = {
    total: artists.length,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const artistName = artist.artist || artist.name;

    try {
      // Report progress
      if (onProgress) {
        onProgress(i + 1, artists.length, { artist: artistName });
      }

      // Skip if artist already has metadata (unless force mode)
      if (!force && artist.metadata?.genres && artist.metadata.genres.length > 0) {
        console.log(`⏭️  Skipping "${artistName}" - already has ${artist.metadata.genres.length} genres`);
        results.skipped++;
        results.processed++;
        continue;
      }

      // Fetch Last.fm artist info (use MBID if available for better accuracy)
      console.log(`🎵 Fetching metadata for: ${artistName}${artist.mbid ? ` (MBID: ${artist.mbid.substring(0, 8)}...)` : ''}`);
      const artistInfo = await client.getArtistInfo(artistName, 'en', artist.mbid || null);

      if (artistInfo?.artist) {
        const artistData = artistInfo.artist;

        // Extract and validate genres from tags
        const tags = artistData.tags?.tag || [];
        const tagArray = Array.isArray(tags) ? tags : [tags];

        const validGenres = tagArray
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
          .map(tagName => capitalizeGenre(tagName))
          .filter(Boolean);

        if (validGenres.length > 0 || artistData.stats) {
          // Update cache with fresh metadata
          if (cacheService) {
            await cacheService.setArtistMetadataCache(
              artistName,
              artistData.mbid || artist.mbid || null,
              {
                name: artistData.name,
                mbid: artistData.mbid || artist.mbid || null,
                playcount: parseInt(artistData.stats?.playcount) || 0,
                listeners: parseInt(artistData.stats?.listeners) || 0,
                genres: validGenres,
                tags: tagArray.map(tag => typeof tag === 'object' ? tag : { name: tag }),
                bio: artistData.bio?.summary || null
              },
              'lastfm'
            );
          }

          console.log(`✅ Updated "${artistName}" with ${validGenres.length} genres:`, validGenres);
          results.updated++;
        } else {
          console.log(`⚠️  No valid genres found for "${artistName}"`);
          results.skipped++;
        }
      } else {
        console.log(`⚠️  No artist data returned for "${artistName}"`);
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

  return results;
}

/**
 * Clear all artist metadata cache and prepare for fresh fetch
 * @param {Object} cacheService - RecommendationCacheService instance
 * @returns {Promise<number>} Number of cache entries cleared
 */
export async function clearArtistMetadataCache(cacheService) {
  if (!cacheService) {
    console.warn('No cache service provided');
    return 0;
  }

  console.log('🧹 Clearing artist metadata cache...');
  const clearedCount = await cacheService.clearArtistMetadataCache();
  console.log(`✅ Cleared ${clearedCount} cached artist metadata entries`);

  return clearedCount;
}

/**
 * Capitalize genre names properly
 * @param {string} genre - Genre name
 * @returns {string} Properly capitalized genre
 */
function capitalizeGenre(genre) {
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
 * Estimate time to complete backfill
 * @param {number} artistCount - Number of artists to process
 * @returns {string} Human-readable time estimate
 */
export function estimateBackfillTime(artistCount) {
  // Last.fm has 1 request/second rate limit
  const secondsPerArtist = 1;
  const totalSeconds = artistCount * secondsPerArtist;

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
