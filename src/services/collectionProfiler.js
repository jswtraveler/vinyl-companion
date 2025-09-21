/**
 * Collection Profiler
 * Analyzes user's album collection to build recommendation profiles
 */

import { AlbumNormalizer } from '../utils/albumNormalization.js';

export class CollectionProfiler {
  /**
   * Build comprehensive user profile from album collection
   * @param {Object[]} albums - Array of user's albums
   * @returns {Object} User profile with preferences and statistics
   */
  static buildUserProfile(albums = []) {
    if (!albums || albums.length === 0) {
      return this.getEmptyProfile();
    }

    console.log(`🎵 Building user profile from ${albums.length} albums`);

    const profile = {
      collection: {
        totalAlbums: albums.length,
        analyzedAt: new Date().toISOString()
      },
      artists: this.getTopArtists(albums),
      genres: this.getTopGenres(albums),
      eras: this.getEraDistribution(albums),
      labels: this.getTopLabels(albums),
      moods: this.getMoodDistribution(albums),
      countries: this.getCountryDistribution(albums),
      formats: this.getFormatDistribution(albums),
      tags: this.getTopTags(albums),
      diversity: this.calculateDiversityMetrics(albums),
      preferences: this.inferPreferences(albums)
    };

    console.log('🎵 User profile generated:', {
      artists: profile.artists.length,
      genres: profile.genres.length,
      topDecades: profile.eras.decades.slice(0, 3).map(d => d.decade),
      diversityScore: profile.diversity.overallScore
    });

    return profile;
  }

  /**
   * Get empty profile structure for new users
   * @returns {Object} Empty profile
   */
  static getEmptyProfile() {
    return {
      collection: { totalAlbums: 0, analyzedAt: new Date().toISOString() },
      artists: [],
      genres: [],
      eras: { decades: [], periods: [], distribution: {} },
      labels: [],
      moods: [],
      countries: [],
      formats: [],
      tags: [],
      diversity: { overallScore: 0 },
      preferences: { primaryGenres: [], primaryEras: [], primaryMoods: [] }
    };
  }

  /**
   * Analyze top artists in collection
   * @param {Object[]} albums - Album collection
   * @returns {Object[]} Top artists with statistics
   */
  static getTopArtists(albums) {
    const artistCounts = {};
    const artistYears = {};
    const artistGenres = {};

    albums.forEach(album => {
      const artist = album.artist;
      if (!artist) return;

      artistCounts[artist] = (artistCounts[artist] || 0) + 1;

      // Track years for this artist
      if (album.year) {
        if (!artistYears[artist]) artistYears[artist] = [];
        artistYears[artist].push(album.year);
      }

      // Track genres for this artist
      if (album.genre && Array.isArray(album.genre)) {
        if (!artistGenres[artist]) artistGenres[artist] = [];
        artistGenres[artist].push(...album.genre);
      }
    });

    return Object.entries(artistCounts)
      .map(([artist, count]) => ({
        artist,
        count,
        percentage: (count / albums.length) * 100,
        yearRange: artistYears[artist] ? {
          min: Math.min(...artistYears[artist]),
          max: Math.max(...artistYears[artist])
        } : null,
        primaryGenres: artistGenres[artist] ?
          [...new Set(artistGenres[artist])].slice(0, 3) : [],
        fingerprint: AlbumNormalizer.normalizeString(artist)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50 artists
  }

  /**
   * Analyze genre distribution in collection
   * @param {Object[]} albums - Album collection
   * @returns {Object[]} Genre statistics
   */
  static getTopGenres(albums) {
    const genreCounts = {};
    const genreYears = {};

    albums.forEach(album => {
      if (!album.genre || !Array.isArray(album.genre)) return;

      album.genre.forEach(genre => {
        const normalizedGenre = AlbumNormalizer.normalizeTagString(genre);
        if (!normalizedGenre) return;

        genreCounts[normalizedGenre] = (genreCounts[normalizedGenre] || 0) + 1;

        if (album.year) {
          if (!genreYears[normalizedGenre]) genreYears[normalizedGenre] = [];
          genreYears[normalizedGenre].push(album.year);
        }
      });
    });

    return Object.entries(genreCounts)
      .map(([genre, count]) => ({
        genre,
        count,
        percentage: (count / albums.length) * 100,
        avgYear: genreYears[genre] ?
          Math.round(genreYears[genre].reduce((a, b) => a + b, 0) / genreYears[genre].length) : null,
        yearRange: genreYears[genre] ? {
          min: Math.min(...genreYears[genre]),
          max: Math.max(...genreYears[genre])
        } : null
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30); // Top 30 genres
  }

  /**
   * Analyze era and decade distribution
   * @param {Object[]} albums - Album collection
   * @returns {Object} Era analysis
   */
  static getEraDistribution(albums) {
    const decadeCounts = {};
    const periodCounts = {};
    const eraCounts = {};
    const yearCounts = {};

    albums.forEach(album => {
      if (!album.year) return;

      const eraInfo = AlbumNormalizer.extractEraInfo(album.year);

      if (eraInfo.decade) {
        decadeCounts[eraInfo.decade] = (decadeCounts[eraInfo.decade] || 0) + 1;
      }

      if (eraInfo.period) {
        periodCounts[eraInfo.period] = (periodCounts[eraInfo.period] || 0) + 1;
      }

      if (eraInfo.era) {
        eraCounts[eraInfo.era] = (eraCounts[eraInfo.era] || 0) + 1;
      }

      yearCounts[album.year] = (yearCounts[album.year] || 0) + 1;
    });

    const albumsWithYears = albums.filter(a => a.year).length;

    return {
      decades: Object.entries(decadeCounts)
        .map(([decade, count]) => ({
          decade: parseInt(decade),
          count,
          percentage: (count / albumsWithYears) * 100
        }))
        .sort((a, b) => b.count - a.count),

      periods: Object.entries(periodCounts)
        .map(([period, count]) => ({
          period,
          count,
          percentage: (count / albumsWithYears) * 100
        }))
        .sort((a, b) => b.count - a.count),

      eras: Object.entries(eraCounts)
        .map(([era, count]) => ({
          era,
          count,
          percentage: (count / albumsWithYears) * 100
        }))
        .sort((a, b) => b.count - a.count),

      distribution: yearCounts
    };
  }

  /**
   * Analyze record label distribution
   * @param {Object[]} albums - Album collection
   * @returns {Object[]} Label statistics
   */
  static getTopLabels(albums) {
    const labelCounts = {};

    albums.forEach(album => {
      if (!album.label) return;

      const normalizedLabel = album.label.trim();
      labelCounts[normalizedLabel] = (labelCounts[normalizedLabel] || 0) + 1;
    });

    const albumsWithLabels = albums.filter(a => a.label).length;

    return Object.entries(labelCounts)
      .map(([label, count]) => ({
        label,
        count,
        percentage: albumsWithLabels > 0 ? (count / albumsWithLabels) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 labels
  }

  /**
   * Analyze mood distribution (from AI analysis)
   * @param {Object[]} albums - Album collection
   * @returns {Object[]} Mood statistics
   */
  static getMoodDistribution(albums) {
    const moodCounts = {};

    albums.forEach(album => {
      if (!album.moods || !Array.isArray(album.moods)) return;

      album.moods.forEach(mood => {
        const normalizedMood = AlbumNormalizer.normalizeTagString(mood);
        if (!normalizedMood) return;

        moodCounts[normalizedMood] = (moodCounts[normalizedMood] || 0) + 1;
      });
    });

    const albumsWithMoods = albums.filter(a => a.moods && a.moods.length > 0).length;

    return Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood,
        count,
        percentage: albumsWithMoods > 0 ? (count / albumsWithMoods) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze country/region distribution
   * @param {Object[]} albums - Album collection
   * @returns {Object[]} Country statistics
   */
  static getCountryDistribution(albums) {
    const countryCounts = {};

    albums.forEach(album => {
      if (!album.country) return;

      const normalizedCountry = album.country.trim();
      countryCounts[normalizedCountry] = (countryCounts[normalizedCountry] || 0) + 1;
    });

    const albumsWithCountries = albums.filter(a => a.country).length;

    return Object.entries(countryCounts)
      .map(([country, count]) => ({
        country,
        count,
        percentage: albumsWithCountries > 0 ? (count / albumsWithCountries) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze format distribution
   * @param {Object[]} albums - Album collection
   * @returns {Object[]} Format statistics
   */
  static getFormatDistribution(albums) {
    const formatCounts = {};

    albums.forEach(album => {
      const format = album.format || 'LP';
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    });

    return Object.entries(formatCounts)
      .map(([format, count]) => ({
        format,
        count,
        percentage: (count / albums.length) * 100
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get combined tags (genres + moods)
   * @param {Object[]} albums - Album collection
   * @returns {Object[]} Tag statistics
   */
  static getTopTags(albums) {
    const allTags = [];

    albums.forEach(album => {
      const tags = AlbumNormalizer.normalizeTags(album.genre, album.moods);
      allTags.push(...tags);
    });

    const tagCounts = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: (count / albums.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50 tags
  }

  /**
   * Calculate collection diversity metrics
   * @param {Object[]} albums - Album collection
   * @returns {Object} Diversity scores
   */
  static calculateDiversityMetrics(albums) {
    if (albums.length === 0) return { overallScore: 0 };

    const uniqueArtists = new Set(albums.map(a => a.artist)).size;
    const uniqueGenres = new Set(albums.flatMap(a => a.genre || [])).size;
    const uniqueDecades = new Set(albums.map(a => Math.floor(a.year / 10) * 10)).size;
    const uniqueLabels = new Set(albums.map(a => a.label).filter(Boolean)).size;

    const artistDiversity = uniqueArtists / albums.length;
    const genreDiversity = uniqueGenres / Math.max(albums.length, 1);
    const eraSpread = uniqueDecades / Math.max(albums.length / 10, 1);
    const labelDiversity = uniqueLabels / Math.max(albums.length, 1);

    const overallScore = (artistDiversity + genreDiversity + eraSpread + labelDiversity) / 4;

    return {
      overallScore: Math.min(overallScore, 1.0),
      artistDiversity,
      genreDiversity,
      eraSpread,
      labelDiversity,
      uniqueArtists,
      uniqueGenres,
      uniqueDecades,
      uniqueLabels
    };
  }

  /**
   * Infer user preferences from collection patterns
   * @param {Object[]} albums - Album collection
   * @returns {Object} Inferred preferences
   */
  static inferPreferences(albums) {
    const genres = this.getTopGenres(albums);
    const eras = this.getEraDistribution(albums);
    const moods = this.getMoodDistribution(albums);
    const artists = this.getTopArtists(albums);

    return {
      primaryGenres: genres.slice(0, 5).map(g => g.genre),
      primaryEras: eras.decades.slice(0, 3).map(d => d.decade),
      primaryMoods: moods.slice(0, 5).map(m => m.mood),
      favoriteArtists: artists.slice(0, 10).map(a => a.artist),

      // Preference strength indicators
      genreFocus: genres.length > 0 ? genres[0].percentage : 0,
      eraFocus: eras.decades.length > 0 ? eras.decades[0].percentage : 0,
      artistLoyalty: artists.length > 0 ? artists[0].percentage : 0,

      // Collection characteristics
      isEclectic: this.calculateDiversityMetrics(albums).overallScore > 0.7,
      hasStrongGenrePrefs: genres.length > 0 && genres[0].percentage > 30,
      hasEraFocus: eras.decades.length > 0 && eras.decades[0].percentage > 40,
      hasArtistFocus: artists.length > 0 && artists[0].percentage > 15
    };
  }

  /**
   * Update profile incrementally when new albums are added
   * @param {Object} currentProfile - Existing profile
   * @param {Object[]} newAlbums - New albums to incorporate
   * @returns {Object} Updated profile
   */
  static updateProfile(currentProfile, newAlbums) {
    if (!newAlbums || newAlbums.length === 0) {
      return currentProfile;
    }

    // For now, rebuild entire profile
    // In production, this could be optimized for incremental updates
    console.log(`🎵 Updating profile with ${newAlbums.length} new albums`);

    // This would need access to full collection, so just return current for now
    return {
      ...currentProfile,
      collection: {
        ...currentProfile.collection,
        totalAlbums: currentProfile.collection.totalAlbums + newAlbums.length,
        lastUpdated: new Date().toISOString()
      }
    };
  }
}

export default CollectionProfiler;