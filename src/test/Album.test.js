import { describe, it, expect } from 'vitest';
import {
  validateAlbum,
  createNewAlbum,
  ALBUM_FORMATS,
  RECORD_SPEEDS,
  CONDITION_GRADES,
} from '../models/Album';

describe('createNewAlbum', () => {
  it('returns an object with all required default fields', () => {
    const album = createNewAlbum();
    expect(album.title).toBe('');
    expect(album.artist).toBe('');
    expect(album.year).toBeNull();
    expect(album.format).toBe('LP');
    expect(album.speed).toBe('33⅓ RPM');
    expect(album.condition).toBe('Very Good (VG)');
    expect(album.genre).toEqual([]);
    expect(album.tracks).toEqual([]);
    expect(album.metadata).toEqual({});
    expect(album.identificationMethod).toBe('manual');
  });

  it('generates a unique id with the expected pattern', () => {
    const album = createNewAlbum();
    expect(album.id).toMatch(/^album_\d+_[a-z0-9]+$/);
  });

  it('sets dateAdded to a valid ISO string', () => {
    const album = createNewAlbum();
    expect(() => new Date(album.dateAdded).toISOString()).not.toThrow();
  });

  it('applies overrides over defaults', () => {
    const album = createNewAlbum({ title: 'Rumours', artist: 'Fleetwood Mac', year: 1977 });
    expect(album.title).toBe('Rumours');
    expect(album.artist).toBe('Fleetwood Mac');
    expect(album.year).toBe(1977);
    expect(album.format).toBe('LP'); // default still present
  });

  it('two calls produce different ids', () => {
    const a = createNewAlbum();
    const b = createNewAlbum();
    expect(a.id).not.toBe(b.id);
  });
});

describe('validateAlbum', () => {
  const validAlbum = () => createNewAlbum({ title: 'Rumours', artist: 'Fleetwood Mac' });

  it('passes a valid album in add mode', () => {
    const result = validateAlbum(validAlbum(), 'add');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes a valid album in edit mode when id is present', () => {
    const album = { ...validAlbum(), id: 'album_123_abc' };
    const result = validateAlbum(album, 'edit');
    expect(result.isValid).toBe(true);
  });

  it('fails when title is missing', () => {
    const album = validAlbum();
    album.title = '';
    const result = validateAlbum(album);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('fails when title is only whitespace', () => {
    const album = validAlbum();
    album.title = '   ';
    expect(validateAlbum(album).isValid).toBe(false);
  });

  it('fails when artist is missing', () => {
    const album = validAlbum();
    album.artist = '';
    const result = validateAlbum(album);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('artist') || e.includes('Artist'))).toBe(true);
  });

  it('fails in edit mode when id is missing', () => {
    const album = { ...validAlbum(), id: undefined };
    const result = validateAlbum(album, 'edit');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('ID') || e.includes('id'))).toBe(true);
  });

  it('does not require id in add mode', () => {
    const album = { ...validAlbum(), id: undefined };
    const result = validateAlbum(album, 'add');
    expect(result.isValid).toBe(true);
  });

  it('fails when title exceeds 200 characters', () => {
    const album = validAlbum();
    album.title = 'A'.repeat(201);
    expect(validateAlbum(album).isValid).toBe(false);
  });

  it('fails when artist exceeds 200 characters', () => {
    const album = validAlbum();
    album.artist = 'A'.repeat(201);
    expect(validateAlbum(album).isValid).toBe(false);
  });

  describe('year validation', () => {
    it('accepts a valid year', () => {
      expect(validateAlbum({ ...validAlbum(), year: 1973 }).isValid).toBe(true);
    });

    it('accepts null year', () => {
      expect(validateAlbum({ ...validAlbum(), year: null }).isValid).toBe(true);
    });

    it('rejects year before 1877', () => {
      expect(validateAlbum({ ...validAlbum(), year: 1876 }).isValid).toBe(false);
    });

    it('rejects year more than one year in the future', () => {
      const tooFar = new Date().getFullYear() + 2;
      expect(validateAlbum({ ...validAlbum(), year: tooFar }).isValid).toBe(false);
    });

    it('accepts next year', () => {
      const nextYear = new Date().getFullYear() + 1;
      expect(validateAlbum({ ...validAlbum(), year: nextYear }).isValid).toBe(true);
    });
  });

  describe('enum validations', () => {
    it('rejects an invalid format', () => {
      expect(validateAlbum({ ...validAlbum(), format: 'CASSETTE' }).isValid).toBe(false);
    });

    it('accepts all valid formats', () => {
      ALBUM_FORMATS.forEach(format => {
        expect(validateAlbum({ ...validAlbum(), format }).isValid).toBe(true);
      });
    });

    it('rejects an invalid speed', () => {
      expect(validateAlbum({ ...validAlbum(), speed: '16 RPM' }).isValid).toBe(false);
    });

    it('accepts all valid speeds', () => {
      RECORD_SPEEDS.forEach(speed => {
        expect(validateAlbum({ ...validAlbum(), speed }).isValid).toBe(true);
      });
    });

    it('rejects an invalid condition', () => {
      expect(validateAlbum({ ...validAlbum(), condition: 'Perfect' }).isValid).toBe(false);
    });

    it('accepts all valid condition grades', () => {
      CONDITION_GRADES.forEach(condition => {
        expect(validateAlbum({ ...validAlbum(), condition }).isValid).toBe(true);
      });
    });
  });

  it('accumulates multiple errors at once', () => {
    const album = { title: '', artist: '', year: 1800, format: 'BAD' };
    const result = validateAlbum(album);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
