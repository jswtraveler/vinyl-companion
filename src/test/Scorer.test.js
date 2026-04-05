import { describe, it, expect } from 'vitest';
import { RecommendationScoring } from '../services/recommendations/algorithms/Scorer';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockUserProfile = {
  collection: { totalAlbums: 20, analyzedAt: new Date().toISOString() },
  artists: [
    { artist: 'Fleetwood Mac', count: 3, percentage: 15 },
    { artist: 'Pink Floyd', count: 2, percentage: 10 },
    { artist: 'Led Zeppelin', count: 2, percentage: 10 },
  ],
  genres: [
    { genre: 'Rock', count: 12, percentage: 60 },
    { genre: 'Pop', count: 4, percentage: 20 },
  ],
  eras: {
    decades: [
      { decade: 1970, count: 10, percentage: 50 },
      { decade: 1980, count: 6, percentage: 30 },
      { decade: 1990, count: 4, percentage: 20 },
    ],
    periods: [],
    distribution: {}
  },
  labels: [
    { label: 'Warner Bros.', count: 5, percentage: 25 },
  ],
  moods: [
    { mood: 'melancholic', count: 8, percentage: 40 },
    { mood: 'energetic', count: 6, percentage: 30 },
  ],
  countries: [
    { country: 'uk', count: 12, percentage: 60 },
  ],
  tags: [
    { tag: 'rock', percentage: 60 },
    { tag: 'pop', percentage: 20 },
    { tag: 'classic_rock', percentage: 15 },
  ],
  preferences: {
    primaryGenres: ['Rock', 'Pop'],
    primaryEras: [1970, 1980],
    primaryMoods: ['melancholic'],
  },
  diversity: { overallScore: 0.7 },
};

const mockUserAlbums = [
  { artist: 'Fleetwood Mac', title: 'Rumours', year: 1977, genre: ['Rock', 'Pop'] },
  { artist: 'Pink Floyd', title: 'The Wall', year: 1979, genre: ['Rock'] },
  { artist: 'Led Zeppelin', title: 'IV', year: 1971, genre: ['Rock'] },
];

// A candidate artist the user does NOT own
const unknownCandidate = {
  artist: 'The Eagles',
  title: 'Hotel California',
  year: 1976,
  genre: ['Rock', 'Pop'],
  moods: ['melancholic'],
  label: 'Warner Bros.',
};

// A candidate totally outside the user's profile
const poorMatchCandidate = {
  artist: 'Some EDM Act',
  title: 'Deep Bass',
  year: 2020,
  genre: ['Electronic'],
  moods: ['euphoric'],
  label: 'Unknown Label',
};

// ---------------------------------------------------------------------------
// Construction / configuration
// ---------------------------------------------------------------------------
describe('RecommendationScoring constructor', () => {
  it('uses default weights when no options provided', () => {
    const scorer = new RecommendationScoring();
    const config = scorer.getConfiguration();
    expect(config.weights.artistProximity).toBe(0.35);
    expect(config.weights.tagSimilarity).toBe(0.30);
  });

  it('merges custom weights over defaults', () => {
    const scorer = new RecommendationScoring({ weights: { artistProximity: 0.5 } });
    const config = scorer.getConfiguration();
    expect(config.weights.artistProximity).toBe(0.5);
    expect(config.weights.tagSimilarity).toBe(0.30); // default preserved
  });

  it('merges custom thresholds over defaults', () => {
    const scorer = new RecommendationScoring({ thresholds: { minimumScore: 0.2 } });
    expect(scorer.getConfiguration().thresholds.minimumScore).toBe(0.2);
  });
});

// ---------------------------------------------------------------------------
// calculateEraFit
// ---------------------------------------------------------------------------
describe('calculateEraFit', () => {
  const scorer = new RecommendationScoring();

  it('returns 0 when candidate has no year', () => {
    const candidate = { artist: 'X', title: 'Y' };
    expect(scorer.calculateEraFit(candidate, mockUserProfile)).toBe(0);
  });

  it('returns 0 when user profile has no decade data', () => {
    const profileNoEras = { ...mockUserProfile, eras: { decades: [] } };
    expect(scorer.calculateEraFit(unknownCandidate, profileNoEras)).toBe(0);
  });

  it('scores a decade the user loves higher than a non-preferred decade', () => {
    const preferred = { ...unknownCandidate, year: 1975 };   // 1970s decade — 50% of collection
    const notPreferred = { ...unknownCandidate, year: 2005 }; // 2000s — not in profile
    expect(scorer.calculateEraFit(preferred, mockUserProfile))
      .toBeGreaterThan(scorer.calculateEraFit(notPreferred, mockUserProfile));
  });

  it('gives partial credit for an adjacent decade', () => {
    const adjacent = { ...unknownCandidate, year: 1965 }; // 1960s — adjacent to preferred 1970s
    const score = scorer.calculateEraFit(adjacent, mockUserProfile);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('caps score at 1.0', () => {
    const inDecade = { ...unknownCandidate, year: 1975 };
    expect(scorer.calculateEraFit(inDecade, mockUserProfile)).toBeLessThanOrEqual(1.0);
  });
});

// ---------------------------------------------------------------------------
// calculateTagSimilarity
// ---------------------------------------------------------------------------
describe('calculateTagSimilarity', () => {
  const scorer = new RecommendationScoring();

  it('returns 0 when candidate has no genre or moods', () => {
    const bare = { artist: 'X', title: 'Y' };
    expect(scorer.calculateTagSimilarity(bare, mockUserProfile)).toBe(0);
  });

  it('returns 0 when user profile has no tags', () => {
    const noTags = { ...mockUserProfile, tags: [] };
    expect(scorer.calculateTagSimilarity(unknownCandidate, noTags)).toBe(0);
  });

  it('scores a matching-genre candidate higher than a non-matching one', () => {
    const rockCandidate = { ...unknownCandidate, genre: ['Rock'], moods: [] };
    const edmCandidate = { ...poorMatchCandidate };
    expect(scorer.calculateTagSimilarity(rockCandidate, mockUserProfile))
      .toBeGreaterThan(scorer.calculateTagSimilarity(edmCandidate, mockUserProfile));
  });

  it('result is between 0 and 1', () => {
    const score = scorer.calculateTagSimilarity(unknownCandidate, mockUserProfile);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// calculateArtistProximity
// ---------------------------------------------------------------------------
describe('calculateArtistProximity', () => {
  const scorer = new RecommendationScoring();

  it('scores an artist the user already owns highly', () => {
    const ownedArtist = { artist: 'Fleetwood Mac', title: 'Tusk', genre: ['Rock'] };
    const score = scorer.calculateArtistProximity(ownedArtist, mockUserProfile, mockUserAlbums);
    expect(score).toBeGreaterThan(0.5);
  });

  it('scores a completely unknown artist at 0 with no genre overlap', () => {
    const stranger = { artist: 'Unknown Act', title: 'X', genre: ['Electronic'] };
    const score = scorer.calculateArtistProximity(stranger, mockUserProfile, mockUserAlbums);
    expect(score).toBe(0);
  });

  it('scores a known artist higher than an unknown artist', () => {
    const known = { artist: 'Pink Floyd', title: 'Animals', genre: ['Rock'] };
    const unknown = { artist: 'Obscure Band', title: 'Y', genre: [] };
    expect(scorer.calculateArtistProximity(known, mockUserProfile, mockUserAlbums))
      .toBeGreaterThan(scorer.calculateArtistProximity(unknown, mockUserProfile, mockUserAlbums));
  });

  it('result is between 0 and 1', () => {
    const score = scorer.calculateArtistProximity(unknownCandidate, mockUserProfile, mockUserAlbums);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// scoreCandidate
// ---------------------------------------------------------------------------
describe('scoreCandidate', () => {
  const scorer = new RecommendationScoring();

  it('returns an object with the expected shape', () => {
    const result = scorer.scoreCandidate(unknownCandidate, mockUserProfile, mockUserAlbums);
    expect(result).toHaveProperty('totalScore');
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('explanation');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reasons');
  });

  it('caps totalScore at 1.0', () => {
    const result = scorer.scoreCandidate(unknownCandidate, mockUserProfile, mockUserAlbums);
    expect(result.totalScore).toBeLessThanOrEqual(1.0);
  });

  it('totalScore is >= 0', () => {
    const result = scorer.scoreCandidate(poorMatchCandidate, mockUserProfile, mockUserAlbums);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
  });

  it('confidence is 0 when all sub-scores are 0', () => {
    // A candidate with no matching data at all
    const ghost = { artist: 'Ghost', title: 'Nothing' }; // no year, genre, moods, label
    const emptyProfile = {
      ...mockUserProfile,
      artists: [],
      tags: [],
      eras: { decades: [] },
      labels: [],
      moods: [],
    };
    const result = scorer.scoreCandidate(ghost, emptyProfile, []);
    expect(result.confidence).toBe(0);
  });

  it('scores a good match higher than a poor match', () => {
    const good = scorer.scoreCandidate(unknownCandidate, mockUserProfile, mockUserAlbums);
    const poor = scorer.scoreCandidate(poorMatchCandidate, mockUserProfile, mockUserAlbums);
    expect(good.totalScore).toBeGreaterThan(poor.totalScore);
  });

  it('explanation is a non-empty string', () => {
    const result = scorer.scoreCandidate(unknownCandidate, mockUserProfile, mockUserAlbums);
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// scoreMultipleCandidates
// ---------------------------------------------------------------------------
describe('scoreMultipleCandidates', () => {
  const scorer = new RecommendationScoring();

  it('returns results sorted by totalScore descending', () => {
    const candidates = [poorMatchCandidate, unknownCandidate];
    const results = scorer.scoreMultipleCandidates(candidates, mockUserProfile, mockUserAlbums);
    if (results.length >= 2) {
      expect(results[0].totalScore).toBeGreaterThanOrEqual(results[1].totalScore);
    }
  });

  it('filters out candidates below minimumScore', () => {
    const strictScorer = new RecommendationScoring({ thresholds: { minimumScore: 0.99 } });
    const results = strictScorer.scoreMultipleCandidates(
      [poorMatchCandidate],
      mockUserProfile,
      mockUserAlbums
    );
    results.forEach(r => expect(r.totalScore).toBeGreaterThanOrEqual(0.99));
  });

  it('returns an empty array for empty input', () => {
    const results = scorer.scoreMultipleCandidates([], mockUserProfile, mockUserAlbums);
    expect(results).toEqual([]);
  });

  it('each result has candidate, totalScore, and explanation fields', () => {
    const results = scorer.scoreMultipleCandidates(
      [unknownCandidate],
      mockUserProfile,
      mockUserAlbums
    );
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('candidate');
      expect(results[0]).toHaveProperty('totalScore');
      expect(results[0]).toHaveProperty('explanation');
    }
  });
});
