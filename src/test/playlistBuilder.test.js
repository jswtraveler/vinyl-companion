import { describe, it, expect } from 'vitest';
import {
  albumMatchesRule,
  scoreAlbumForRule,
  orderAlbums,
  buildPlaylist
} from '../services/playlists/playlistBuilder.js';

// ---------------------------------------------------------------------------
// Fixtures: ~8 albums covering several moods/genres/years
// ---------------------------------------------------------------------------
const albums = [
  {
    id: 'a1', title: 'Sunday Session', artist: 'The Mellows', year: 1974,
    genre: ['Jazz'], moods: ['sunday_morning', 'chill'],
    tracks: [{ number: 1, duration: '4:30' }, { number: 2, duration: '5:00' }]
  },
  {
    id: 'a2', title: 'Loud Machine', artist: 'Riff Brigade', year: 1981,
    genre: ['Hard Rock'], moods: ['energetic', 'raw'],
    tracks: []
  },
  {
    id: 'a3', title: 'Highway Nights', artist: 'Desert Run', year: 1977,
    genre: ['Classic Rock', 'Blues Rock'], moods: ['road_trip', 'energetic'],
    tracks: []
  },
  {
    id: 'a4', title: 'Smoke Signals', artist: 'Delta Moan', year: 1969,
    genre: ['Blues'], moods: ['bluesy', 'melancholic'],
    tracks: []
  },
  {
    id: 'a5', title: 'Nostalgia Trip', artist: 'The Retros', year: 1972,
    genre: ['Rock'], moods: ['nostalgic'],
    tracks: []
  },
  {
    id: 'a6', title: 'Untagged Wonder', artist: 'Unknown Artist', year: 1975,
    genre: ['Folk'], // no moods -> genre fallback
    tracks: []
  },
  {
    id: 'a7', title: 'Party Machine', artist: 'Groove Unit', year: 1980,
    genre: ['Funk'], moods: ['party', 'upbeat'],
    tracks: [{ number: 1, duration: '3:00' }]
  },
  {
    id: 'a8', title: 'No Genre No Mood', artist: 'Blank', year: null,
    genre: [], tracks: []
  }
];

// ---------------------------------------------------------------------------
// albumMatchesRule
// ---------------------------------------------------------------------------
describe('albumMatchesRule', () => {
  it('matches on mood only', () => {
    expect(albumMatchesRule(albums[0], { moods: ['sunday_morning'] })).toBe(true);
    expect(albumMatchesRule(albums[1], { moods: ['sunday_morning'] })).toBe(false);
  });

  it('matches on genre only (case-insensitive substring)', () => {
    expect(albumMatchesRule(albums[2], { genres: ['rock'] })).toBe(true);
    expect(albumMatchesRule(albums[0], { genres: ['rock'] })).toBe(false);
  });

  it('applies year filters', () => {
    expect(albumMatchesRule(albums[3], { yearMin: 1965, yearMax: 1970 })).toBe(true);
    expect(albumMatchesRule(albums[3], { yearMin: 1980 })).toBe(false);
    expect(albumMatchesRule(albums[7], { yearMin: 1980 })).toBe(false); // no year
  });

  it('requireAll true requires both mood and genre clauses', () => {
    const match = { moods: ['energetic'], genres: ['Blues Rock'], requireAll: true };
    expect(albumMatchesRule(albums[2], match)).toBe(true); // road_trip+energetic, Blues Rock
    expect(albumMatchesRule(albums[1], match)).toBe(false); // energetic but genre is Hard Rock
  });

  it('requireAll false (default) is OR across clauses', () => {
    const match = { moods: ['bluesy'], genres: ['Hard Rock'] };
    expect(albumMatchesRule(albums[1], match)).toBe(true); // matches genre only
    expect(albumMatchesRule(albums[3], match)).toBe(true); // matches mood only
  });

  it('empty rule (no moods/genres, only year) matches on year alone', () => {
    expect(albumMatchesRule(albums[0], { yearMax: 2000 })).toBe(true);
  });

  it('returns false for null album or match', () => {
    expect(albumMatchesRule(null, { moods: ['chill'] })).toBe(false);
    expect(albumMatchesRule(albums[0], null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scoreAlbumForRule
// ---------------------------------------------------------------------------
describe('scoreAlbumForRule', () => {
  it('AI-tagged album outranks a genre-only match on equal mood hits', () => {
    const match = { moods: ['chill'], genres: ['Folk'] };
    const aiTagged = { ...albums[0], moods: ['chill'] };
    const genreOnly = { ...albums[5], moods: undefined };
    const aiScore = scoreAlbumForRule(aiTagged, match);
    const genreScore = scoreAlbumForRule(genreOnly, match);
    expect(aiScore).toBeGreaterThan(genreScore);
  });
});

// ---------------------------------------------------------------------------
// buildPlaylist
// ---------------------------------------------------------------------------
describe('buildPlaylist', () => {
  it('respects targetCount', () => {
    const def = { id: 'test', name: 'Test', match: { yearMax: 2100 }, order: 'shuffle' };
    const result = buildPlaylist(albums, def, { targetCount: 3, seed: 1 });
    expect(result.albums.length).toBe(3);
  });

  it('respects targetMinutes (stops near budget, minimum 2 albums)', () => {
    const def = { id: 'test', name: 'Test', match: { yearMax: 2100 }, order: 'shuffle' };
    const result = buildPlaylist(albums, def, { targetMinutes: 10, seed: 1 });
    expect(result.albums.length).toBeGreaterThanOrEqual(2);
  });

  it('orders by energy descending correctly (inverse of ascending)', () => {
    const asc = orderAlbums(albums, 'energy-asc', 1).map(a => a.id);
    const desc = orderAlbums(albums, 'energy-desc', 1).map(a => a.id);
    expect(desc).toEqual([...asc].reverse());
  });

  it('seed makes shuffle deterministic: same seed -> same order', () => {
    const def = { id: 'test', name: 'Test', match: { yearMax: 2100 }, order: 'shuffle' };
    const r1 = buildPlaylist(albums, def, { targetCount: albums.length, seed: 42 });
    const r2 = buildPlaylist(albums, def, { targetCount: albums.length, seed: 42 });
    expect(r1.albums.map(a => a.id)).toEqual(r2.albums.map(a => a.id));
  });

  it('seed makes shuffle deterministic: different seed -> different order', () => {
    const def = { id: 'test', name: 'Test', match: { yearMax: 2100 }, order: 'shuffle' };
    const r1 = buildPlaylist(albums, def, { targetCount: albums.length, seed: 1 });
    const r2 = buildPlaylist(albums, def, { targetCount: albums.length, seed: 999 });
    expect(r1.albums.map(a => a.id)).not.toEqual(r2.albums.map(a => a.id));
  });

  it('returns an empty result with a reason when nothing matches', () => {
    const def = { id: 'nomatch', name: 'No Match', match: { moods: ['does_not_exist'] }, order: 'shuffle' };
    const result = buildPlaylist(albums, def, {});
    expect(result.albums.length).toBe(0);
    expect(result.reason).toContain('No records');
  });
});
