/**
 * Curated "vibe" playlists for the Vibes feature.
 *
 * A MoodPlaylist is a curated "vibe" the user can generate from their own collection.
 * It resolves to albums via `match`, then orders them via `order`.
 *
 * match: {
 *   moods?:   string[]   // any of these underlying mood IDs (from moodUtils MOOD_CATEGORIES) qualifies
 *   genres?:  string[]   // any of these genres qualifies (case-insensitive substring match)
 *   yearMax?: number     // album.year <= yearMax
 *   yearMin?: number     // album.year >= yearMin
 *   requireAll?: boolean // if true, album must match moods AND genres (default: OR across all clauses)
 * }
 * order: 'energy-asc' | 'energy-desc' | 'shuffle' | 'newest' | 'oldest' | 'chronological'
 * targetMinutes / targetCount handled by the builder, not here.
 */
export const MOOD_PLAYLISTS = [
  {
    id: 'lazy-sunday',
    name: 'Lazy Sunday',
    subtitle: 'Slow, warm, unhurried',
    emoji: '☕',
    color: '#c8863a',
    match: { moods: ['sunday_morning', 'chill', 'comfort'], genres: ['Jazz', 'Folk', 'Soul', 'Blues'] },
    order: 'energy-asc'
  },
  {
    id: 'prog-journey',
    name: 'Prog Journey',
    subtitle: 'Long-form, expansive listening',
    emoji: '🌌',
    color: '#7c5cbf',
    match: { moods: ['epic', 'dreamy'], genres: ['Progressive Rock', 'Psychedelic Rock'] },
    order: 'shuffle'
  },
  {
    id: 'full-volume',
    name: 'Full Volume',
    subtitle: 'Loud and unapologetic',
    emoji: '🔊',
    color: '#c8433a',
    match: { moods: ['energetic', 'raw'], genres: ['Hard Rock', 'Heavy Metal', 'Metal'] },
    order: 'energy-desc'
  },
  {
    id: 'open-road',
    name: 'Open Road',
    subtitle: 'Windows down, miles to go',
    emoji: '🛣️',
    color: '#d98a3d',
    match: { moods: ['road_trip'], genres: ['Rock', 'Classic Rock', 'Blues Rock'] },
    order: 'energy-desc'
  },
  {
    id: 'smoky-blues',
    name: 'Smoky Blues',
    subtitle: 'Low light, slow burn',
    emoji: '🥃',
    color: '#9c6b3f',
    match: { moods: ['bluesy', 'melancholic'], genres: ['Blues', 'Blues Rock', 'Soul'] },
    order: 'shuffle'
  },
  {
    id: '70s-time-machine',
    name: "'70s Time Machine",
    subtitle: 'Straight from the decade',
    emoji: '📼',
    color: '#b3763f',
    match: { moods: ['nostalgic'], yearMin: 1970, yearMax: 1979 },
    order: 'chronological'
  },
  {
    id: 'late-night-spin',
    name: 'Late Night Spin',
    subtitle: 'After hours, low and dreamy',
    emoji: '🌃',
    color: '#3f4c9c',
    match: { moods: ['late_night', 'dreamy'] },
    order: 'energy-asc'
  },
  {
    id: 'classic-rock-radio',
    name: 'Classic Rock Radio',
    subtitle: 'The reliable favorites',
    emoji: '📻',
    color: '#c8863a',
    match: { genres: ['Classic Rock', 'Rock'], moods: ['nostalgic', 'upbeat'] },
    order: 'shuffle'
  },
  {
    id: 'psychedelic-trip',
    name: 'Psychedelic Trip',
    subtitle: 'Swirling, technicolor sound',
    emoji: '🍄',
    color: '#b03fa0',
    match: { moods: ['dreamy', 'epic'], genres: ['Psychedelic Rock', 'Psychedelic'] },
    order: 'shuffle'
  },
  {
    id: 'sunday-jazz',
    name: 'Sunday Jazz',
    subtitle: 'Coffee, sunlight, brushes on snare',
    emoji: '🎷',
    color: '#3f7c9c',
    match: { genres: ['Jazz'], moods: ['chill', 'sunday_morning'] },
    order: 'shuffle'
  },
  {
    id: 'raw-power',
    name: 'Raw Power',
    subtitle: 'Unpolished and driving',
    emoji: '⚡',
    color: '#c8433a',
    match: { moods: ['raw', 'energetic'], genres: ['Hard Rock', 'Blues Rock', 'Punk'] },
    order: 'energy-desc'
  },
  {
    id: 'rainy-day',
    name: 'Rainy Day',
    subtitle: 'Grey skies, soft edges',
    emoji: '🌧️',
    color: '#5c6b7c',
    match: { moods: ['melancholic', 'dreamy', 'comfort'] },
    order: 'energy-asc'
  },
  {
    id: 'heartbreak',
    name: 'Heartbreak Hour',
    subtitle: 'For the hard nights',
    emoji: '💔',
    color: '#9c3f5c',
    match: { moods: ['melancholic'], genres: ['Blues', 'Soul'] },
    order: 'shuffle'
  },
  {
    id: 'feel-good',
    name: 'Feel Good',
    subtitle: 'Sunshine in record form',
    emoji: '☀️',
    color: '#d9b23d',
    match: { moods: ['upbeat', 'comfort'], genres: ['Soul', 'Oldies', 'Pop'] },
    order: 'shuffle'
  },
  {
    id: 'deep-cuts',
    name: 'Deep Cuts',
    subtitle: 'Album tracks, not the singles',
    emoji: '🕯️',
    color: '#4c4438',
    match: { moods: ['late_night', 'raw'], genres: ['Progressive Rock', 'Blues', 'Jazz'] },
    order: 'shuffle'
  },
  {
    id: 'dance-party',
    name: 'Dance Party',
    subtitle: 'Get the room moving',
    emoji: '🪩',
    color: '#c83aa0',
    match: { moods: ['party', 'upbeat', 'energetic'], genres: ['Funk', 'Soul', 'Pop'] },
    order: 'energy-desc'
  },
  {
    id: 'comfort-worn',
    name: 'Comfort & Worn Grooves',
    subtitle: 'Records you already know by heart',
    emoji: '🧡',
    color: '#e8a040',
    match: { moods: ['comfort', 'nostalgic'] },
    order: 'shuffle'
  },
  {
    id: 'epic-side-a',
    name: 'Epic Side A',
    subtitle: 'Openers that fill the room',
    emoji: '💿',
    color: '#7c5cbf',
    match: { moods: ['epic'], genres: ['Progressive Rock', 'Rock'] },
    order: 'energy-desc'
  },
  {
    id: 'blue-eyed-soul',
    name: 'After Hours Soul',
    subtitle: 'Smooth and unhurried',
    emoji: '🍸',
    color: '#3f7c9c',
    match: { moods: ['bluesy', 'late_night'], genres: ['Soul', 'R&B', 'Blues'] },
    order: 'energy-asc'
  },
  {
    id: '60s-roots',
    name: "'60s & Early Roots",
    subtitle: 'Where it all started',
    emoji: '🎸',
    color: '#a3763f',
    match: { moods: ['nostalgic'], yearMin: 1960, yearMax: 1972 },
    order: 'chronological'
  },
  {
    id: 'high-energy-rock',
    name: 'Wake Up Loud',
    subtitle: 'Morning jolt, no coffee needed',
    emoji: '📢',
    color: '#c8433a',
    match: { moods: ['energetic'], genres: ['Rock', 'Hard Rock'] },
    order: 'energy-desc'
  },
  {
    id: 'folk-fireside',
    name: 'Folk & Fireside',
    subtitle: 'Acoustic, close, familiar',
    emoji: '🔥',
    color: '#b3763f',
    match: { moods: ['comfort', 'nostalgic'], genres: ['Folk', 'Folk Rock'] },
    order: 'shuffle'
  }
];

export const getMoodPlaylistById = (id) => MOOD_PLAYLISTS.find(p => p.id === id) || null;

export default MOOD_PLAYLISTS;
