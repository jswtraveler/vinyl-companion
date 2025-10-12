/**
 * Album Tag Backfill Service
 * Fetches Last.fm tags for existing albums in the collection
 */

import { LastFmClient } from './api/music/LastFmClient.js';
import { isValidGenre } from '../data/musicbrainz-genres.js';

const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;

/**
 * Backfill Last.fm tags for existing albums
 * @param {Array} albums - Array of album objects from database
 * @param {Function} onProgress - Callback for progress updates (current, total, album)
 * @param {Function} updateAlbum - Function to update album in database
 * @param {boolean} force - If true, re-fetch tags for all albums regardless of existing tag count
 * @returns {Promise<Object>} Results summary
 */
export async function backfillAlbumTags(albums, onProgress, updateAlbum, force = false) {
  if (!LASTFM_API_KEY) {
    throw new Error('Last.fm API key not configured');
  }

  const client = new LastFmClient(LASTFM_API_KEY);
  const results = {
    total: albums.length,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];

    try {
      // Report progress
      if (onProgress) {
        onProgress(i + 1, albums.length, album);
      }

      // Skip if album already has 3+ tags (unless force mode)
      if (!force && album.genre && Array.isArray(album.genre) && album.genre.length >= 3) {
        console.log(`⏭️  Skipping "${album.title}" - already has ${album.genre.length} tags`);
        results.skipped++;
        results.processed++;
        continue;
      }

      // Fetch Last.fm tags
      console.log(`🎵 Fetching tags for: ${album.artist} - ${album.title}`);
      const albumInfo = await client.getAlbumInfo(album.artist, album.title);

      if (albumInfo?.album?.tags?.tag) {
        const tags = Array.isArray(albumInfo.album.tags.tag)
          ? albumInfo.album.tags.tag
          : [albumInfo.album.tags.tag];

        // Filter tags against MusicBrainz genre whitelist
        const newTags = tags
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

        if (newTags.length > 0) {
          let finalGenres;

          if (force) {
            // Force mode: Replace existing tags with new filtered tags
            finalGenres = newTags;
            console.log(`✅ Found ${newTags.length} tags (replacing existing):`, newTags);
          } else {
            // Normal mode: Merge with existing genres (deduplicate)
            const existingGenres = album.genre || [];
            finalGenres = [...new Set([...newTags, ...existingGenres])];
            console.log(`✅ Found ${newTags.length} tags:`, newTags);
            console.log(`   Merged to ${finalGenres.length} total genres:`, finalGenres);
          }

          // Update album in database
          await updateAlbum(album.id, { genre: finalGenres });
          results.updated++;
        } else {
          console.log(`⚠️  No tags found for "${album.title}"`);
          results.skipped++;
        }
      } else {
        console.log(`⚠️  No tag data returned for "${album.title}"`);
        results.skipped++;
      }

      results.processed++;

    } catch (error) {
      console.error(`❌ Error processing "${album.title}":`, error);
      results.errors++;
      results.processed++;
      results.errorDetails.push({
        album: `${album.artist} - ${album.title}`,
        error: error.message
      });
    }
  }

  return results;
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
 * @param {number} albumCount - Number of albums to process
 * @returns {string} Human-readable time estimate
 */
export function estimateBackfillTime(albumCount) {
  // Last.fm has 1 request/second rate limit
  const secondsPerAlbum = 1;
  const totalSeconds = albumCount * secondsPerAlbum;

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
