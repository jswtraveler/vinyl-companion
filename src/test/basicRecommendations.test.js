import { describe, it, expect } from 'vitest';
import {
  mergeMetadataIntoArtists,
  buildArtistRecommendations,
} from '../services/recommendations/basicRecommendations';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const userAlbums = [
  { artist: 'Fleetwood Mac', title: 'Rumours', genre: ['Rock'] },
  { artist: 'Pink Floyd', title: 'The Wall', genre: ['Rock'] },
];

// An artist the user does NOT own
const candidateArtist = {
  artist: 'The Eagles',
  totalScore: 0,
  connectionCount: 0,
  connections: [],
  maxSimilarity: 0,
  mbid: 'eagles-mbid',
  image: null,
  metadata: { tags: [], genres: [], playcount: 0, listeners: 0, bio: null },
};

// ---------------------------------------------------------------------------
// mergeMetadataIntoArtists
// ---------------------------------------------------------------------------
describe('mergeMetadataIntoArtists', () => {
  it('returns the same length array as input', () => {
    const artists = [{ ...candidateArtist }];
    const result = mergeMetadataIntoArtists(artists, {});
    expect(result).toHaveLength(1);
  });

  it('assigns empty metadata structure when no metadata found for artist', () => {
    const artists = [{ ...candidateArtist }];
    const result = mergeMetadataIntoArtists(artists, {});
    expect(result[0].metadata.tags).toEqual([]);
    expect(result[0].metadata.genres).toEqual([]);
    expect(result[0].metadata.bio).toBeNull();
  });

  it('merges metadata when a matching entry exists', () => {
    const artists = [{ ...candidateArtist }];
    const metadataMap = {
      'The Eagles': {
        tags: [{ name: 'rock' }, { name: 'country rock' }],
        genres: ['Rock', 'Country Rock'],
        playcount: 50000,
        listeners: 10000,
        bio: 'Eagles bio',
        spotifyImage: 'https://example.com/eagles.jpg',
        spotifyId: 'spotify-eagles',
        spotifyUrl: 'https://open.spotify.com/artist/eagles',
      },
    };
    const result = mergeMetadataIntoArtists(artists, metadataMap);
    expect(result[0].metadata.genres).toEqual(['Rock', 'Country Rock']);
    expect(result[0].metadata.playcount).toBe(50000);
    expect(result[0].metadata.bio).toBe('Eagles bio');
    expect(result[0].image).toBe('https://example.com/eagles.jpg');
    expect(result[0].spotifyId).toBe('spotify-eagles');
  });

  it('prefers spotifyImage over existing artist image', () => {
    const artists = [{ ...candidateArtist, image: 'old-image.jpg' }];
    const metadataMap = {
      'The Eagles': { spotifyImage: 'new-spotify.jpg', tags: [], playcount: 0, listeners: 0 },
    };
    const result = mergeMetadataIntoArtists(artists, metadataMap);
    expect(result[0].image).toBe('new-spotify.jpg');
  });

  it('falls back to existing image when no spotifyImage in metadata', () => {
    const artists = [{ ...candidateArtist, image: 'existing.jpg' }];
    const metadataMap = {
      'The Eagles': { tags: [], playcount: 0, listeners: 0 },
    };
    const result = mergeMetadataIntoArtists(artists, metadataMap);
    expect(result[0].image).toBe('existing.jpg');
  });

  it('derives genres from tags when genres field is absent', () => {
    const artists = [{ ...candidateArtist }];
    const metadataMap = {
      'The Eagles': {
        tags: [{ name: 'rock' }, { name: 'country rock' }, { name: 'pop' }, { name: 'extra' }],
        playcount: 0,
        listeners: 0,
      },
    };
    const result = mergeMetadataIntoArtists(artists, metadataMap);
    // Should take up to 3 tags as genres
    expect(result[0].metadata.genres.length).toBeLessThanOrEqual(3);
    expect(result[0].metadata.genres).toContain('rock');
  });

  it('handles an empty artists array', () => {
    expect(mergeMetadataIntoArtists([], {})).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildArtistRecommendations
// ---------------------------------------------------------------------------

/** Minimal externalData structure that the function expects */
function makeExternalData(sourceArtist, similarArtists) {
  return {
    similarArtists: {
      [sourceArtist.toLowerCase()]: {
        sourceArtist,
        similarArtists,
      },
    },
  };
}

describe('buildArtistRecommendations', () => {
  it('returns object with total, artists, and metadata fields', async () => {
    const externalData = makeExternalData('Fleetwood Mac', [
      { name: 'The Eagles', match: '0.8', mbid: 'eagles-mbid', image: null },
    ]);
    const result = await buildArtistRecommendations(externalData, userAlbums);
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('artists');
    expect(result).toHaveProperty('metadata');
  });

  it('excludes artists already in the user collection', async () => {
    const externalData = makeExternalData('Fleetwood Mac', [
      { name: 'Pink Floyd', match: '0.9', mbid: 'pf-mbid', image: null }, // user already owns this
      { name: 'The Eagles', match: '0.7', mbid: 'eagles-mbid', image: null },
    ]);
    const result = await buildArtistRecommendations(externalData, userAlbums);
    const names = result.artists.map(a => a.artist.toLowerCase());
    expect(names).not.toContain('pink floyd');
    expect(names).toContain('the eagles');
  });

  it('sorts results by score descending', async () => {
    const externalData = makeExternalData('Fleetwood Mac', [
      { name: 'The Eagles', match: '0.5', mbid: null, image: null },
      { name: 'Crosby Stills Nash', match: '0.9', mbid: null, image: null },
    ]);
    const result = await buildArtistRecommendations(externalData, userAlbums);
    if (result.artists.length >= 2) {
      expect(result.artists[0].score).toBeGreaterThanOrEqual(result.artists[1].score);
    }
  });

  it('rewards breadth: an artist connected to multiple source artists scores higher', async () => {
    // Eagles connected to both Fleetwood Mac AND Pink Floyd
    const externalData = {
      similarArtists: {
        'fleetwood mac': {
          sourceArtist: 'Fleetwood Mac',
          similarArtists: [
            { name: 'The Eagles', match: '0.7', mbid: null, image: null },
          ],
        },
        'pink floyd': {
          sourceArtist: 'Pink Floyd',
          similarArtists: [
            { name: 'The Eagles', match: '0.7', mbid: null, image: null },
            { name: 'Solo Act', match: '0.7', mbid: null, image: null },
          ],
        },
      },
    };
    const result = await buildArtistRecommendations(externalData, userAlbums);
    const eagles = result.artists.find(a => a.artist === 'The Eagles');
    const solo = result.artists.find(a => a.artist === 'Solo Act');
    expect(eagles).toBeDefined();
    expect(solo).toBeDefined();
    expect(eagles.score).toBeGreaterThan(solo.score);
  });

  it('caps results at 50 artists', async () => {
    // Build 60 unique similar artists
    const similar = Array.from({ length: 60 }, (_, i) => ({
      name: `Artist ${i}`,
      match: '0.5',
      mbid: null,
      image: null,
    }));
    const externalData = makeExternalData('Fleetwood Mac', similar);
    const result = await buildArtistRecommendations(externalData, userAlbums);
    expect(result.artists.length).toBeLessThanOrEqual(50);
  });

  it('returns total = 0 when externalData has no similarArtists', async () => {
    const result = await buildArtistRecommendations({ similarArtists: {} }, userAlbums);
    expect(result.total).toBe(0);
    expect(result.artists).toHaveLength(0);
  });

  it('reason string mentions single source artist when connectionCount is 1', async () => {
    const externalData = makeExternalData('Fleetwood Mac', [
      { name: 'The Eagles', match: '0.8', mbid: null, image: null },
    ]);
    const result = await buildArtistRecommendations(externalData, userAlbums);
    const eagles = result.artists.find(a => a.artist === 'The Eagles');
    expect(eagles.reason).toMatch(/Similar to Fleetwood Mac/);
  });

  it('reason string mentions connection count when connectionCount > 1', async () => {
    const externalData = {
      similarArtists: {
        'fleetwood mac': {
          sourceArtist: 'Fleetwood Mac',
          similarArtists: [{ name: 'The Eagles', match: '0.7', mbid: null, image: null }],
        },
        'pink floyd': {
          sourceArtist: 'Pink Floyd',
          similarArtists: [{ name: 'The Eagles', match: '0.7', mbid: null, image: null }],
        },
      },
    };
    const result = await buildArtistRecommendations(externalData, userAlbums);
    const eagles = result.artists.find(a => a.artist === 'The Eagles');
    expect(eagles.reason).toMatch(/Connected to 2 artists/);
  });
});
