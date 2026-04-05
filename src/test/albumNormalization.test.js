import { describe, it, expect } from 'vitest';
import { AlbumNormalizer } from '../utils/albumNormalization';

// ---------------------------------------------------------------------------
// normalizeString
// ---------------------------------------------------------------------------
describe('AlbumNormalizer.normalizeString', () => {
  it('returns empty string for falsy input', () => {
    expect(AlbumNormalizer.normalizeString('')).toBe('');
    expect(AlbumNormalizer.normalizeString(null)).toBe('');
    expect(AlbumNormalizer.normalizeString(undefined)).toBe('');
  });

  it('lowercases the string', () => {
    expect(AlbumNormalizer.normalizeString('HELLO')).toBe('hello');
  });

  it('trims leading and trailing whitespace', () => {
    expect(AlbumNormalizer.normalizeString('  hello  ')).toBe('hello');
  });

  it('collapses multiple spaces into one', () => {
    expect(AlbumNormalizer.normalizeString('hello   world')).toBe('hello world');
  });

  it('removes "The " prefix (case-insensitive)', () => {
    expect(AlbumNormalizer.normalizeString('The Beatles')).toBe('beatles');
    expect(AlbumNormalizer.normalizeString('THE ROLLING STONES')).toBe('rolling stones');
  });

  it('removes "A " prefix', () => {
    expect(AlbumNormalizer.normalizeString('A Hard Day')).toBe('hard day');
  });

  it('removes "An " prefix', () => {
    expect(AlbumNormalizer.normalizeString('An Album')).toBe('album');
  });

  it('removes trailing parenthetical info entirely', () => {
    // Strips " (Remastered)"; "the" mid-string is NOT affected by the prefix-only regex
    expect(AlbumNormalizer.normalizeString('Dark Side of the Moon (Remastered)')).toBe(
      'dark side of the moon'
    );
  });

  it('removes trailing bracket info entirely', () => {
    // The regex strips " [Deluxe Edition]" — the content inside is discarded, not retained
    expect(AlbumNormalizer.normalizeString('Rumours [Deluxe Edition]')).toBe('rumours');
  });

  it('strips punctuation', () => {
    expect(AlbumNormalizer.normalizeString("It's Alive!")).toBe('its alive');
  });
});

// ---------------------------------------------------------------------------
// createFingerprint
// ---------------------------------------------------------------------------
describe('AlbumNormalizer.createFingerprint', () => {
  it('returns "normalizedArtist::normalizedTitle" format', () => {
    const fp = AlbumNormalizer.createFingerprint('Fleetwood Mac', 'Rumours');
    expect(fp).toBe('fleetwood mac::rumours');
  });

  it('strips "The " prefix from both artist and title', () => {
    const fp = AlbumNormalizer.createFingerprint('The Beatles', 'The White Album');
    expect(fp).toBe('beatles::white album');
  });

  it('produces the same fingerprint regardless of case', () => {
    const fp1 = AlbumNormalizer.createFingerprint('Pink Floyd', 'The Wall');
    const fp2 = AlbumNormalizer.createFingerprint('PINK FLOYD', 'THE WALL');
    expect(fp1).toBe(fp2);
  });

  it('throws when artist is missing', () => {
    expect(() => AlbumNormalizer.createFingerprint('', 'Rumours')).toThrow();
    expect(() => AlbumNormalizer.createFingerprint(null, 'Rumours')).toThrow();
  });

  it('throws when title is missing', () => {
    expect(() => AlbumNormalizer.createFingerprint('Fleetwood Mac', '')).toThrow();
    expect(() => AlbumNormalizer.createFingerprint('Fleetwood Mac', null)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// normalizeTagString
// ---------------------------------------------------------------------------
describe('AlbumNormalizer.normalizeTagString', () => {
  it('returns empty string for falsy input', () => {
    expect(AlbumNormalizer.normalizeTagString('')).toBe('');
    expect(AlbumNormalizer.normalizeTagString(null)).toBe('');
  });

  it('lowercases and replaces spaces with underscores', () => {
    expect(AlbumNormalizer.normalizeTagString('Classic Rock')).toBe('classic_rock');
  });

  it('replaces & and + with "and"', () => {
    expect(AlbumNormalizer.normalizeTagString('Folk & Country')).toBe('folk_and_country');
    expect(AlbumNormalizer.normalizeTagString('Jazz+Blues')).toBe('jazzandblues');
  });
});

// ---------------------------------------------------------------------------
// normalizeTags
// ---------------------------------------------------------------------------
describe('AlbumNormalizer.normalizeTags', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(AlbumNormalizer.normalizeTags([], [])).toEqual([]);
  });

  it('combines genres and moods into one deduplicated array', () => {
    const tags = AlbumNormalizer.normalizeTags(['Rock'], ['Melancholic']);
    expect(tags).toContain('rock');
    expect(tags).toContain('melancholic');
    expect(tags).toHaveLength(2);
  });

  it('deduplicates identical tags', () => {
    const tags = AlbumNormalizer.normalizeTags(['Rock'], ['Rock']);
    expect(tags).toHaveLength(1);
  });

  it('handles undefined inputs gracefully', () => {
    expect(() => AlbumNormalizer.normalizeTags(undefined, undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// calculateTagSimilarity
// ---------------------------------------------------------------------------
describe('AlbumNormalizer.calculateTagSimilarity', () => {
  it('returns 0 when both arrays are empty', () => {
    expect(AlbumNormalizer.calculateTagSimilarity([], [])).toBe(0);
  });

  it('returns 0 when one array is empty', () => {
    expect(AlbumNormalizer.calculateTagSimilarity(['Rock'], [])).toBe(0);
    expect(AlbumNormalizer.calculateTagSimilarity([], ['Rock'])).toBe(0);
  });

  it('returns 1.0 for identical arrays', () => {
    expect(AlbumNormalizer.calculateTagSimilarity(['Rock', 'Pop'], ['Rock', 'Pop'])).toBe(1.0);
  });

  it('returns 0 for completely disjoint arrays', () => {
    expect(AlbumNormalizer.calculateTagSimilarity(['Rock'], ['Jazz'])).toBe(0);
  });

  it('returns correct Jaccard similarity for partial overlap', () => {
    // intersection = {rock}, union = {rock, pop, jazz} → 1/3
    const sim = AlbumNormalizer.calculateTagSimilarity(['Rock', 'Pop'], ['Rock', 'Jazz']);
    expect(sim).toBeCloseTo(1 / 3);
  });

  it('normalizes tags before comparing (case-insensitive)', () => {
    const sim = AlbumNormalizer.calculateTagSimilarity(['ROCK'], ['rock']);
    expect(sim).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// extractEraInfo
// ---------------------------------------------------------------------------
describe('AlbumNormalizer.extractEraInfo', () => {
  it('returns nulls for missing year', () => {
    const info = AlbumNormalizer.extractEraInfo(null);
    expect(info.decade).toBeNull();
    expect(info.period).toBeNull();
    expect(info.era).toBeNull();
  });

  it('calculates the correct decade', () => {
    expect(AlbumNormalizer.extractEraInfo(1973).decade).toBe(1970);
    expect(AlbumNormalizer.extractEraInfo(1980).decade).toBe(1980);
  });

  it('assigns the correct period label', () => {
    expect(AlbumNormalizer.extractEraInfo(1975).period).toBe('70s');
    expect(AlbumNormalizer.extractEraInfo(1985).period).toBe('80s');
    expect(AlbumNormalizer.extractEraInfo(1995).period).toBe('90s');
    expect(AlbumNormalizer.extractEraInfo(2005).period).toBe('2000s');
  });

  it('assigns the correct era label', () => {
    expect(AlbumNormalizer.extractEraInfo(1973).era).toBe('classic');
    expect(AlbumNormalizer.extractEraInfo(1985).era).toBe('contemporary');
    expect(AlbumNormalizer.extractEraInfo(2005).era).toBe('modern');
  });
});

// ---------------------------------------------------------------------------
// areAlbumsEquivalent
// ---------------------------------------------------------------------------
describe('AlbumNormalizer.areAlbumsEquivalent', () => {
  it('returns false for falsy inputs', () => {
    expect(AlbumNormalizer.areAlbumsEquivalent(null, null)).toBe(false);
  });

  it('returns true when fingerprints match', () => {
    const a1 = { artist: 'Fleetwood Mac', title: 'Rumours' };
    const a2 = { artist: 'Fleetwood Mac', title: 'Rumours' };
    expect(AlbumNormalizer.areAlbumsEquivalent(a1, a2)).toBe(true);
  });

  it('returns falsy when fingerprints differ and no external IDs match', () => {
    const a1 = { artist: 'Fleetwood Mac', title: 'Rumours' };
    const a2 = { artist: 'Pink Floyd', title: 'The Wall' };
    expect(AlbumNormalizer.areAlbumsEquivalent(a1, a2)).toBeFalsy();
  });

  it('returns true when MusicBrainz IDs match', () => {
    const a1 = { artist: 'A', title: 'X', metadata: { musicbrainzId: 'mb-123' } };
    const a2 = { artist: 'B', title: 'Y', metadata: { musicbrainzId: 'mb-123' } };
    expect(AlbumNormalizer.areAlbumsEquivalent(a1, a2)).toBe(true);
  });
});
