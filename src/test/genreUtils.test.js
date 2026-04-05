import { describe, it, expect } from 'vitest';
import {
  capitalizeGenre,
  extractGenres,
  countAlbumsByGenre,
  getDistinctGenres,
  calculateGenreOverlap,
} from '../utils/genreUtils';

// ---------------------------------------------------------------------------
// capitalizeGenre
// ---------------------------------------------------------------------------
describe('capitalizeGenre', () => {
  it('returns empty string for empty input', () => {
    expect(capitalizeGenre('')).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    expect(capitalizeGenre(null)).toBe('');
    expect(capitalizeGenre(undefined)).toBe('');
  });

  const specialCases = [
    ['r&b', 'R&B'],
    ['rnb', 'R&B'],
    ['hiphop', 'Hip Hop'],
    ['hip-hop', 'Hip Hop'],
    ['hip hop', 'Hip Hop'],
    ['dnb', 'Drum & Bass'],
    ['drum and bass', 'Drum & Bass'],
    ['uk garage', 'UK Garage'],
    ['edm', 'EDM'],
  ];

  it.each(specialCases)('maps "%s" → "%s"', (input, expected) => {
    expect(capitalizeGenre(input)).toBe(expected);
  });

  it('title-cases a normal genre', () => {
    expect(capitalizeGenre('progressive rock')).toBe('Progressive Rock');
  });

  it('title-cases a single word', () => {
    expect(capitalizeGenre('jazz')).toBe('Jazz');
  });

  it('is case-insensitive for special-case lookup', () => {
    expect(capitalizeGenre('R&B')).toBe('R&B');
    expect(capitalizeGenre('HIP-HOP')).toBe('Hip Hop');
  });
});

// ---------------------------------------------------------------------------
// extractGenres
// ---------------------------------------------------------------------------
describe('extractGenres', () => {
  it('returns an empty array for an empty collection', () => {
    expect(extractGenres([])).toEqual([]);
  });

  it('extracts unique genres across albums', () => {
    const albums = [
      { genre: ['Rock', 'Pop'] },
      { genre: ['Jazz', 'Rock'] },
    ];
    const result = extractGenres(albums);
    expect(result).toContain('Rock');
    expect(result).toContain('Pop');
    expect(result).toContain('Jazz');
    expect(result).toHaveLength(3); // no duplicates
  });

  it('returns sorted results', () => {
    const albums = [{ genre: ['Rock', 'Jazz', 'Blues'] }];
    const result = extractGenres(albums);
    expect(result).toEqual([...result].sort());
  });

  it('handles albums with no genre field', () => {
    const albums = [{ title: 'no genre' }, { genre: ['Rock'] }];
    expect(extractGenres(albums)).toEqual(['Rock']);
  });

  it('handles albums with an empty genre array', () => {
    const albums = [{ genre: [] }, { genre: ['Jazz'] }];
    expect(extractGenres(albums)).toEqual(['Jazz']);
  });
});

// ---------------------------------------------------------------------------
// countAlbumsByGenre
// ---------------------------------------------------------------------------
describe('countAlbumsByGenre', () => {
  it('returns an empty Map for an empty collection', () => {
    expect(countAlbumsByGenre([])).toEqual(new Map());
  });

  it('counts single-genre albums correctly', () => {
    const albums = [
      { genre: ['Rock'] },
      { genre: ['Rock'] },
      { genre: ['Jazz'] },
    ];
    const counts = countAlbumsByGenre(albums);
    expect(counts.get('Rock')).toBe(2);
    expect(counts.get('Jazz')).toBe(1);
  });

  it('counts multi-genre albums once per genre', () => {
    const albums = [{ genre: ['Rock', 'Pop'] }, { genre: ['Rock'] }];
    const counts = countAlbumsByGenre(albums);
    expect(counts.get('Rock')).toBe(2);
    expect(counts.get('Pop')).toBe(1);
  });

  it('ignores albums without a genre field', () => {
    const albums = [{ title: 'no genre' }, { genre: ['Blues'] }];
    const counts = countAlbumsByGenre(albums);
    expect(counts.get('Blues')).toBe(1);
    expect(counts.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateGenreOverlap
// ---------------------------------------------------------------------------
describe('calculateGenreOverlap', () => {
  it('returns 0 when either set is empty', () => {
    expect(calculateGenreOverlap(new Set(), new Set(['Rock']))).toBe(0);
    expect(calculateGenreOverlap(new Set(['Rock']), new Set())).toBe(0);
  });

  it('returns 1.0 for identical sets', () => {
    const s = new Set(['Rock', 'Pop']);
    expect(calculateGenreOverlap(s, new Set(['Rock', 'Pop']))).toBe(1.0);
  });

  it('returns 0 for completely disjoint sets', () => {
    expect(calculateGenreOverlap(new Set(['Rock']), new Set(['Jazz']))).toBe(0);
  });

  it('returns correct Jaccard similarity for partial overlap', () => {
    // intersection = {Rock}, union = {Rock, Pop, Jazz} → 1/3
    const overlap = calculateGenreOverlap(new Set(['Rock', 'Pop']), new Set(['Rock', 'Jazz']));
    expect(overlap).toBeCloseTo(1 / 3);
  });
});

// ---------------------------------------------------------------------------
// getDistinctGenres
// ---------------------------------------------------------------------------
describe('getDistinctGenres', () => {
  // Build a collection where Rock and Alternative share all artists (100% overlap)
  // and Jazz is completely separate
  const sharedArtists = ['Artist A', 'Artist B', 'Artist C'];
  const rockAlbums = sharedArtists.map(a => ({ artist: a, genre: ['Rock'] }));
  const altAlbums = sharedArtists.map(a => ({ artist: a, genre: ['Alternative'] }));
  const jazzAlbums = [
    { artist: 'Miles Davis', genre: ['Jazz'] },
    { artist: 'John Coltrane', genre: ['Jazz'] },
    { artist: 'Bill Evans', genre: ['Jazz'] },
  ];

  it('returns empty array when no genre meets minAlbums threshold', () => {
    const albums = [{ artist: 'X', genre: ['Rock'] }];
    expect(getDistinctGenres(albums, 0.5, 10, 3)).toEqual([]);
  });

  it('includes a genre that meets minAlbums', () => {
    const albums = [...rockAlbums, ...jazzAlbums];
    const result = getDistinctGenres(albums, 0.5, 10, 3);
    const genres = result.map(r => r.genre);
    expect(genres).toContain('Rock');
    expect(genres).toContain('Jazz');
  });

  it('excludes a genre with overlap above maxOverlap', () => {
    // Rock and Alternative share all artists → 100% overlap, so only one should be kept
    const albums = [...rockAlbums, ...altAlbums, ...jazzAlbums];
    const result = getDistinctGenres(albums, 0.5, 10, 3);
    const genres = result.map(r => r.genre);
    const hasBoth = genres.includes('Rock') && genres.includes('Alternative');
    expect(hasBoth).toBe(false);
  });

  it('respects maxGenres cap', () => {
    // Create 5 fully distinct genres with 3 albums each
    const albums = ['Rock', 'Jazz', 'Blues', 'Pop', 'Classical'].flatMap(genre =>
      ['A', 'B', 'C'].map(suffix => ({ artist: `${genre} Artist ${suffix}`, genre: [genre] }))
    );
    const result = getDistinctGenres(albums, 0.5, 3, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('each result object has genre, count, and artists fields', () => {
    const albums = [...rockAlbums, ...jazzAlbums];
    const result = getDistinctGenres(albums, 0.5, 10, 3);
    result.forEach(item => {
      expect(item).toHaveProperty('genre');
      expect(item).toHaveProperty('count');
      expect(item).toHaveProperty('artists');
      expect(item.artists).toBeInstanceOf(Set);
    });
  });
});
