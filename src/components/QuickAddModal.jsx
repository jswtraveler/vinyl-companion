import { useState, useEffect, useRef } from 'react';

const QuickAddModal = ({ isOpen, onClose, onSearch, onAdvanced }) => {
  const [searchInput, setSearchInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
      setSearchInput('');
      onClose();
    }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter') handleSearch(); };

  if (!isOpen) return null;

  const examples = ['The Beatles', 'Pink Floyd', 'Miles Davis'];

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50 }} onClick={onClose} />

      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border2)',
            borderRadius: 6,
            padding: '22px',
            width: '100%',
            maxWidth: 420,
            pointerEvents: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>
              Quick Add
            </h3>
            <button onClick={onClose} style={{ color: 'var(--color-text-dim)' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <svg
              width="15" height="15" fill="none" stroke="var(--color-text-dim)" strokeWidth="2" viewBox="0 0 24 24"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Artist or album name…"
              className="search-input"
            />
          </div>

          {/* Example chips */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-dim)', marginBottom: 8 }}>
              Examples
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => setSearchInput(ex)}
                  className="filter-pill"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={onAdvanced}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 0 }}
            >
              More options
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <button
                onClick={handleSearch}
                disabled={!searchInput.trim()}
                className="btn-primary"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuickAddModal;
