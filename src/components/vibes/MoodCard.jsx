/**
 * MoodCard — a single "vibe" tile in the Vibes shelf.
 * Matches the DiscoverPage inline-style, CSS-variable convention.
 */
const MoodCard = ({ playlist, count, onClick }) => {
  const isEmpty = count === 0;
  const isThin = count > 0 && count < 3;

  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 160,
        minHeight: 150,
        textAlign: 'left',
        background: 'var(--color-surface2)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${isEmpty ? 'var(--color-border)' : playlist.color}`,
        borderRadius: 4,
        padding: '14px 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: isEmpty ? 0.5 : 1,
        transition: 'border-color 140ms, background 140ms, transform 140ms',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-amber-dim)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.borderLeftColor = isEmpty ? 'var(--color-border)' : playlist.color; }}
    >
      <div>
        <div style={{ fontSize: 26, marginBottom: 8, lineHeight: 1 }}>{playlist.emoji}</div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: 4,
          lineHeight: 1.25
        }}>
          {playlist.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {playlist.subtitle}
        </div>
      </div>

      <div style={{ fontSize: 11, color: isEmpty ? 'var(--color-text-dim)' : 'var(--color-text-dim)', marginTop: 10 }}>
        {isEmpty
          ? 'No records yet'
          : `${count} record${count === 1 ? '' : 's'}${isThin ? ' · thin' : ''}`}
      </div>
    </button>
  );
};

export default MoodCard;
