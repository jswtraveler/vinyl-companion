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
 * Get all moods for an album (AI-generated moods + genre-based fallback)
 * @param {Object} album - Album object
 * @returns {string[]} Array of mood IDs from AI analysis or genre mapping
 */
export const getMoodsForAlbum = (album) => {
  if (!album) return [];

  // First, try to get AI-generated moods
  let aiMoods = [];
  if (album.moods && Array.isArray(album.moods)) {
    // Normalize AI moods to lowercase to match MOOD_CATEGORIES IDs
    aiMoods = album.moods.map(mood => mood.toLowerCase());
  }

  // If we have AI-generated moods, use them
  if (aiMoods.length > 0) {
    return aiMoods;
  }

  // Fallback: generate moods from genres
  let genreMoods = [];
  if (album.genre && Array.isArray(album.genre)) {
    const allGenreMoods = album.genre.flatMap(genre => getMoodsForGenre(genre));
    genreMoods = [...new Set(allGenreMoods)]; // Remove duplicates
  }

  return genreMoods;
};

/**
 * Filter albums by selected mood
 * @param {Object[]} albums - Array of album objects
 * @param {string} moodId - Selected mood ID
 * @returns {Object[]} Filtered albums that match the mood
 */
export const filterAlbumsByMood = (albums, moodId) => {
  if (!albums || !moodId) return [];

  const filtered = albums.filter(album => {
    const albumMoods = getMoodsForAlbum(album);
    return albumMoods.includes(moodId);
  });

  return filtered;
};

/**
 * Get mood statistics for a collection (AI-generated + genre-based moods)
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

  // Count albums per mood (now includes both AI and genre-based moods)
  albums.forEach(album => {
    const albumMoods = getMoodsForAlbum(album); // Returns AI or genre-based moods
    albumMoods.forEach(moodId => {
      if (moodCounts[moodId] !== undefined) {
        moodCounts[moodId]++;
      }
    });
  });

  // Calculate percentages based on all albums that have any moods (AI or genre-based)
  const albumsWithMoods = albums.filter(album => {
    const moods = getMoodsForAlbum(album);
    return moods.length > 0;
  });
  const totalWithMoods = albumsWithMoods.length;

  const statistics = {};
  Object.entries(moodCounts).forEach(([moodId, count]) => {
    const mood = MOOD_CATEGORIES.find(m => m.id === moodId);
    statistics[moodId] = {
      count,
      percentage: totalWithMoods > 0 ? Math.round((count / totalWithMoods) * 100) : 0,
      label: mood?.label || moodId
    };
  });

  return statistics;
};

/**
 * Get recommended albums for a specific mood (AI-tagged + genre-based albums)
 * @param {Object[]} albums - Array of album objects
 * @param {string} moodId - Selected mood ID
 * @param {number} limit - Maximum number of albums to return
 * @returns {Object[]} Sorted array of albums matching the mood
 */
export const getRecommendedAlbumsForMood = (albums, moodId, limit = 10) => {
  const matchingAlbums = filterAlbumsByMood(albums, moodId);

  // Sort by relevance (AI-tagged albums first, then by mood count, then by date added)
  const sortedAlbums = matchingAlbums
    .map(album => ({
      ...album,
      aiMoodCount: (album.moods || []).length, // AI-generated moods
      totalMoodCount: getMoodsForAlbum(album).length // Total moods (AI + genre-based)
    }))
    .sort((a, b) => {
      // Primary sort: AI-analyzed albums first (they have more accurate mood data)
      if (a.aiMoodCount > 0 && b.aiMoodCount === 0) return -1;
      if (b.aiMoodCount > 0 && a.aiMoodCount === 0) return 1;

      // Secondary sort: albums with more total moods = more versatile
      if (b.totalMoodCount !== a.totalMoodCount) {
        return b.totalMoodCount - a.totalMoodCount;
      }

      // Tertiary sort: newer additions first (if dateAdded available)
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