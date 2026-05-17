/**
 * AddAlbumPage — warm analog dark theme
 */
const AddAlbumPage = ({ onFindByName, onIdentifyImage, onManualEntry, onBulkAdd }) => {
  const methods = [
    {
      id: 'name',
      primary: true,
      icon: '🔍',
      title: 'Find by Name',
      desc: 'Search Discogs by artist or album name — quickest and most accurate.',
      cta: 'Search now',
      action: onFindByName,
    },
    {
      id: 'bulk',
      icon: '📋',
      title: 'Add Multiple',
      desc: 'Paste a list of albums and match them all at once.',
      cta: 'Bulk add',
      action: onBulkAdd,
    },
    {
      id: 'image',
      icon: '📷',
      title: 'Identify from Image',
      desc: 'Photograph a record sleeve to identify it automatically.',
      cta: 'Take photo',
      action: onIdentifyImage,
    },
    {
      id: 'manual',
      icon: '✏️',
      title: 'Manual Entry',
      desc: 'Enter all details yourself for full control.',
      cta: 'Enter details',
      action: onManualEntry,
    },
  ];

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: 4
        }}>
          Add to Collection
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          How would you like to add this record?
        </p>
      </div>

      {/* Method cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={m.action}
            className={`method-card ${m.primary ? 'method-card--primary' : ''}`}
          >
            <span className="method-card__icon">{m.icon}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="method-card__title">{m.title}</div>
              <div className="method-card__desc">{m.desc}</div>
            </div>

            <span className="method-card__arrow">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {/* Tip */}
      <div style={{
        marginTop: 28,
        padding: '12px 16px',
        background: 'var(--color-surface2)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start'
      }}>
        <svg width="15" height="15" fill="none" stroke="var(--color-amber)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>Find by Name</strong> is the fastest method for single records.
          Use <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>Add Multiple</strong> when cataloguing a stack at once.
        </p>
      </div>
    </div>
  );
};

export default AddAlbumPage;
