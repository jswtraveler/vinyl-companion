import { useState, useMemo, useEffect } from 'react';
import { buildPlaylist, albumMatchesRule, scoreAlbumForRule } from '../../services/playlists/playlistBuilder.js';
import { estimateAlbumMinutes } from '../../utils/moodUtils.js';
import PlaylistRow from './PlaylistRow.jsx';

/**
 * Panel showing a generated playlist for a mood.
 * Given `{ mood, albums, sessionSize, onClose, onOpenAlbum, onOpenAIAnalysis }`.
 */
const PlaylistView = ({ mood, albums, sessionSize, onClose, onOpenAlbum, onOpenAIAnalysis, onSave }) => {
  const [seed, setSeed] = useState(1);
  const [manualAlbums, setManualAlbums] = useState(null); // overrides generated order once user edits

  const sizeOpts = useMemo(() => ({
    targetCount: sessionSize?.targetCount ?? undefined,
    targetMinutes: sessionSize?.targetMinutes ?? undefined
  }), [sessionSize]);

  const generated = useMemo(
    () => buildPlaylist(albums, mood, { ...sizeOpts, seed }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [albums, mood, sizeOpts.targetCount, sizeOpts.targetMinutes, seed]
  );

  // Reset manual edits whenever the underlying generation changes (new seed/mood/size)
  useEffect(() => {
    setManualAlbums(null);
  }, [generated]);

  const playlistAlbums = manualAlbums || generated.albums;
  const totalMinutes = playlistAlbums.reduce((sum, a) => sum + estimateAlbumMinutes(a), 0);

  // Unused candidates for swap-in, ranked best-first
  const unusedCandidates = useMemo(() => {
    const usedIds = new Set(playlistAlbums.map(a => a.id));
    return (albums || [])
      .filter(a => !usedIds.has(a.id) && albumMatchesRule(a, mood.match))
      .map(a => ({ album: a, score: scoreAlbumForRule(a, mood.match) }))
      .sort((x, y) => y.score - x.score)
      .map(x => x.album);
  }, [albums, mood, playlistAlbums]);

  const handleReshuffle = () => setSeed(s => s + 1);

  const handleMove = (index, dir) => {
    const next = [...playlistAlbums];
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setManualAlbums(next);
  };

  const handleRemove = (index) => {
    const next = playlistAlbums.filter((_, i) => i !== index);
    setManualAlbums(next);
  };

  const handleSwap = (index) => {
    if (unusedCandidates.length === 0) return;
    const next = [...playlistAlbums];
    next[index] = unusedCandidates[0];
    setManualAlbums(next);
  };

  const runtimeLabel = `~${totalMinutes} min · ${playlistAlbums.length} record${playlistAlbums.length === 1 ? '' : 's'}`;

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border2)',
      borderRadius: 4,
      padding: 16,
      marginTop: 8
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{mood.emoji}</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
              {mood.name}
            </h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>
            {playlistAlbums.length > 0 ? runtimeLabel : generated.reason}
          </p>
        </div>

        <button onClick={onClose} className="btn-outline" style={{ padding: '6px 10px' }} title="Close">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {playlistAlbums.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleReshuffle}
              className="btn-outline"
              disabled={!manualAlbums && !generated.canReshuffle}
              title={!generated.canReshuffle ? 'Not enough matching records to rotate this playlist' : undefined}
            >
              Reshuffle
            </button>
            {onSave && (
              <button onClick={() => onSave({ mood, albums: playlistAlbums })} className="btn-outline">
                Save
              </button>
            )}
          </div>
          {!generated.canReshuffle && (
            <p style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
              Not enough matching records to rotate this playlist yet.
            </p>
          )}
        </div>
      )}

      {playlistAlbums.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {generated.reason}
          </p>
          {onOpenAIAnalysis && (
            <>
              <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 12 }}>
                Tag more albums to unlock this — run AI Mood Analysis from your Collection.
              </p>
              <button onClick={onOpenAIAnalysis} className="btn-outline">
                Run AI Mood Analysis
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {playlistAlbums.length <= 2 && (
            <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 10 }}>
              Only a couple fit right now.
            </p>
          )}
          <div>
            {playlistAlbums.map((album, i) => (
              <PlaylistRow
                key={`${album.id}-${i}`}
                album={album}
                index={i}
                total={playlistAlbums.length}
                moodMatch={mood.match}
                onMoveUp={() => handleMove(i, -1)}
                onMoveDown={() => handleMove(i, 1)}
                onRemove={() => handleRemove(i)}
                onSwap={() => handleSwap(i)}
                onCoverClick={() => onOpenAlbum && onOpenAlbum(album, playlistAlbums)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PlaylistView;
