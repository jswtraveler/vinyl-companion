import { useEffect, useRef, useCallback } from 'react';
import KeepItGoingPanel from './KeepItGoingPanel';

export default function AlbumDetailModal({ album, allAlbums, onClose, onEdit, onSelectSimilar }) {
  const touchStartX = useRef(null);
  const modalRef = useRef(null);

  const currentIndex = allAlbums ? allAlbums.findIndex(a => a.id === album?.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < allAlbums.length - 1;

  const goToPrev = useCallback(() => { if (hasPrev) onSelectSimilar(allAlbums[currentIndex - 1]); }, [hasPrev, currentIndex, allAlbums, onSelectSimilar]);
  const goToNext = useCallback(() => { if (hasNext) onSelectSimilar(allAlbums[currentIndex + 1]); }, [hasNext, currentIndex, allAlbums, onSelectSimilar]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToPrev, goToNext, onClose]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 50) goToPrev();
    else if (dx < -50) goToNext();
  };

  if (!album) return null;

  const tracks = album.tracks || [];
  const hasSides = tracks.some(t => t.side);
  const tracksBySide = hasSides
    ? tracks.reduce((acc, t) => {
        const side = t.side || '?';
        if (!acc[side]) acc[side] = [];
        acc[side].push(t);
        return acc;
      }, {})
    : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border2)',
          borderRadius: 6,
          width: '100%',
          maxWidth: 480,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          position: 'relative'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Cover image */}
        <div style={{ aspectRatio: '1', background: 'var(--color-surface2)', position: 'relative', overflow: 'hidden' }}>
          {album.coverImage ? (
            <img
              src={album.coverImage}
              alt={`${album.title} cover`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `repeating-linear-gradient(-45deg, var(--color-surface2), var(--color-surface2) 5px, var(--color-surface) 5px, var(--color-surface) 15px)`
            }}>
              <svg width="64" height="64" fill="none" stroke="var(--color-border2)" strokeWidth="1" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 10, right: 10,
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(10,9,8,0.7)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}
            aria-label="Close"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev / Next */}
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(10,9,8,0.65)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
              aria-label="Previous"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {hasNext && (
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(10,9,8,0.65)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
              aria-label="Next"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Position indicator */}
          {allAlbums && allAlbums.length > 1 && currentIndex !== -1 && (
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(10,9,8,0.65)', backdropFilter: 'blur(4px)',
              borderRadius: 20, padding: '2px 10px',
              fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em'
            }}>
              {currentIndex + 1} / {allAlbums.length}
            </div>
          )}
        </div>

        {/* Info section */}
        <div style={{ padding: '18px 20px 20px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>
            {album.title}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 4 }}>{album.artist}</p>

          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {album.year && (
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{album.year}</span>
            )}
            {album.format && album.format !== 'LP' && (
              <span className="genre-tag">{album.format}</span>
            )}
            {album.label && (
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{album.label}</span>
            )}
            {album.condition && (
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{album.condition}</span>
            )}
          </div>

          {/* Genre tags */}
          {album.genre && album.genre.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {album.genre.map(g => <span key={g} className="genre-tag">{g}</span>)}
            </div>
          )}

          {/* Mood tags */}
          {album.moods && album.moods.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {album.moods.map(mood => <span key={mood} className="mood-tag">{mood}</span>)}
            </div>
          )}

          {/* Thumb status */}
          {album.thumb && (
            <div style={{ marginBottom: 12 }}>
              {album.thumb === 'up' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#5fad79' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" strokeWidth="0">
                    <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zm-9 11H3a2 2 0 01-2-2v-7a2 2 0 012-2h2" />
                  </svg>
                  Liked
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#c0504a' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" strokeWidth="0">
                    <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zm9-13h2a2 2 0 012 2v7a2 2 0 01-2 2h-2" />
                  </svg>
                  Disliked
                </span>
              )}
            </div>
          )}

          {/* Track listing */}
          {tracks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-dim)', marginBottom: 10 }}>
                Tracks
              </div>
              {hasSides ? (
                Object.entries(tracksBySide)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([side, sideTracks]) => (
                    <div key={side} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 10, color: 'var(--color-amber)', letterSpacing: '0.08em', marginBottom: 6 }}>
                        Side {side}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {sideTracks
                          .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                          .map(track => (
                            <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                              <span style={{ width: 18, textAlign: 'right', flexShrink: 0, color: 'var(--color-text-dim)', fontSize: 11 }}>
                                {track.track_number}
                              </span>
                              <span style={{ flex: 1, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {track.title}
                              </span>
                              {track.duration && (
                                <span style={{ flexShrink: 0, color: 'var(--color-text-dim)', fontSize: 11 }}>{track.duration}</span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tracks
                    .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                    .map(track => (
                      <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                        <span style={{ width: 18, textAlign: 'right', flexShrink: 0, color: 'var(--color-text-dim)', fontSize: 11 }}>
                          {track.track_number}
                        </span>
                        <span style={{ flex: 1, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.title}
                        </span>
                        {track.duration && (
                          <span style={{ flexShrink: 0, color: 'var(--color-text-dim)', fontSize: 11 }}>{track.duration}</span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Keep it going */}
          <KeepItGoingPanel
            targetAlbum={album}
            allAlbums={allAlbums}
            onSelectAlbum={onSelectSimilar}
          />

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {onEdit && (
              <button onClick={() => onEdit(album)} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Edit
              </button>
            )}
            <button onClick={onClose} className="btn-ghost" style={{ flex: 1, textAlign: 'center' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
