/**
 * Recommendation Data Fetcher
 * Orchestrates external data collection from Last.fm and other sources
 */

import { AlbumNormalizer } from '../utils/albumNormalization.js';

export class RecommendationDataFetcher {
  constructor(lastfmClient, options = {}) {
    this.lastfm = lastfmClient;
    this.options = {
      maxSimilarArtists: 20,
      maxAlbumsPerTag: 30,
      maxTagsToProcess: 10,
      maxArtistsToProcess: 15,
      requestDelayMs: 1000,
      ...options
    };

    this.results = {
      similarArtists: {},
      tagAlbums: {},
      artistInfo: {},
      candidateAlbums: new Map(),
      metadata: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        startTime: null,
        endTime: null
      }
    };
  }

  /**
   * Fetch external data based on user profile
   * @param {Object} profile - User collection profile
   * @returns {Promise<Object>} Aggregated external data
   */
  async fetchForUserProfile(profile) {
    console.log('🎵 Starting external data fetch for user profile');
    this.results.metadata.startTime = Date.now();

    try {
      // Reset results for new fetch
      this.resetResults();

      // Fetch similar artists for top artists
      await this.fetchSimilarArtistsData(profile.artists);

      // Fetch top albums for popular genres
      await this.fetchGenreAlbumsData(profile.genres);

      // Fetch additional artist information
      await this.fetchArtistInfoData(profile.artists);

      // Process and aggregate results
      this.aggregateResults();

      this.results.metadata.endTime = Date.now();
      this.results.metadata.duration = this.results.metadata.endTime - this.results.metadata.startTime;

      console.log('🎵 External data fetch completed:', {
        totalRequests: this.results.metadata.totalRequests,
        successful: this.results.metadata.successfulRequests,
        failed: this.results.metadata.failedRequests,
        duration: `${this.results.metadata.duration}ms`,
        candidateAlbums: this.results.candidateAlbums.size
      });

      return this.results;

    } catch (error) {
      console.error('🎵 External data fetch failed:', error);
      this.results.metadata.endTime = Date.now();
      throw error;
    }
  }

  /**
   * Reset results for new fetch operation
   */
  resetResults() {
    this.results.similarArtists = {};
    this.results.tagAlbums = {};
    this.results.artistInfo = {};
    this.results.candidateAlbums.clear();
    this.results.metadata = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      startTime: Date.now(),
      endTime: null
    };
  }

  /**
   * Fetch similar artists for top artists in user's collection
   * @param {Object[]} topArtists - User's top artists
   */
  async fetchSimilarArtistsData(topArtists) {
    const artistsToProcess = topArtists
      .slice(0, this.options.maxArtistsToProcess)
      .filter(artistData => artistData.artist && artistData.count >= 2); // Only process artists with multiple albums

    console.log(`🎵 Fetching similar artists for ${artistsToProcess.length} artists`);

    for (const artistData of artistsToProcess) {
      try {
        await this.delay(this.options.requestDelayMs);

        const response = await this.lastfm.getSimilarArtists(
          artistData.artist,
          this.options.maxSimilarArtists
        );

        this.results.metadata.totalRequests++;

        if (response?.similarartists?.artist) {
          this.results.similarArtists[artistData.artist] = {
            sourceArtist: artistData.artist,
            sourceData: artistData,
            similarArtists: response.similarartists.artist.map(artist => ({
              name: artist.name,
              match: parseFloat(artist.match) || 0,
              mbid: artist.mbid || null,
              url: artist.url || null,
              streamable: artist.streamable === '1',
              image: this.extractImageUrl(artist.image)
            }))
          };

          this.results.metadata.successfulRequests++;
          console.log(`✅ Found ${response.similarartists.artist.length} similar artists for ${artistData.artist}`);
        } else {
          console.log(`⚠️ No similar artists found for ${artistData.artist}`);
        }

      } catch (error) {
        console.error(`❌ Failed to fetch similar artists for ${artistData.artist}:`, error);
        this.results.metadata.failedRequests++;
      }
    }
  }

  /**
   * Fetch top albums for user's favorite genres
   * @param {Object[]} topGenres - User's top genres
   */
  async fetchGenreAlbumsData(topGenres) {
    const genresToProcess = topGenres
      .slice(0, this.options.maxTagsToProcess)
      .filter(genreData => genreData.genre && genreData.count >= 3); // Only process significant genres

    console.log(`🎵 Fetching albums for ${genresToProcess.length} genres`);

    for (const genreData of genresToProcess) {
      try {
        await this.delay(this.options.requestDelayMs);

        const response = await this.lastfm.getTopAlbumsByTag(
          genreData.genre,
          this.options.maxAlbumsPerTag
        );

        this.results.metadata.totalRequests++;

        if (response?.albums?.album) {
          this.results.tagAlbums[genreData.genre] = {
            sourceTag: genreData.genre,
            sourceData: genreData,
            albums: response.albums.album.map(album => ({
              name: album.name,
              artist: {
                name: album.artist.name,
                mbid: album.artist.mbid || null,
                url: album.artist.url || null
              },
              mbid: album.mbid || null,
              url: album.url || null,
              playcount: parseInt(album.playcount) || 0,
              rank: parseInt(album['@attr']?.rank) || 0,
              image: this.extractImageUrl(album.image),
              fingerprint: AlbumNormalizer.createFingerprint(album.artist.name, album.name)
            }))
          };

          this.results.metadata.successfulRequests++;
          console.log(`✅ Found ${response.albums.album.length} albums for genre ${genreData.genre}`);
        } else {
          console.log(`⚠️ No albums found for genre ${genreData.genre}`);
        }

      } catch (error) {
        console.error(`❌ Failed to fetch albums for genre ${genreData.genre}:`, error);
        this.results.metadata.failedRequests++;
      }
    }
  }

  /**
   * Fetch detailed artist information for top artists
   * @param {Object[]} topArtists - User's top artists
   */
  async fetchArtistInfoData(topArtists) {
    const artistsToProcess = topArtists
      .slice(0, Math.min(5, this.options.maxArtistsToProcess)) // Limit to top 5 for detailed info
      .filter(artistData => artistData.count >= 3); // Only highly represented artists

    console.log(`🎵 Fetching detailed info for ${artistsToProcess.length} artists`);

    for (const artistData of artistsToProcess) {
      try {
        await this.delay(this.options.requestDelayMs);

        const response = await this.lastfm.getArtistInfo(artistData.artist);

        this.results.metadata.totalRequests++;

        if (response?.artist) {
          const artist = response.artist;
          this.results.artistInfo[artistData.artist] = {
            sourceArtist: artistData.artist,
            sourceData: artistData,
            name: artist.name,
            mbid: artist.mbid || null,
            url: artist.url || null,
            streamable: artist.streamable === '1',
            playcount: parseInt(artist.stats?.playcount) || 0,
            listeners: parseInt(artist.stats?.listeners) || 0,
            bio: artist.bio ? {
              published: artist.bio.published || null,
              summary: artist.bio.summary || null,
              content: artist.bio.content || null
            } : null,
            tags: artist.tags?.tag ? artist.tags.tag.map(tag => ({
              name: tag.name,
              url: tag.url || null
            })) : [],
            similar: artist.similar?.artist ? artist.similar.artist.map(similar => ({
              name: similar.name,
              url: similar.url || null
            })) : [],
            image: this.extractImageUrl(artist.image)
          };

          this.results.metadata.successfulRequests++;
          console.log(`✅ Fetched detailed info for ${artistData.artist}`);
        }

      } catch (error) {
        console.error(`❌ Failed to fetch artist info for ${artistData.artist}:`, error);
        this.results.metadata.failedRequests++;
      }
    }
  }

  /**
   * Aggregate and process all fetched data into candidate albums
   */
  aggregateResults() {
    console.log('🎵 Aggregating results into candidate albums');

    // Add albums from similar artists
    this.addCandidatesFromSimilarArtists();

    // Add albums from genre tags
    this.addCandidatesFromGenreTags();

    console.log(`🎵 Aggregation complete: ${this.results.candidateAlbums.size} candidate albums`);
  }

  /**
   * Add candidate albums derived from similar artists
   */
  addCandidatesFromSimilarArtists() {
    Object.values(this.results.similarArtists).forEach(artistData => {
      artistData.similarArtists.forEach(similarArtist => {
        // Create placeholder candidate - would need additional API calls for actual albums
        const candidateFingerprint = `similar_artist::${AlbumNormalizer.normalizeString(similarArtist.name)}`;

        if (!this.results.candidateAlbums.has(candidateFingerprint)) {
          this.results.candidateAlbums.set(candidateFingerprint, {
            type: 'similar_artist',
            artist: similarArtist.name,
            title: null, // Would need additional lookup
            fingerprint: candidateFingerprint,
            sourceArtist: artistData.sourceArtist,
            similarity: similarArtist.match,
            mbid: similarArtist.mbid,
            image: similarArtist.image,
            metadata: {
              source: 'lastfm_similar_artists',
              fetchedAt: Date.now()
            }
          });
        }
      });
    });
  }

  /**
   * Add candidate albums from genre tags
   */
  addCandidatesFromGenreTags() {
    Object.values(this.results.tagAlbums).forEach(tagData => {
      tagData.albums.forEach(album => {
        const fingerprint = album.fingerprint;

        if (!this.results.candidateAlbums.has(fingerprint)) {
          this.results.candidateAlbums.set(fingerprint, {
            type: 'genre_match',
            artist: album.artist.name,
            title: album.name,
            fingerprint,
            sourceTag: tagData.sourceTag,
            playcount: album.playcount,
            rank: album.rank,
            mbid: album.mbid,
            artistMbid: album.artist.mbid,
            image: album.image,
            url: album.url,
            metadata: {
              source: 'lastfm_tag_albums',
              fetchedAt: Date.now()
            }
          });
        } else {
          // Album already exists from another source - add this as additional context
          const existing = this.results.candidateAlbums.get(fingerprint);
          if (!existing.additionalSources) {
            existing.additionalSources = [];
          }
          existing.additionalSources.push({
            type: 'genre_match',
            sourceTag: tagData.sourceTag,
            rank: album.rank,
            playcount: album.playcount
          });
        }
      });
    });
  }

  /**
   * Extract image URL from Last.fm image array
   * @param {Object[]|undefined} images - Last.fm image array
   * @returns {string|null} Image URL
   */
  extractImageUrl(images) {
    if (!images || !Array.isArray(images)) return null;

    // Prefer larger images
    const sizePreference = ['extralarge', 'large', 'medium', 'small'];

    for (const preferredSize of sizePreference) {
      const image = images.find(img => img.size === preferredSize);
      if (image && image['#text']) {
        return image['#text'];
      }
    }

    // Fallback to first available image
    const firstImage = images.find(img => img['#text']);
    return firstImage ? firstImage['#text'] : null;
  }

  /**
   * Delay helper for rate limiting
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current fetch statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.results.metadata,
      successRate: this.results.metadata.totalRequests > 0 ?
        (this.results.metadata.successfulRequests / this.results.metadata.totalRequests) * 100 : 0,
      candidateCount: this.results.candidateAlbums.size,
      sourcesCount: {
        similarArtists: Object.keys(this.results.similarArtists).length,
        tagAlbums: Object.keys(this.results.tagAlbums).length,
        artistInfo: Object.keys(this.results.artistInfo).length
      }
    };
  }

  /**
   * Export results for caching or further processing
   * @returns {Object} Serializable results
   */
  exportResults() {
    return {
      similarArtists: this.results.similarArtists,
      tagAlbums: this.results.tagAlbums,
      artistInfo: this.results.artistInfo,
      candidateAlbums: Object.fromEntries(this.results.candidateAlbums),
      metadata: this.results.metadata
    };
  }
}

export default RecommendationDataFetcher;