import { useState } from 'react';
import { getMoodsForAlbum, estimateAlbumMinutes } from '../../utils/moodUtils.js';
import { MOOD_CATEGORIES } from '../../utils/moodUtils.js';

const moodLabel = (moodId) => MOOD_CATEGORIES.find(m => m.id === moodId)?.label || moodId;

/**
 * A single row in a generated playlist.
 */
const PlaylistRow = ({
  album,
  index,
  total,
  moodMatch,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSwap,
  onCoverClick
}) => {
  const [showWhy, setShowWhy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const matchedTags = (moodMatch?.moods || []).filter(m => getMoodsForAlbum(album).includes(m));

  return (
    <div style={{
      background: 'var(--color-surface2)',
      border: '1px solid var(--color-border)',
      borderRadius: 4,
      marginBottom: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <div style={{ width: 20, textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)', flexShrink: 0 }}>
          {index + 1}
        </div>

        <div
          onClick={onCoverClick}
          style={{
            width: 44, height: 44, flexShrink: 0, borderRadius: 3, overflow: 'hidden',
            background: 'var(--color-surface3)', cursor: 'pointer'
          }}
        >
          {(album.thumb || album.coverImage) ? (
            <img
              src={album.thumb || album.coverImage}
              alt={`${album.title} cover`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" stroke="var(--color-border2)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>

        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => setShowWhy(!showWhy)}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {album.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {album.artist}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', flexShrink: 0, width: 40, textAlign: 'right' }}>
          {estimateAlbumMinutes(album)}m
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            style={{ opacity: index === 0 ? 0.25 : 0.7, padding: 2, cursor: index === 0 ? 'default' : 'pointer' }}
            title="Move up"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={{ opacity: index === total - 1 ? 0.25 : 0.7, padding: 2, cursor: index === total - 1 ? 'default' : 'pointer' }}
            title="Move down"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="btn-outline"
            style={{ padding: '5px 8px' }}
            title="More"
          >
            ⋯
          </button>
          {showMenu && (
            <div className="sort-dropdown" style={{ minWidth: 140 }}>
              <button
                className="sort-option"
                onClick={() => { onSwap(); setShowMenu(false); }}
              >
                Swap
              </button>
              <button
                className="sort-option"
                onClick={() => { onRemove(); setShowMenu(false); }}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {showWhy && (
        <div style={{
          padding: '0 12px 10px 66px',
          fontSize: 11,
          color: 'var(--color-text-dim)'
        }}>
          {matchedTags.length > 0
            ? <>Matched: {matchedTags.map(moodLabel).join(', ')}</>
            : <>No direct mood tag match — picked from genre/year fit.</>}
        </div>
      )}
    </div>
  );
};

export default PlaylistRow;
