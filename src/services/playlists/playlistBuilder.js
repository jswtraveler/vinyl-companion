/**
 * Pure playlist-building logic for the Vibes feature.
 * No React, no network — deterministic, fully unit-testable.
 */
import { getMoodsForAlbum, getAlbumEnergy, estimateAlbumMinutes } from '../../utils/moodUtils.js';

/**
 * Return true if an album satisfies a mood playlist's match rule.
 */
export function albumMatchesRule(album, match) {
  if (!album || !match) return false;
  const albumMoods = getMoodsForAlbum(album);                       // reuse existing logic
  const albumGenres = (album.genre || []).map(g => g.toLowerCase());

  const moodHit = match.moods?.length
    ? match.moods.some(m => albumMoods.includes(m))
    : null;
  const genreHit = match.genres?.length
    ? match.genres.some(g => albumGenres.some(ag => ag.includes(g.toLowerCase())))
    : null;
  const yearHit =
    (match.yearMax == null || (album.year && album.year <= match.yearMax)) &&
    (match.yearMin == null || (album.year && album.year >= match.yearMin));

  if (!yearHit) return false;

  const clauses = [moodHit, genreHit].filter(v => v !== null);
  if (clauses.length === 0) return true;                            // only a year filter → matches
  return match.requireAll ? clauses.every(Boolean) : clauses.some(Boolean);
}

/**
 * Score how well an album fits — used for ranking before we trim to size.
 * More matched mood tags = stronger fit; AI-tagged albums (album.moods present) get a small boost.
 */
export function scoreAlbumForRule(album, match) {
  const albumMoods = getMoodsForAlbum(album);
  const moodMatches = (match.moods || []).filter(m => albumMoods.includes(m)).length;
  const aiBoost = Array.isArray(album.moods) && album.moods.length > 0 ? 0.5 : 0;
  return moodMatches + aiBoost;
}

/**
 * Order a list of albums per the playlist's `order` strategy.
 * `seed` makes shuffle deterministic per session so re-renders don't reshuffle.
 */
export function orderAlbums(albums, order, seed = 1) {
  const withEnergy = albums.map(a => ({ a, e: getAlbumEnergy(a) }));
  switch (order) {
    case 'energy-asc':   return withEnergy.sort((x, y) => x.e - y.e).map(x => x.a);
    case 'energy-desc':  return withEnergy.sort((x, y) => y.e - x.e).map(x => x.a);
    case 'newest':       return [...albums].sort((x, y) => (y.year || 0) - (x.year || 0));
    case 'oldest':       return [...albums].sort((x, y) => (x.year || 9999) - (y.year || 9999));
    case 'chronological':return [...albums].sort((x, y) => (x.year || 0) - (y.year || 0));
    case 'shuffle':
    default:             return seededShuffle(albums, seed);
  }
}

/** Mulberry32-seeded Fisher-Yates so the same seed -> same order. */
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * MAIN ENTRY. Build a playlist from the collection for a given mood definition.
 * @param {Object[]} albums
 * @param {Object}   playlistDef  one of MOOD_PLAYLISTS
 * @param {Object}   opts { targetMinutes?, targetCount?, seed? }
 * @returns {{ albums, totalMinutes, moodId, reason }}
 */
export function buildPlaylist(albums, playlistDef, opts = {}) {
  const { targetMinutes = null, targetCount = 6, seed = 1 } = opts;

  const candidates = (albums || [])
    .filter(a => albumMatchesRule(a, playlistDef.match))
    .map(a => ({ album: a, score: scoreAlbumForRule(a, playlistDef.match) }))
    .sort((x, y) => y.score - x.score)
    .map(x => x.album);

  // Trim to target BEFORE ordering so ordering applies to the chosen set.
  let chosen;
  if (targetMinutes) {
    chosen = [];
    let mins = 0;
    for (const alb of candidates) {
      if (mins >= targetMinutes && chosen.length >= 2) break;
      chosen.push(alb);
      mins += estimateAlbumMinutes(alb);
    }
  } else {
    chosen = candidates.slice(0, targetCount);
  }

  const ordered = orderAlbums(chosen, playlistDef.order, seed);
  const totalMinutes = ordered.reduce((sum, a) => sum + estimateAlbumMinutes(a), 0);

  return {
    moodId: playlistDef.id,
    albums: ordered,
    totalMinutes,
    reason: buildReason(playlistDef, candidates.length)
  };
}

function buildReason(def, count) {
  if (count === 0) return `No records in your collection match "${def.name}" yet.`;
  return `${count} record${count === 1 ? '' : 's'} in your collection fit ${def.name}.`;
}
