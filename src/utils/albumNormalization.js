/**
 * Album Normalization Utilities
 * Handles fingerprinting, normalization, and data standardization for recommendation engine
 */

export class AlbumNormalizer {
  /**
   * Create a unique fingerprint for an album based on artist and title
   * @param {string} artist - Artist name
   * @param {string} title - Album title
   * @returns {string} Normalized fingerprint in format "artist::title"
   */
  static createFingerprint(artist, title) {
    if (!artist || !title) {
      throw new Error('Artist and title are required for fingerprinting');
    }

    const normalizedArtist = this.normalizeString(artist);
    const normalizedTitle = this.normalizeString(title);
    return `${normalizedArtist}::${normalizedTitle}`;
  }

  /**
   * Normalize a string for consistent matching
   * @param {string} str - String to normalize
   * @returns {string} Normalized string
   */
  static normalizeString(str) {
    if (!str || typeof str !== 'string') return '';

    return str
      .toLowerCase()
      .trim()
      // Remove common prefixes and suffixes
      .replace(/^(the\s+|a\s+|an\s+)/i, '')
      .replace(/(\s+\(.*\)|\s+\[.*\])$/, '') // Remove parenthetical info
      // Normalize punctuation and special characters
      .replace(/[^\w\s]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract MusicBrainz artist IDs from various metadata sources
   * @param {Object} metadata - Album metadata object
   * @returns {string[]} Array of unique MusicBrainz IDs
   */
  static extractArtistMBIDs(metadata = {}) {
    const mbids = [];

    // Primary artist ID
    if (metadata.musicbrainzId) {
      mbids.push(metadata.musicbrainzId);
    }

    // Artist-specific MBID if available
    if (metadata.artistMBID) {
      mbids.push(metadata.artistMBID);
    }

    // From API responses
    if (metadata.musicbrainzData?.artist?.id) {
      mbids.push(metadata.musicbrainzData.artist.id);
    }

    // From external sources
    if (metadata.lastfmData?.artist?.mbid) {
      mbids.push(metadata.lastfmData.artist.mbid);
    }

    return [...new Set(mbids.filter(Boolean))];
  }

  /**
   * Normalize and combine genre and mood tags
   * @param {string[]} genres - Array of genre strings
   * @param {string[]} moods - Array of mood strings
   * @returns {string[]} Array of normalized tags
   */
  static normalizeTags(genres = [], moods = []) {
    const allTags = [...(genres || []), ...(moods || [])];

    return [...new Set(
      allTags
        .filter(Boolean)
        .map(tag => this.normalizeTagString(tag))
        .filter(Boolean)
    )];
  }

  /**
   * Normalize a single tag string
   * @param {string} tag - Tag to normalize
   * @returns {string} Normalized tag
   */
  static normalizeTagString(tag) {
    if (!tag || typeof tag !== 'string') return '';

    return tag
      .toLowerCase()
      .trim()
      // Remove common variations and normalize
      .replace(/[&+]/g, 'and')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Extract and normalize era/decade information
   * @param {number} year - Release year
   * @returns {Object} Era information with decade, period, etc.
   */
  static extractEraInfo(year) {
    if (!year || typeof year !== 'number') {
      return {
        decade: null,
        period: null,
        era: null
      };
    }

    const decade = Math.floor(year / 10) * 10;
    let period = '';
    let era = '';

    // Assign period labels
    if (year >= 2020) period = '2020s';
    else if (year >= 2010) period = '2010s';
    else if (year >= 2000) period = '2000s';
    else if (year >= 1990) period = '90s';
    else if (year >= 1980) period = '80s';
    else if (year >= 1970) period = '70s';
    else if (year >= 1960) period = '60s';
    else if (year >= 1950) period = '50s';
    else if (year >= 1940) period = '40s';
    else period = 'vintage';

    // Assign broader era labels
    if (year >= 2000) era = 'modern';
    else if (year >= 1980) era = 'contemporary';
    else if (year >= 1960) era = 'classic';
    else era = 'vintage';

    return {
      decade,
      period,
      era,
      year
    };
  }

  /**
   * Calculate similarity between two tag arrays using Jaccard similarity
   * @param {string[]} tags1 - First tag array
   * @param {string[]} tags2 - Second tag array
   * @returns {number} Similarity score between 0 and 1
   */
  static calculateTagSimilarity(tags1 = [], tags2 = []) {
    if (!tags1.length && !tags2.length) return 0;
    if (!tags1.length || !tags2.length) return 0;

    const set1 = new Set(tags1.map(tag => this.normalizeTagString(tag)));
    const set2 = new Set(tags2.map(tag => this.normalizeTagString(tag)));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate era similarity between two years
   * @param {number} year1 - First year
   * @param {number} year2 - Second year
   * @returns {number} Similarity score between 0 and 1
   */
  static calculateEraSimilarity(year1, year2) {
    if (!year1 || !year2) return 0;

    const yearDiff = Math.abs(year1 - year2);

    // Perfect match
    if (yearDiff === 0) return 1.0;

    // Same decade = high similarity
    if (yearDiff <= 5) return 0.9;
    if (yearDiff <= 10) return 0.7;

    // Adjacent decades = medium similarity
    if (yearDiff <= 15) return 0.5;
    if (yearDiff <= 20) return 0.3;

    // Distant decades = low similarity
    if (yearDiff <= 30) return 0.1;

    return 0.0;
  }

  /**
   * Validate and clean album data for recommendation processing
   * @param {Object} album - Album object to validate
   * @returns {Object} Cleaned album object with normalized fields
   */
  static validateAndCleanAlbum(album) {
    if (!album || typeof album !== 'object') {
      throw new Error('Invalid album object');
    }

    if (!album.artist || !album.title) {
      throw new Error('Album must have artist and title');
    }

    return {
      ...album,
      fingerprint: this.createFingerprint(album.artist, album.title),
      normalizedArtist: this.normalizeString(album.artist),
      normalizedTitle: this.normalizeString(album.title),
      tags: this.normalizeTags(album.genre, album.moods),
      artistMbids: this.extractArtistMBIDs(album.metadata || {}),
      eraInfo: this.extractEraInfo(album.year)
    };
  }

  /**
   * Check if two albums are likely the same release
   * @param {Object} album1 - First album
   * @param {Object} album2 - Second album
   * @returns {boolean} True if albums appear to be the same
   */
  static areAlbumsEquivalent(album1, album2) {
    if (!album1 || !album2) return false;

    // Check fingerprint match
    const fp1 = album1.fingerprint || this.createFingerprint(album1.artist, album1.title);
    const fp2 = album2.fingerprint || this.createFingerprint(album2.artist, album2.title);

    if (fp1 === fp2) return true;

    // Check external ID matches
    const ids1 = {
      musicbrainz: album1.musicbrainzId || album1.metadata?.musicbrainzId,
      discogs: album1.discogsId || album1.metadata?.discogsId,
      spotify: album1.spotifyId || album1.metadata?.spotifyId
    };

    const ids2 = {
      musicbrainz: album2.musicbrainzId || album2.metadata?.musicbrainzId,
      discogs: album2.discogsId || album2.metadata?.discogsId,
      spotify: album2.spotifyId || album2.metadata?.spotifyId
    };

    // Any matching external ID indicates same album
    return (ids1.musicbrainz && ids1.musicbrainz === ids2.musicbrainz) ||
           (ids1.discogs && ids1.discogs === ids2.discogs) ||
           (ids1.spotify && ids1.spotify === ids2.spotify);
  }
}

export default AlbumNormalizer;