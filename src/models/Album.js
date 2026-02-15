/**
 * Album Data Model Schema
 * Comprehensive schema for vinyl record collection management
 */

// Album formats
export const ALBUM_FORMATS = [
  'LP',      // Long Play (12" 33⅓ RPM)
  'EP',      // Extended Play
  'Single',  // 7" 45 RPM
  '10"',     // 10 inch record
  'Box Set', // Multiple record set
  'Picture Disc',
  'Colored Vinyl',
  'Compilation'
];

// Record speeds
export const RECORD_SPEEDS = [
  '33⅓ RPM',
  '45 RPM',
  '78 RPM'
];

// Condition grades (Goldmine Standard)
export const CONDITION_GRADES = [
  'Mint (M)',
  'Near Mint (NM)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)'
];

// Common music genres
export const MUSIC_GENRES = [
  'Rock',
  'Pop',
  'Jazz',
  'Blues',
  'Classical',
  'Folk',
  'Country',
  'R&B/Soul',
  'Hip Hop',
  'Electronic',
  'Punk',
  'Metal',
  'Alternative',
  'Indie',
  'World',
  'Soundtrack',
  'Other'
];

/**
 * Complete Album Schema Definition
 * Based on claude.md specifications and industry standards
 */
export const AlbumSchema = {
  // Core identification
  id: {
    type: 'string',
    required: true,
    description: 'Unique identifier for the album',
    example: 'album_1642532800000_abc123def'
  },
  
  // Basic album information
  title: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 200,
    description: 'Album title',
    example: 'The Dark Side of the Moon'
  },
  
  artist: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 200,
    description: 'Primary artist or band name',
    example: 'Pink Floyd'
  },
  
  year: {
    type: 'number',
    required: false,
    min: 1877, // First recorded music
    max: new Date().getFullYear() + 1,
    description: 'Original release year',
    example: 1973
  },
  
  // Physical record details
  format: {
    type: 'string',
    required: false,
    enum: ALBUM_FORMATS,
    default: 'LP',
    description: 'Physical format of the record',
    example: 'LP'
  },
  
  speed: {
    type: 'string',
    required: false,
    enum: RECORD_SPEEDS,
    default: '33⅓ RPM',
    description: 'Playback speed',
    example: '33⅓ RPM'
  },
  
  condition: {
    type: 'string',
    required: false,
    enum: CONDITION_GRADES,
    default: 'Very Good (VG)',
    description: 'Physical condition grade',
    example: 'Near Mint (NM)'
  },
  
  // Music classification
  genre: {
    type: 'array',
    required: false,
    items: {
      type: 'string',
      enum: MUSIC_GENRES
    },
    description: 'Music genres (can be multiple)',
    example: ['Rock', 'Progressive Rock']
  },
  
  // Record label information
  label: {
    type: 'string',
    required: false,
    maxLength: 100,
    description: 'Record label name',
    example: 'Harvest Records'
  },
  
  catalogNumber: {
    type: 'string',
    required: false,
    maxLength: 50,
    description: 'Catalog/matrix number',
    example: 'SHVL 804'
  },
  
  // Collection management
  purchasePrice: {
    type: 'number',
    required: false,
    min: 0,
    description: 'Purchase price in user currency',
    example: 25.99
  },
  
  purchaseLocation: {
    type: 'string',
    required: false,
    maxLength: 200,
    description: 'Where the record was purchased',
    example: 'Downtown Records, NYC'
  },
  
  notes: {
    type: 'string',
    required: false,
    maxLength: 1000,
    description: 'Personal notes about the record',
    example: 'First pressing, includes original poster insert'
  },
  
  // Media storage
  coverImage: {
    type: 'string',
    required: false,
    description: 'Base64 encoded image or URL',
    example: 'data:image/jpeg;base64,/9j/4AAQ...'
  },
  
  // Track listing
  tracks: {
    type: 'array',
    required: false,
    items: {
      type: 'object',
      properties: {
        number: { type: 'number', required: true },
        title: { type: 'string', required: true, maxLength: 200 },
        duration: { type: 'string', required: false }, // Format: "MM:SS"
        side: { type: 'string', required: false } // A, B, C, D for multi-disc
      }
    },
    description: 'Track listing',
    example: [
      { number: 1, title: 'Speak to Me', duration: '1:30', side: 'A' },
      { number: 2, title: 'Breathe (In the Air)', duration: '2:43', side: 'A' }
    ]
  },
  
  // Timestamps
  dateAdded: {
    type: 'string',
    required: true,
    format: 'ISO8601',
    description: 'When record was added to collection',
    example: '2024-01-18T10:30:00.000Z'
  },
  
  dateModified: {
    type: 'string',
    required: false,
    format: 'ISO8601',
    description: 'Last modification timestamp',
    example: '2024-01-20T15:45:00.000Z'
  },
  
  // Identification metadata
  identificationMethod: {
    type: 'string',
    required: false,
    enum: ['manual', 'reverse-image-search', 'audio-fingerprint', 'ocr', 'barcode'],
    description: 'How the album was identified',
    example: 'reverse-image-search'
  },
  
  metadata: {
    type: 'object',
    required: false,
    properties: {
      musicbrainzId: { type: 'string' },
      discogsId: { type: 'string' },
      spotifyId: { type: 'string' },
      lastfmUrl: { type: 'string' }
    },
    description: 'External database IDs',
    example: {
      musicbrainzId: 'b84ee12a-09ef-421b-82de-0441a926375a',
      discogsId: '163813'
    }
  }
};

/**
 * Create a new album with default values
 */
export const createNewAlbum = (overrides = {}) => {
  const now = new Date().toISOString();
  
  return {
    id: `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: '',
    artist: '',
    year: null,
    format: 'LP',
    speed: '33⅓ RPM',
    condition: 'Very Good (VG)',
    genre: [],
    label: '',
    catalogNumber: '',
    purchasePrice: null,
    purchaseLocation: '',
    notes: '',
    thumb: null,
    coverImage: null,
    tracks: [],
    dateAdded: now,
    dateModified: null,
    identificationMethod: 'manual',
    metadata: {},
    ...overrides
  };
};

/**
 * Validate album data against schema
 */
export const validateAlbum = (album, mode = 'add') => {
  const errors = [];
  
  // Required fields
  if (!album.title || album.title.trim().length === 0) {
    errors.push('Album title is required');
  }
  
  if (!album.artist || album.artist.trim().length === 0) {
    errors.push('Artist name is required');
  }
  
  // Only require ID for updates, not for new albums
  if (mode === 'edit' && !album.id) {
    errors.push('Album ID is required for updates');
  }
  
  // Field length validations
  if (album.title && album.title.length > 200) {
    errors.push('Album title must be 200 characters or less');
  }
  
  if (album.artist && album.artist.length > 200) {
    errors.push('Artist name must be 200 characters or less');
  }
  
  // Year validation
  if (album.year !== null && album.year !== undefined) {
    const currentYear = new Date().getFullYear();
    if (album.year < 1877 || album.year > currentYear + 1) {
      errors.push(`Year must be between 1877 and ${currentYear + 1}`);
    }
  }
  
  // Enum validations
  if (album.format && !ALBUM_FORMATS.includes(album.format)) {
    errors.push('Invalid album format');
  }
  
  if (album.speed && !RECORD_SPEEDS.includes(album.speed)) {
    errors.push('Invalid record speed');
  }
  
  if (album.condition && !CONDITION_GRADES.includes(album.condition)) {
    errors.push('Invalid condition grade');
  }
  
  // Genre validation
  if (album.genre && Array.isArray(album.genre)) {
    const invalidGenres = album.genre.filter(g => !MUSIC_GENRES.includes(g));
    if (invalidGenres.length > 0) {
      errors.push(`Invalid genres: ${invalidGenres.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default AlbumSchema;