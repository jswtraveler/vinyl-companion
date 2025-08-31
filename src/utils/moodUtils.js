/**
 * Mood-based album suggestion utilities
 * Maps genres and other factors to mood categories for collection filtering
 */

// Define all available mood categories
export const MOOD_CATEGORIES = [
  // Tier 1 (Core Moods)
  { id: 'nostalgic', label: 'Nostalgic', color: 'bg-amber-500' },
  { id: 'energetic', label: 'Energetic', color: 'bg-red-500' },
  { id: 'chill', label: 'Chill', color: 'bg-blue-500' },
  { id: 'upbeat', label: 'Upbeat', color: 'bg-green-500' },
  { id: 'melancholic', label: 'Melancholic', color: 'bg-purple-500' },
  { id: 'road_trip', label: 'Road Trip', color: 'bg-orange-500' },
  
  // Tier 2 (Situational/Vibe Moods)
  { id: 'late_night', label: 'Late Night', color: 'bg-indigo-500' },
  { id: 'sunday_morning', label: 'Sunday Morning', color: 'bg-yellow-500' },
  { id: 'dreamy', label: 'Dreamy', color: 'bg-pink-500' },
  { id: 'raw', label: 'Raw', color: 'bg-gray-600' },
  { id: 'comfort', label: 'Comfort', color: 'bg-emerald-500' },
  { id: 'party', label: 'Party', color: 'bg-fuchsia-500' }
];

// Genre to mood mappings (genres can map to multiple moods)
const GENRE_MOOD_MAP = {
  // Rock and related
  'Rock': ['energetic', 'road_trip', 'comfort', 'nostalgic'],
  'Classic Rock': ['nostalgic', 'road_trip', 'comfort'],
  'Alternative': ['energetic', 'melancholic', 'raw'],
  'Indie': ['chill', 'melancholic', 'dreamy', 'comfort'],
  'Punk': ['energetic', 'raw', 'rebellious'],
  'Metal': ['energetic', 'raw', 'late_night'],
  'Hard Rock': ['energetic', 'road_trip', 'raw'],
  'Prog Rock': ['dreamy', 'nostalgic', 'comfort'],
  'Psychedelic Rock': ['dreamy', 'nostalgic', 'late_night'],
  
  // Pop and dance
  'Pop': ['upbeat', 'party', 'comfort'],
  'Pop Rock': ['upbeat', 'energetic', 'road_trip'],
  'Dance': ['party', 'energetic', 'upbeat'],
  'Disco': ['party', 'nostalgic', 'upbeat'],
  'Funk': ['party', 'energetic', 'upbeat'],
  
  // Electronic
  'Electronic': ['energetic', 'party', 'dreamy', 'late_night'],
  'House': ['party', 'energetic', 'late_night'],
  'Techno': ['party', 'energetic', 'late_night'],
  'Ambient': ['chill', 'dreamy', 'late_night', 'comfort'],
  'Synthwave': ['nostalgic', 'dreamy', 'late_night'],
  
  // Hip Hop and R&B
  'Hip Hop': ['energetic', 'party', 'raw', 'late_night'],
  'R&B/Soul': ['chill', 'late_night', 'comfort', 'melancholic'],
  'Soul': ['nostalgic', 'comfort', 'late_night'],
  'Motown': ['nostalgic', 'upbeat', 'party', 'comfort'],
  
  // Jazz and Blues
  'Jazz': ['chill', 'late_night', 'sunday_morning', 'comfort', 'nostalgic'],
  'Blues': ['melancholic', 'raw', 'late_night', 'comfort', 'nostalgic'],
  'Smooth Jazz': ['chill', 'late_night', 'sunday_morning'],
  
  // Folk and Country
  'Folk': ['nostalgic', 'chill', 'sunday_morning', 'comfort', 'melancholic'],
  'Country': ['nostalgic', 'road_trip', 'comfort'],
  'Bluegrass': ['energetic', 'nostalgic', 'sunday_morning'],
  'Singer-Songwriter': ['melancholic', 'chill', 'comfort'],
  
  // Classical and World
  'Classical': ['chill', 'dreamy', 'comfort', 'sunday_morning'],
  'Opera': ['dreamy', 'melancholic', 'comfort'],
  'World': ['dreamy', 'chill', 'nostalgic'],
  'Reggae': ['chill', 'upbeat', 'sunday_morning'],
  
  // Alternative genres
  'Grunge': ['raw', 'melancholic', 'energetic', 'nostalgic'],
  'Shoegaze': ['dreamy', 'melancholic', 'late_night'],
  'Post-Rock': ['dreamy', 'melancholic', 'comfort'],
  'New Wave': ['nostalgic', 'upbeat', 'party'],
  'Soundtrack': ['dreamy', 'nostalgic', 'comfort']
};

/**
 * Get moods for a specific genre
 * @param {string} genre - Genre name
 * @returns {string[]} Array of mood IDs
 */
export const getMoodsForGenre = (genre) => {
  if (!genre) return [];
  return GENRE_MOOD_MAP[genre] || [];
};

/**
 * Get all moods for an album based on its genres
 * @param {string[]} genres - Array of genre names
 * @returns {string[]} Array of unique mood IDs
 */
export const getMoodsForAlbum = (album) => {
  if (!album || !album.genre) return [];
  
  const genres = Array.isArray(album.genre) ? album.genre : [album.genre];
  const allMoods = new Set();
  
  // Add moods based on genres
  genres.forEach(genre => {
    const genreMoods = getMoodsForGenre(genre);
    genreMoods.forEach(mood => allMoods.add(mood));
  });
  
  // Add year-based nostalgic boost for older albums
  if (album.year && album.year < 2000) {
    allMoods.add('nostalgic');
  }
  
  // Add comfort mood for albums in collection longer (if we have dateAdded)
  if (album.dateAdded) {
    const addedDate = new Date(album.dateAdded);
    const monthsOwned = (Date.now() - addedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsOwned > 6) {
      allMoods.add('comfort');
    }
  }
  
  return Array.from(allMoods);
};

/**
 * Filter albums by selected mood
 * @param {Object[]} albums - Array of album objects
 * @param {string} moodId - Selected mood ID
 * @returns {Object[]} Filtered albums that match the mood
 */
export const filterAlbumsByMood = (albums, moodId) => {
  if (!albums || !moodId) return [];
  
  return albums.filter(album => {
    const albumMoods = getMoodsForAlbum(album);
    return albumMoods.includes(moodId);
  });
};

/**
 * Get mood statistics for a collection
 * @param {Object[]} albums - Array of album objects
 * @returns {Object} Mood counts and percentages
 */
export const getMoodStatistics = (albums) => {
  if (!albums || albums.length === 0) return {};
  
  const moodCounts = {};
  
  // Initialize counts
  MOOD_CATEGORIES.forEach(mood => {
    moodCounts[mood.id] = 0;
  });
  
  // Count albums per mood
  albums.forEach(album => {
    const albumMoods = getMoodsForAlbum(album);
    albumMoods.forEach(moodId => {
      if (moodCounts[moodId] !== undefined) {
        moodCounts[moodId]++;
      }
    });
  });
  
  // Calculate percentages
  const statistics = {};
  Object.entries(moodCounts).forEach(([moodId, count]) => {
    const mood = MOOD_CATEGORIES.find(m => m.id === moodId);
    statistics[moodId] = {
      count,
      percentage: Math.round((count / albums.length) * 100),
      label: mood?.label || moodId
    };
  });
  
  return statistics;
};

/**
 * Get recommended albums for a specific mood (sorted by relevance)
 * @param {Object[]} albums - Array of album objects
 * @param {string} moodId - Selected mood ID
 * @param {number} limit - Maximum number of albums to return
 * @returns {Object[]} Sorted array of albums matching the mood
 */
export const getRecommendedAlbumsForMood = (albums, moodId, limit = 10) => {
  const matchingAlbums = filterAlbumsByMood(albums, moodId);
  
  // Sort by relevance (albums with more matching moods first)
  const sortedAlbums = matchingAlbums
    .map(album => ({
      ...album,
      moodRelevance: getMoodsForAlbum(album).length
    }))
    .sort((a, b) => {
      // Primary sort: more moods = more versatile/relevant
      if (b.moodRelevance !== a.moodRelevance) {
        return b.moodRelevance - a.moodRelevance;
      }
      // Secondary sort: newer additions first (if dateAdded available)
      if (a.dateAdded && b.dateAdded) {
        return new Date(b.dateAdded) - new Date(a.dateAdded);
      }
      // Fallback: alphabetical by title
      return (a.title || '').localeCompare(b.title || '');
    });
  
  return sortedAlbums.slice(0, limit);
};

export default {
  MOOD_CATEGORIES,
  getMoodsForGenre,
  getMoodsForAlbum,
  filterAlbumsByMood,
  getMoodStatistics,
  getRecommendedAlbumsForMood
};