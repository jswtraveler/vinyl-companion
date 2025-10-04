/**
 * MusicBrainz Genre Whitelist
 * Complete list of official genres from MusicBrainz (2077 genres)
 * Fetched from: https://musicbrainz.org/ws/2/genre/all
 * Last updated: 2025-01-04
 */

// Import the full genre list
import genreList from './musicbrainz-genres.json';

// Create a Set for O(1) lookup performance
const genreSet = new Set(genreList.map(g => g.toLowerCase()));

/**
 * Check if a tag is a valid MusicBrainz genre
 * @param {string} tag - Tag to validate
 * @returns {boolean} True if tag matches a MusicBrainz genre
 */
export function isValidGenre(tag) {
  if (!tag || typeof tag !== 'string') return false;
  return genreSet.has(tag.toLowerCase().trim());
}

/**
 * Filter an array of tags to only include valid MusicBrainz genres
 * @param {Array<string>} tags - Array of tags to filter
 * @returns {Array<string>} Filtered array of valid genres
 */
export function filterValidGenres(tags) {
  if (!Array.isArray(tags)) return [];

  return tags.filter(tag => isValidGenre(tag));
}

/**
 * Get all valid MusicBrainz genres
 * @returns {Array<string>} Complete list of genres
 */
export function getAllGenres() {
  return [...genreList];
}

/**
 * Get genre count
 * @returns {number} Total number of genres
 */
export function getGenreCount() {
  return genreList.length;
}

// Log genre count on module load
console.log(`📚 Loaded ${genreList.length} MusicBrainz genres for validation`);

export default {
  isValidGenre,
  filterValidGenres,
  getAllGenres,
  getGenreCount
};
