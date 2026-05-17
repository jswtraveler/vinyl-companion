import React, { useState, useEffect } from 'react';

const AlbumSearchModal = ({ onClose, onSelectAlbum, initialSearchQuery = '' }) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = orig;
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const { DiscogsClient } = await import('../services/api/music/index.js');
      const results = await DiscogsClient.searchReleases(searchQuery.trim());
      setSearchResults(results.map(r => ({ ...r, source: 'discogs', identificationMethod: 'manual-discogs-search' })));
    } catch (err) {
      console.error('Album search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (initialSearchQuery?.trim()) handleSearch();
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div
      className="modal-backdrop"
      style={{ touchAction: 'none', alignItems: 'flex-start', paddingTop: 40 }}
      onClick={onClose}
    >
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'auto', maxHeight: 'calc(100vh - 80px)' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 className="modal-title">Find Album by Name</h2>
            <button onClick={onClose} style={{ color: 'var(--color-text-dim)' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <svg
                width="15" height="15" fill="none" stroke="var(--color-text-dim)" strokeWidth="2" viewBox="0 0 24 24"
                style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Album name or artist…"
                autoFocus
                className="search-input"
                style={{ paddingLeft: 34, paddingRight: 12 }}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="btn-primary"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 8 }}>
            Searches the Discogs vinyl database
          </p>
        </div>

        {/* Results */}
        <div
          className="modal-body"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
        >
          {isSearching && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12, color: 'var(--color-text-muted)' }}>
              <div style={{
                width: 20, height: 20, border: '2px solid var(--color-border2)',
                borderTopColor: 'var(--color-amber)', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite'
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              Searching Discogs…
            </div>
          )}

          {!isSearching && hasSearched && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--color-text)', marginBottom: 6 }}>
                No results found
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Try a different search term or check spelling</p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {searchResults.length} results
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {searchResults.map((album, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectAlbum(album)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 3,
                      border: '1px solid transparent',
                      background: 'transparent',
                      transition: 'background 140ms, border-color 140ms',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--color-surface2)';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{
                      width: 52, height: 52, flexShrink: 0, borderRadius: 2,
                      overflow: 'hidden', background: 'var(--color-surface3)',
                      border: '1px solid var(--color-border)'
                    }}>
                      {album.coverImage ? (
                        <img src={album.coverImage} alt={album.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="20" height="20" fill="none" stroke="var(--color-border2)" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 14, fontWeight: 600,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {album.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {album.artist}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        {[album.year, album.label, album.format].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    <svg width="14" height="14" fill="none" stroke="var(--color-text-dim)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasSearched && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🎵</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--color-text-muted)' }}>
                Search to get started
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <p style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Powered by Discogs</p>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AlbumSearchModal;
