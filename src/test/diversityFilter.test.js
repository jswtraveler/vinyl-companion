import { describe, it, expect } from 'vitest';
import { applyDiversityFilter, getDiversityStats } from '../utils/diversityFilter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal artist object that the diversity filter can work with. */
const makeArtist = (name, { genres = [], decade = null, label = null, score = 100 } = {}) => ({
  artist: name,
  score,
  metadata: {
    genres,
    year: decade ? decade + 5 : undefined, // place inside the decade
  },
  label,
});

// ---------------------------------------------------------------------------
// applyDiversityFilter
// ---------------------------------------------------------------------------
describe('applyDiversityFilter', () => {
  it('returns the input unchanged when given an empty array', () => {
    expect(applyDiversityFilter([])).toEqual([]);
  });

  it('returns the input unchanged when given a single item', () => {
    const artists = [makeArtist('Solo Artist', { genres: ['Rock'] })];
    expect(applyDiversityFilter(artists)).toHaveLength(1);
  });

  it('does not increase the number of recommendations', () => {
    const artists = Array.from({ length: 10 }, (_, i) =>
      makeArtist(`Artist ${i}`, { genres: ['Rock'], decade: 1970 })
    );
    const result = applyDiversityFilter(artists);
    expect(result.length).toBeLessThanOrEqual(artists.length);
  });

  describe('hard genre constraint (maxSameGenre: 3)', () => {
    it('trims excess artists from the same genre', () => {
      // 6 Rock artists — should be trimmed to ≤3
      const artists = Array.from({ length: 6 }, (_, i) =>
        makeArtist(`Rock Artist ${i}`, { genres: ['Rock'], score: 100 - i })
      );
      const result = applyDiversityFilter(artists, { maxSameGenre: 3 });
      const rockCount = result.filter(a =>
        (a.metadata?.genres || []).includes('Rock')
      ).length;
      expect(rockCount).toBeLessThanOrEqual(3);
    });

    it('keeps all artists when they are under the genre cap', () => {
      const artists = [
        makeArtist('A', { genres: ['Rock'] }),
        makeArtist('B', { genres: ['Jazz'] }),
        makeArtist('C', { genres: ['Blues'] }),
      ];
      const result = applyDiversityFilter(artists, { maxSameGenre: 3 });
      expect(result.length).toBe(3);
    });
  });

  describe('hard decade constraint (maxSameDecade: 4)', () => {
    it('trims excess artists from the same decade', () => {
      // 7 artists all from the 1970s
      const artists = Array.from({ length: 7 }, (_, i) =>
        makeArtist(`70s Artist ${i}`, { decade: 1970, score: 100 - i })
      );
      const result = applyDiversityFilter(artists, { maxSameDecade: 4 });
      const seventiesCount = result.filter(a => {
        const year = a.metadata?.year;
        return year && Math.floor(year / 10) * 10 === 1970;
      }).length;
      expect(seventiesCount).toBeLessThanOrEqual(4);
    });
  });

  describe('fallback name-based diversity', () => {
    it('falls back gracefully when artists have no genre or year metadata', () => {
      const artists = Array.from({ length: 10 }, (_, i) =>
        makeArtist(`Artist ${i}`)
      );
      // Should not throw and should return a non-empty array
      expect(() => applyDiversityFilter(artists)).not.toThrow();
      expect(applyDiversityFilter(artists).length).toBeGreaterThan(0);
    });

    it('returns all items without filtering when there are ≤6 with no metadata', () => {
      const artists = Array.from({ length: 5 }, (_, i) =>
        makeArtist(`Artist ${i}`)
      );
      expect(applyDiversityFilter(artists)).toHaveLength(5);
    });
  });

  it('returns results in a stable order (first item is still high-scoring)', () => {
    const artists = Array.from({ length: 8 }, (_, i) =>
      makeArtist(`Artist ${i}`, { genres: ['Rock'], score: 100 - i })
    );
    const result = applyDiversityFilter(artists, { maxSameGenre: 3 });
    // The highest-scoring Rock artist should still be first
    expect(result[0].artist).toBe('Artist 0');
  });
});

// ---------------------------------------------------------------------------
// getDiversityStats
// ---------------------------------------------------------------------------
describe('getDiversityStats', () => {
  it('returns zeroed stats for an empty array', () => {
    const stats = getDiversityStats([]);
    expect(stats.totalRecommendations).toBe(0);
    expect(stats.maxGenrePercentage).toBe(0);
  });

  it('counts genre distribution correctly', () => {
    const artists = [
      makeArtist('A', { genres: ['Rock'] }),
      makeArtist('B', { genres: ['Rock'] }),
      makeArtist('C', { genres: ['Jazz'] }),
    ];
    const stats = getDiversityStats(artists);
    expect(stats.genreDistribution['Rock']).toBe(2);
    expect(stats.genreDistribution['Jazz']).toBe(1);
  });

  it('counts decade distribution correctly', () => {
    const artists = [
      makeArtist('A', { decade: 1970 }),
      makeArtist('B', { decade: 1970 }),
      makeArtist('C', { decade: 1980 }),
    ];
    const stats = getDiversityStats(artists);
    expect(stats.decadeDistribution[1970]).toBe(2);
    expect(stats.decadeDistribution[1980]).toBe(1);
  });

  it('calculates maxGenrePercentage correctly', () => {
    // 2 Rock out of 3 total = 2/3 ≈ 0.667
    const artists = [
      makeArtist('A', { genres: ['Rock'] }),
      makeArtist('B', { genres: ['Rock'] }),
      makeArtist('C', { genres: ['Jazz'] }),
    ];
    const stats = getDiversityStats(artists);
    expect(stats.maxGenrePercentage).toBeCloseTo(2 / 3);
  });

  it('includes a diversityScore field', () => {
    const artists = [
      makeArtist('A', { genres: ['Rock'], decade: 1970 }),
      makeArtist('B', { genres: ['Jazz'], decade: 1980 }),
    ];
    const stats = getDiversityStats(artists);
    expect(typeof stats.diversityScore).toBe('number');
    expect(stats.diversityScore).toBeGreaterThanOrEqual(0);
  });

  it('reports totalRecommendations correctly', () => {
    const artists = Array.from({ length: 5 }, (_, i) =>
      makeArtist(`Artist ${i}`, { genres: ['Rock'] })
    );
    expect(getDiversityStats(artists).totalRecommendations).toBe(5);
  });
});
