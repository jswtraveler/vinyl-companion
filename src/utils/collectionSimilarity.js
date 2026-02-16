import { getMoodsForAlbum } from './moodUtils';

/**
 * Jaccard similarity between two arrays
 */
function jaccard(a, b) {
  if (!a?.length || !b?.length) return 0;
  const setA = new Set(a.map(s => (typeof s === 'string' ? s.toLowerCase() : s)));
  const setB = new Set(b.map(s => (typeof s === 'string' ? s.toLowerCase() : s)));
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Decade from a year (e.g. 1973 → 1970)
 */
function decade(year) {
  return Math.floor(year / 10) * 10;
}

/**
 * Find similar albums from the user's own collection.
 * Returns sorted array of { album, score, reasons[] }.
 */
export function findSimilarOwned(targetAlbum, allAlbums) {
  if (!targetAlbum || !allAlbums?.length) return [];

  const targetGenres = targetAlbum.genre || [];
  const targetMoods = getMoodsForAlbum(targetAlbum);
  const targetDecade = targetAlbum.year ? decade(targetAlbum.year) : null;

  const results = [];

  for (const album of allAlbums) {
    if (album.id === targetAlbum.id) continue;

    const reasons = [];
    let score = 0;

    // Genre overlap (weight 0.4)
    const genreScore = jaccard(targetGenres, album.genre || []);
    if (genreScore > 0) {
      score += genreScore * 0.4;
      reasons.push('Similar genre');
    }

    // Mood overlap (weight 0.3)
    const albumMoods = getMoodsForAlbum(album);
    const moodScore = jaccard(targetMoods, albumMoods);
    if (moodScore > 0) {
      score += moodScore * 0.3;
      reasons.push('Similar mood');
    }

    // Era proximity (weight 0.15)
    if (targetDecade !== null && album.year) {
      const albumDecade = decade(album.year);
      const decadeDiff = Math.abs(targetDecade - albumDecade);
      const eraScore = decadeDiff === 0 ? 1.0 : decadeDiff === 10 ? 0.5 : 0;
      if (eraScore > 0) {
        score += eraScore * 0.15;
        reasons.push(decadeDiff === 0 ? 'Same era' : 'Adjacent era');
      }
    }

    // Thumb boost (weight 0.15)
    const thumbScore = album.thumb === 'up' ? 1.0 : album.thumb === 'down' ? 0 : 0.5;
    score += thumbScore * 0.15;

    // Same-artist bonus
    if (
      targetAlbum.artist &&
      album.artist &&
      targetAlbum.artist.toLowerCase() === album.artist.toLowerCase()
    ) {
      score += 0.1;
      reasons.push('Same artist');
    }

    if (score > 0.05 && reasons.length > 0) {
      results.push({ album, score, reasons });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 8);
}
