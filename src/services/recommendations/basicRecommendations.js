/**
 * Pure (non-React) functions for basic similarity-based artist recommendations.
 * These are extracted from ArtistRecommendationSection to keep the component lean
 * and to make the logic independently testable.
 */

/**
 * Merge fetched metadata into artist recommendation objects.
 * @param {Array} artists
 * @param {Object} artistMetadataMap - artistName -> metadata
 * @returns {Array}
 */
export function mergeMetadataIntoArtists(artists, artistMetadataMap) {
  return artists.map(artist => {
    const metadata = artistMetadataMap[artist.artist];

    if (metadata) {
      const genres = metadata.genres ||
        (metadata.tags ? metadata.tags.map(tag =>
          typeof tag === 'object' ? tag.name : tag
        ).filter(Boolean).slice(0, 3) : []);

      return {
        ...artist,
        image: metadata.spotifyImage || artist.image || null,
        spotifyId: metadata.spotifyId || null,
        spotifyUrl: metadata.spotifyUrl || null,
        metadata: {
          tags: metadata.tags || [],
          genres,
          playcount: metadata.playcount || 0,
          listeners: metadata.listeners || 0,
          bio: metadata.bio || null,
          spotifyImage: metadata.spotifyImage || null
        }
      };
    }

    return {
      ...artist,
      metadata: {
        tags: [],
        genres: [],
        playcount: 0,
        listeners: 0,
        bio: null
      }
    };
  });
}

/**
 * Score and rank candidate artists from similarity data.
 * @param {Object} externalDataResult - { similarArtists: { [artist]: { sourceArtist, similarArtists[] } }, artistInfo? }
 * @param {Array} userAlbums
 * @returns {Object} { total, artists, metadata }
 */
export async function buildArtistRecommendations(externalDataResult, userAlbums) {
  const userArtists = new Set(userAlbums.map(album => album.artist.toLowerCase()));
  const artistScores = new Map();
  const externalData = externalDataResult;

  console.log('🔍 Building artist recommendations from external data...');
  console.log('🔍 ExternalData similarArtists count:', Object.keys(externalData?.similarArtists || {}).length);

  if (externalData?.similarArtists) {
    Object.values(externalData.similarArtists).forEach(artistData => {
      const sourceArtist = artistData.sourceArtist;

      artistData.similarArtists.forEach(similarArtist => {
        const artistName = similarArtist.name;
        const normalizedName = artistName.toLowerCase();

        if (userArtists.has(normalizedName)) return;

        const connectionStrength = parseFloat(similarArtist.match) || 0;

        if (!artistScores.has(normalizedName)) {
          const artistInfo = externalData?.artistInfo?.[artistName] || null;
          const genres = artistInfo?.tags ? artistInfo.tags.map(tag =>
            typeof tag === 'object' ? tag.name : tag
          ).filter(Boolean).slice(0, 3) : [];

          console.log(`🎨 Artist ${artistName} metadata:`, {
            hasInfo: !!artistInfo,
            tagCount: artistInfo?.tags?.length || 0,
            genreCount: genres.length,
            genres
          });

          artistScores.set(normalizedName, {
            artist: artistName,
            totalScore: 0,
            connectionCount: 0,
            connections: [],
            maxSimilarity: 0,
            mbid: similarArtist.mbid,
            image: similarArtist.image,
            metadata: artistInfo ? {
              tags: artistInfo.tags || [],
              genres,
              playcount: artistInfo.playcount || 0,
              listeners: artistInfo.listeners || 0,
              bio: artistInfo.bio || null
            } : {
              tags: [],
              genres: [],
              playcount: 0,
              listeners: 0,
              bio: null
            }
          });
        }

        const artistScoreData = artistScores.get(normalizedName);
        artistScoreData.totalScore += connectionStrength;
        artistScoreData.connectionCount += 1;
        artistScoreData.connections.push({ sourceArtist, similarity: connectionStrength });
        artistScoreData.maxSimilarity = Math.max(artistScoreData.maxSimilarity, connectionStrength);
      });
    });
  }

  const scoredArtists = Array.from(artistScores.values()).map(artist => {
    const avgSimilarity = artist.totalScore / artist.connectionCount;
    const breadthMultiplier = 1 + (artist.connectionCount - 1) * 0.3;
    const qualityThreshold = avgSimilarity > 0.4 ? 1 : 0.7;
    const maxSimBonus = artist.maxSimilarity * 0.15;
    const finalScore = (artist.totalScore * breadthMultiplier * qualityThreshold) + maxSimBonus;

    return {
      ...artist,
      score: Math.round(finalScore * 100),
      avgSimilarity: Math.round(avgSimilarity * 100),
      reason: artist.connectionCount === 1
        ? `Similar to ${artist.connections[0].sourceArtist}`
        : `Connected to ${artist.connectionCount} artists in your collection`
    };
  });

  const topCandidates = scoredArtists.sort((a, b) => b.score - a.score).slice(0, 50);

  return {
    total: topCandidates.length,
    artists: topCandidates,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCandidates: artistScores.size,
      averageConnections: topCandidates.length > 0
        ? Math.round(topCandidates.reduce((sum, a) => sum + a.connectionCount, 0) / topCandidates.length * 10) / 10
        : 0,
      fullCandidateCount: topCandidates.length
    }
  };
}

/**
 * Generate basic similarity-based recommendations for a set of albums.
 * @param {Object} recommendationService
 * @param {Array} albums
 * @returns {Object|null} artist recommendations result, or null on failure
 */
export async function generateBasicRecommendations(recommendationService, albums) {
  try {
    console.log('📊 Starting basic recommendation generation...');
    console.log('📊 Debug: Sample album data:', albums[0]);
    console.log('📊 Debug: All artists from albums:', albums.map(a => a.artist).filter(Boolean));

    const profile = await recommendationService.buildUserProfile(albums);
    console.log('📊 User profile built with', profile.artists?.length || 0, 'artists');
    console.log('📊 Debug: Profile artists:', profile.artists?.slice(0, 3));

    console.log('📊 Batch fetching similarity data for', profile.artists?.length || 0, 'artists');
    console.log('📊 Artists to fetch (sample):', profile.artists?.slice(0, 3));

    if (!recommendationService.cacheService) {
      console.error('❌ CacheService is not available - cannot fetch similarity data');
      return null;
    }

    console.time('🚀 Batch fetch similarity data');
    const artistNames = (profile.artists || []).map(a => a.artist);
    const similarArtistsMap = await recommendationService.cacheService.getBatchSimilarArtistsCache(artistNames, 'lastfm');
    console.timeEnd('🚀 Batch fetch similarity data');
    console.log('📊 Batch similarity data fetched:', Object.keys(similarArtistsMap).length, 'artists');

    const externalData = { similarArtists: similarArtistsMap };

    if (externalData && Object.keys(externalData.similarArtists || {}).length > 0) {
      // Collect all unique similar artists for metadata refresh
      const allSimilarArtists = [];
      const seenArtists = new Set();
      Object.values(externalData.similarArtists || {}).forEach(artistData => {
        artistData.similarArtists.forEach(similarArtist => {
          const normalizedName = similarArtist.name.toLowerCase();
          if (!seenArtists.has(normalizedName)) {
            seenArtists.add(normalizedName);
            allSimilarArtists.push({ artist: similarArtist.name, mbid: similarArtist.mbid || null });
          }
        });
      });
      console.log(`📊 Extracted ${allSimilarArtists.length} unique similar artists for metadata refresh`);

      // Pass 1: score without metadata
      console.log('🎯 Pass 1: Building artist recommendations WITHOUT metadata (fast)...');
      const artistRecs = await buildArtistRecommendations(externalData, albums);
      console.log('📊 Pass 1 complete:', artistRecs?.total || 0, 'artists scored');

      if (artistRecs && artistRecs.artists && artistRecs.artists.length > 0) {
        // Pass 2: batch-fetch metadata for top 50
        console.log('🎯 Pass 2: Fetching metadata for top 50 candidates...');
        const artistNamesForMetadata = [...new Set(artistRecs.artists.slice(0, 50).map(a => a.artist))];

        if (!recommendationService.cacheService) {
          console.warn('⚠️ CacheService not available - skipping metadata fetch');
          artistRecs.metadata = { ...artistRecs.metadata, allSimilarArtists };
          return artistRecs;
        }

        console.time('🚀 Batch fetch metadata');
        const artistMetadata = await recommendationService.cacheService.getBatchArtistMetadataCache(artistNamesForMetadata);
        console.timeEnd('🚀 Batch fetch metadata');
        console.log('📊 Pass 2 complete: metadata for', Object.keys(artistMetadata).length, 'artists');

        const sampleKey = Object.keys(artistMetadata)[0];
        if (sampleKey) console.log('🔍 Sample metadata for', sampleKey, ':', artistMetadata[sampleKey]);

        artistRecs.artists = mergeMetadataIntoArtists(artistRecs.artists, artistMetadata);
        if (artistRecs.artists[0]) console.log('🔍 Sample merged artist:', artistRecs.artists[0]);

        console.log('✅ Two-pass complete:', artistRecs.total, 'artists with metadata');
        artistRecs.metadata = { ...artistRecs.metadata, allSimilarArtists };
      }

      return artistRecs;
    } else {
      console.log('📊 No similarity data available, falling back to genre-based approach');
      const result = await recommendationService.generateRecommendations(albums, { includeExternal: true });
      if (result.success) {
        const rawExternalData = await recommendationService.fetchExternalData(profile, albums);
        return await buildArtistRecommendations(rawExternalData, albums);
      }
    }

    console.log('📊 Basic recommendation generation failed - no data available');
    return null;
  } catch (error) {
    console.error('Basic recommendation generation failed:', error);
    return null;
  }
}
