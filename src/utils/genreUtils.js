/**
 * Genre Utilities
 * Shared functions for extracting and analyzing genres from album collections
 */

/**
 * Capitalize genre names properly
 * @param {string} genre - Genre name
 * @returns {string} Properly capitalized genre
 */
export function capitalizeGenre(genre) {
  if (!genre) return '';

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

  return genre
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

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

/**
 * Get artists for a specific genre from album collection
 * @param {Array} albums - Album collection
 * @param {string} genre - Genre to filter by
 * @returns {Set} Set of artist names in this genre
 */
export function getArtistsForGenre(albums, genre) {
  const artists = new Set();

  albums.forEach(album => {
    if (album.genre && Array.isArray(album.genre)) {
      if (album.genre.some(g => g.toLowerCase() === genre.toLowerCase())) {
        artists.add(album.artist.toLowerCase());
      }
    }
  });

  return artists;
}

/**
 * Calculate overlap percentage between two genre's artist sets
 * @param {Set} artists1 - Artist set for genre 1
 * @param {Set} artists2 - Artist set for genre 2
 * @returns {number} Overlap percentage (0-1)
 */
export function calculateGenreOverlap(artists1, artists2) {
  if (artists1.size === 0 || artists2.size === 0) return 0;

  const intersection = new Set([...artists1].filter(x => artists2.has(x)));
  const union = new Set([...artists1, ...artists2]);

  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Filter genres to only include distinct ones with minimal artist overlap
 * @param {Array} albums - Album collection
 * @param {number} maxOverlap - Maximum allowed overlap (0-1), default 0.5
 * @param {number} maxGenres - Maximum number of genres to return, default 10
 * @param {number} minAlbums - Minimum albums required for a genre, default 3
 * @returns {Array} Filtered array of {genre, count, artists} objects
 */
export function getDistinctGenres(albums, maxOverlap = 0.5, maxGenres = 10, minAlbums = 3) {
  const genresByPrevalence = getGenresByPrevalence(albums);

  // Filter out genres with too few albums
  const viableGenres = genresByPrevalence.filter(g => g.count >= minAlbums);

  // Get artist sets for each genre
  const genreData = viableGenres.map(({ genre, count }) => ({
    genre,
    count,
    artists: getArtistsForGenre(albums, genre)
  }));

  // Select distinct genres with minimal overlap
  const selected = [];

  for (const candidate of genreData) {
    if (selected.length >= maxGenres) break;

    // Check overlap with already selected genres
    let hasHighOverlap = false;
    for (const selectedGenre of selected) {
      const overlap = calculateGenreOverlap(candidate.artists, selectedGenre.artists);
      if (overlap > maxOverlap) {
        hasHighOverlap = true;
        console.log(`🎯 Skipping "${candidate.genre}" - ${Math.round(overlap * 100)}% overlap with "${selectedGenre.genre}"`);
        break;
      }
    }

    if (!hasHighOverlap) {
      selected.push(candidate);
      console.log(`✅ Selected "${candidate.genre}" (${candidate.count} albums, ${candidate.artists.size} artists)`);
    }
  }

  return selected;
}
