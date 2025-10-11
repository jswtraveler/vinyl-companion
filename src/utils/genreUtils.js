/**
 * Genre Utilities
 * Shared functions for extracting and analyzing genres from album collections
 */

/**
 * Extract unique genres from albums
 * @param {Array} albums - Album collection
 * @returns {Array} Sorted array of unique genres
 */
export function extractGenres(albums) {
  const genreSet = new Set();
  albums.forEach(album => {
    if (album.genre && Array.isArray(album.genre)) {
      album.genre.forEach(g => genreSet.add(g));
    }
  });
  return Array.from(genreSet).sort();
}

/**
 * Count albums per genre
 * @param {Array} albums - Album collection
 * @returns {Map} Map of genre -> count
 */
export function countAlbumsByGenre(albums) {
  const genreCounts = new Map();

  albums.forEach(album => {
    if (album.genre && Array.isArray(album.genre)) {
      album.genre.forEach(genre => {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      });
    }
  });

  return genreCounts;
}

/**
 * Get genres sorted by prevalence (most common first)
 * @param {Array} albums - Album collection
 * @returns {Array} Array of {genre, count} objects sorted by count descending
 */
export function getGenresByPrevalence(albums) {
  const genreCounts = countAlbumsByGenre(albums);

  return Array.from(genreCounts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Filter artists by genre
 * @param {Array} artists - Artist recommendations
 * @param {string} genre - Genre to filter by
 * @returns {Array} Artists that have the specified genre in their metadata
 */
export function filterArtistsByGenre(artists, genre) {
  return artists.filter(artist => {
    const genres = artist.metadata?.genres || [];
    return genres.some(g =>
      g.toLowerCase() === genre.toLowerCase()
    );
  });
}

/**
 * Group artists by genres from user's collection
 * @param {Array} artists - Artist recommendations
 * @param {Array} albums - User's album collection
 * @returns {Object} Map of genre -> filtered artists
 */
export function groupArtistsByGenre(artists, albums) {
  const genresByPrevalence = getGenresByPrevalence(albums);
  const grouped = {};

  genresByPrevalence.forEach(({ genre, count }) => {
    const filteredArtists = filterArtistsByGenre(artists, genre);
    if (filteredArtists.length > 0) {
      grouped[genre] = {
        artists: filteredArtists,
        count: count // Album count in user's collection
      };
    }
  });

  return grouped;
}
