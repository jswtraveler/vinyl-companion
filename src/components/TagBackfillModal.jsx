import { useState } from 'react';
import { backfillAlbumTags, estimateBackfillTime } from '../services/albumTagBackfill';

const TagBackfillModal = ({ isOpen, onClose, albums, onUpdateAlbum }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, album: null });
  const [results, setResults] = useState(null);
  const [forceRefetch, setForceRefetch] = useState(false);

  const handleStartBackfill = async (force = false) => {
    setIsRunning(true);
    setResults(null);
    setProgress({ current: 0, total: albums.length, album: null });
    try {
      const finalResults = await backfillAlbumTags(
        albums,
        (current, total, album) => setProgress({ current, total, album }),
        async (albumId, updates) => await onUpdateAlbum(albumId, updates),
        force
      );
      setResults(finalResults);
    } catch (error) {
      setResults({ error: error.message, processed: progress.current });
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      onClose();
      setTimeout(() => { setProgress({ current: 0, total: 0, album: null }); setResults(null); }, 300);
    }
  };

  if (!isOpen) return null;

  const estimatedTime = estimateBackfillTime(albums.length);
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50 }} onClick={handleClose} />

      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border2)',
            borderRadius: 6,
            padding: '24px',
            width: '100%',
            maxWidth: 560,
            pointerEvents: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, color: 'var(--color-text)' }}>
              Backfill Genre Tags
            </h3>
            {!isRunning && (
              <button onClick={handleClose} style={{ color: 'var(--color-text-dim)' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Ready state */}
          {!isRunning && !results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                {forceRefetch
                  ? 'Re-fetches genre tags from Last.fm for all albums, replacing existing tags with MusicBrainz-validated genres.'
                  : 'Fetches genre tags from Last.fm for albums with fewer than 3 tags and merges them with existing genres.'}
              </p>

              {/* Stats row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 14
              }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-dim)', marginBottom: 3 }}>Albums</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text)' }}>{albums.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-dim)', marginBottom: 3 }}>Est. time</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text)' }}>{estimatedTime}</div>
                </div>
              </div>

              {/* Force refetch toggle */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 14
              }}>
                <input
                  type="checkbox"
                  checked={forceRefetch}
                  onChange={e => setForceRefetch(e.target.checked)}
                  style={{ marginTop: 2, accentColor: 'var(--color-amber)', width: 15, height: 15 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 3 }}>Force re-fetch all albums</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    Replace existing tags rather than merging. Use this to clean up invalid tags from previous runs.
                  </div>
                </div>
              </label>

              {/* Info box */}
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: 'rgba(232,160,64,0.06)', border: '1px solid var(--color-amber-dim)', borderRadius: 4, padding: 14
              }}>
                <svg width="15" height="15" fill="none" stroke="var(--color-amber)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <ul style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7, listStyle: 'none', margin: 0, padding: 0 }}>
                  <li>Respects Last.fm rate limit (1 request / second)</li>
                  <li>{forceRefetch ? 'All albums will be processed' : 'Albums with 3+ tags will be skipped'}</li>
                  <li>Only MusicBrainz-validated genres are kept</li>
                  <li>{forceRefetch ? 'New tags replace existing genres' : 'New tags merge with existing genres'}</li>
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6 }}>
                <button onClick={handleClose} className="btn-ghost">Cancel</button>
                <button onClick={() => handleStartBackfill(forceRefetch)} className="btn-primary">
                  Start backfill
                </button>
              </div>
            </div>
          )}

          {/* Progress state */}
          {isRunning && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: 36, height: 36, margin: '0 auto 16px',
                  border: '3px solid var(--color-border2)',
                  borderTopColor: 'var(--color-amber)',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ fontSize: 14, color: 'var(--color-text)', marginBottom: 4 }}>
                  Processing {progress.current} of {progress.total}
                </p>
                {progress.album && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    {progress.album.artist} — {progress.album.title}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'var(--color-surface3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'var(--color-amber)',
                  borderRadius: 2,
                  width: `${progressPercent}%`,
                  transition: 'width 300ms ease-out'
                }} />
              </div>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-dim)' }}>
                {Math.round(progressPercent)}%
              </p>
            </div>
          )}

          {/* Results state */}
          {results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {results.error ? (
                <div style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: 'rgba(192,80,74,0.08)', border: '1px solid rgba(192,80,74,0.3)', borderRadius: 4, padding: 14
                }}>
                  <svg width="16" height="16" fill="none" stroke="#e0706a" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#e0706a', marginBottom: 4 }}>Error during backfill</p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{results.error}</p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>Processed {results.processed} albums before error.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    background: 'rgba(95,173,121,0.08)', border: '1px solid rgba(95,173,121,0.25)', borderRadius: 4, padding: 14
                  }}>
                    <svg width="16" height="16" fill="none" stroke="#5fad79" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p style={{ fontSize: 13, color: '#5fad79', fontWeight: 500 }}>Backfill complete</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Processed', value: results.processed, color: 'var(--color-text)' },
                      { label: 'Updated',   value: results.updated,   color: '#5fad79' },
                      { label: 'Skipped',   value: results.skipped,   color: 'var(--color-amber)' },
                      { label: 'Errors',    value: results.errors,    color: '#e0706a' },
                    ].map(s => (
                      <div key={s.label} className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-card__label">{s.label}</div>
                        <div className="stat-card__value" style={{ fontSize: 22, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {results.errorDetails && results.errorDetails.length > 0 && (
                <details style={{
                  background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 4, padding: 14
                }}>
                  <summary style={{ fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                    Error details ({results.errorDetails.length})
                  </summary>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {results.errorDetails.map((detail, i) => (
                      <div key={i} style={{ borderLeft: '2px solid rgba(192,80,74,0.5)', paddingLeft: 10 }}>
                        <p style={{ fontSize: 12, color: 'var(--color-text)', marginBottom: 2 }}>{detail.album}</p>
                        <p style={{ fontSize: 11, color: '#e0706a' }}>{detail.error}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
                <button onClick={handleClose} className="btn-primary">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TagBackfillModal;
