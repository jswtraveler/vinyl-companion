import React, { useState } from 'react';

const AlbumCard = ({
  album,
  onClick,
  onEdit,
  onDelete,
  onUpdateAlbum,
  showActions = true
}) => {
  const [showDescription, setShowDescription] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(album);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(album);
  };

  const handleThumb = (e, value) => {
    e.stopPropagation();
    if (!onUpdateAlbum) return;
    const newThumb = album.thumb === value ? null : value;
    onUpdateAlbum(album.id, { thumb: newThumb });
  };

  const hasAIDescription = album.aiAnalysis && album.aiAnalysis.reasoning;

  const toggleDescription = (e) => {
    e.stopPropagation();
    setShowDescription(!showDescription);
  };

  const hasCover = Boolean(album.coverImage);

  return (
    <article
      className="album-card fade-up"
      onClick={() => onClick?.(album)}
    >
      {/* ── Cover ── */}
      <div className="album-card__cover">
        {hasCover ? (
          <img
            src={album.coverImage}
            alt={`${album.title} cover`}
            loading="lazy"
          />
        ) : (
          <div className="album-card__no-cover">
            <svg width="36" height="36" fill="none" stroke="var(--color-border2)" strokeWidth="1.25" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
        )}

        {/* Overlay: year (only when cover exists so it's readable) */}
        {hasCover && album.year && (
          <div className="album-card__overlay">
            <span style={{ fontSize: 10, color: 'rgba(240,236,228,0.55)', letterSpacing: '0.08em' }}>
              {album.year}
            </span>
          </div>
        )}

        {/* Action buttons */}
        {showActions && (
          <div className={`album-card__actions ${('ontouchstart' in window) ? 'album-card__actions--mobile' : ''}`}>
            {onEdit && (
              <button
                className="album-card__action-btn"
                onClick={handleEdit}
                title="Edit"
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                className="album-card__action-btn album-card__action-btn--delete"
                onClick={handleDelete}
                title="Delete"
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Info strip ── */}
      <div className="album-card__info">
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.25,
            marginBottom: 2
          }}
          title={album.title}
        >
          {album.title}
        </h3>

        <p
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.01em'
          }}
          title={album.artist}
        >
          {album.artist}
        </p>

        {/* Year (when no cover) */}
        {!hasCover && album.year && (
          <p style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 2 }}>
            {album.year}
          </p>
        )}

        {/* Mood tags */}
        {album.moods && album.moods.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
            {album.moods.slice(0, 2).map((mood) => (
              <span key={mood} className="mood-tag">{mood}</span>
            ))}
            {album.moods.length > 2 && (
              <span style={{ fontSize: 10, color: 'var(--color-text-dim)', alignSelf: 'center' }}>
                +{album.moods.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Bottom row: thumbs + AI button */}
        {(onUpdateAlbum || hasAIDescription) && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, gap: 2 }}>
            {onUpdateAlbum && (
              <>
                <button
                  className={`thumb-btn ${album.thumb === 'up' ? 'thumb-btn--up' : ''}`}
                  onClick={(e) => handleThumb(e, 'up')}
                  title="Thumbs up"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24"
                    fill={album.thumb === 'up' ? 'currentColor' : 'none'}
                    stroke="currentColor" strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zm-9 11H3a2 2 0 01-2-2v-7a2 2 0 012-2h2"
                    />
                  </svg>
                </button>
                <button
                  className={`thumb-btn ${album.thumb === 'down' ? 'thumb-btn--down' : ''}`}
                  onClick={(e) => handleThumb(e, 'down')}
                  title="Thumbs down"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24"
                    fill={album.thumb === 'down' ? 'currentColor' : 'none'}
                    stroke="currentColor" strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zm9-13h2a2 2 0 012 2v7a2 2 0 01-2 2h-2"
                    />
                  </svg>
                </button>
              </>
            )}

            {hasAIDescription && (
              <button
                onClick={toggleDescription}
                title="AI mood analysis"
                style={{ marginLeft: 'auto', color: 'var(--color-amber)', opacity: 0.7 }}
                className="thumb-btn"
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── AI description overlay ── */}
      {showDescription && hasAIDescription && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10,9,8,0.94)',
            padding: 14,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-amber)' }}>
              AI Analysis
            </span>
            <button onClick={toggleDescription} style={{ color: 'var(--color-text-dim)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            lineHeight: 1.55,
            flex: 1,
            overflowY: 'auto'
          }}>
            "{album.aiAnalysis.reasoning}"
          </p>
          {album.aiAnalysis.timestamp && (
            <p style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 6 }}>
              {formatDate(album.aiAnalysis.timestamp)}
            </p>
          )}
        </div>
      )}
    </article>
  );
};

export default AlbumCard;
