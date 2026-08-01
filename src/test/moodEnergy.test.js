import { describe, it, expect } from 'vitest';
import { getAlbumEnergy, estimateAlbumMinutes } from '../utils/moodUtils.js';

describe('getAlbumEnergy', () => {
  it('party-tagged album has higher energy than chill-tagged album', () => {
    const partyAlbum = { moods: ['party'] };
    const chillAlbum = { moods: ['chill'] };
    expect(getAlbumEnergy(partyAlbum)).toBeGreaterThan(getAlbumEnergy(chillAlbum));
  });

  it('no-mood, no-genre album returns neutral default 0.5', () => {
    expect(getAlbumEnergy({ genre: [] })).toBe(0.5);
    expect(getAlbumEnergy({})).toBe(0.5);
  });

  it('averages multiple moods', () => {
    const album = { moods: ['chill', 'party'] }; // 0.15 + 0.95 / 2 = 0.55
    expect(getAlbumEnergy(album)).toBeCloseTo(0.55, 5);
  });
});

describe('estimateAlbumMinutes', () => {
  it('sums track durations (mm:ss)', () => {
    const album = { tracks: [{ duration: '4:30' }, { duration: '3:00' }] };
    expect(estimateAlbumMinutes(album)).toBe(8); // 4.5 + 3 = 7.5 -> rounds to 8
  });

  it('falls back to 40 min for a typical LP with no track data', () => {
    expect(estimateAlbumMinutes({ tracks: [] })).toBe(40);
    expect(estimateAlbumMinutes({})).toBe(40);
  });

  it('falls back by format when no track durations', () => {
    expect(estimateAlbumMinutes({ format: 'Single', tracks: [] })).toBe(8);
    expect(estimateAlbumMinutes({ format: 'EP', tracks: [] })).toBe(20);
  });
});
