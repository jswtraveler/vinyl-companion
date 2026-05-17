import { useState, useMemo, useRef, useCallback } from 'react';
import { findSimilarOwned } from '../utils/collectionSimilarity';

export default function KeepItGoingPanel({ targetAlbum, allAlbums, onSelectAlbum }) {
  const [expanded, setExpanded] = useState(false);
  // Shared ref so every card can read the container's scrollLeft at pointerdown
  const scrollRef = useRef(null);
  const scrollAtPointerDown = useRef(0);

  const similar = useMemo(
    () => findSimilarOwned(targetAlbum, allAlbums),
    [targetAlbum, allAlbums]
  );

  const handleScrollerPointerDown = useCallback(() => {
    scrollAtPointerDown.current = scrollRef.current?.scrollLeft ?? 0;
  }, []);

  if (!targetAlbum) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: 'var(--color-surface2)',
          border: '1px solid var(--color-border)',
          borderRadius: expanded ? '4px 4px 0 0' : 4,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-amber)',
          cursor: 'pointer',
          transition: 'background 140ms'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface2)'}
      >
        <span>Keep it going</span>
        <svg
          width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transition: 'transform 200ms', transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div style={{
          background: 'var(--color-surface2)',
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          padding: '10px 10px 6px'
        }}>
          {similar.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 2px' }}>
              No similar albums found in your collection.
            </p>
          ) : (
            <div
              ref={scrollRef}
              onPointerDown={handleScrollerPointerDown}
              className="scrollbar-hide"
              style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}
            >
              {similar.map(({ album, reasons }) => (
                <DragSafeCard
                  key={album.id}
                  album={album}
                  reason={reasons[0]}
                  onSelectAlbum={onSelectAlbum}
                  scrollRef={scrollRef}
                  scrollAtPointerDown={scrollAtPointerDown}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DragSafeCard — only fires onSelectAlbum when the scroll container
 * hasn't moved since pointerdown. This correctly handles touch-scroll
 * where the finger barely moves but the container scrolls.
 */
function DragSafeCard({ album, reason, onSelectAlbum, scrollRef, scrollAtPointerDown }) {
  const SCROLL_THRESHOLD = 4; // px of container scrollLeft change

  const handlePointerUp = () => {
    const scrollNow = scrollRef.current?.scrollLeft ?? 0;
    if (Math.abs(scrollNow - scrollAtPointerDown.current) < SCROLL_THRESHOLD) {
      onSelectAlbum(album);
    }
  };

  return (
    <div
      onPointerUp={handlePointerUp}
      style={{
        flexShrink: 0,
        width: 100,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 140ms',
        userSelect: 'none'
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
    >
      {/* Cover */}
      <div style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--color-surface3)' }}>
        {album.coverImage ? (
          <img
            src={album.coverImage}
            alt={album.title}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `repeating-linear-gradient(-45deg, var(--color-surface2), var(--color-surface2) 3px, var(--color-surface) 3px, var(--color-surface) 9px)`
          }}>
            <svg width="24" height="24" fill="none" stroke="var(--color-border2)" strokeWidth="1.25" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '7px 8px 8px' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
          color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 1
        }}>
          {album.title}
        </p>
        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {album.artist}
        </p>
        {reason && (
          <p style={{ fontSize: 10, color: 'var(--color-amber)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}
