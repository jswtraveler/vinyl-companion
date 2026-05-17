import { useState, useRef, useMemo } from 'react';
import AlbumCard from '../components/AlbumCard';
import SearchBar from '../components/SearchBar';
import TagBackfillModal from '../components/TagBackfillModal';

const CollectionPage = ({
  albums,
  loading,
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  filteredAndSortedAlbums,
  onAlbumClick,
  onEditAlbum,
  onDeleteAlbum,
  onQuickAdd,
  stats,
  showStats,
  onToggleStats,
  onUpdateAlbum,
  user,
  authLoading,
  useCloudDatabase,
  onSignIn,
  onOpenAIAnalysis
}) => {
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [genresExpanded, setGenresExpanded] = useState(false);
  const [thumbFilter, setThumbFilter] = useState(null);
  const [showTagBackfill, setShowTagBackfill] = useState(false);
  const sortDropdownRef = useRef(null);

  const availableGenres = useMemo(() => {
    const genreSet = new Set();
    albums.forEach(album => {
      if (album.genre && Array.isArray(album.genre)) {
        album.genre.forEach(g => genreSet.add(g));
      }
    });
    return Array.from(genreSet).sort();
  }, [albums]);

  const thumbCounts = useMemo(() => ({
    up: albums.filter(a => a.thumb === 'up').length,
    down: albums.filter(a => a.thumb === 'down').length
  }), [albums]);

  const displayedAlbums = useMemo(() => {
    let result = filteredAndSortedAlbums;
    if (selectedGenres.length > 0) {
      result = result.filter(album => {
        if (!album.genre || !Array.isArray(album.genre)) return false;
        return album.genre.some(g => selectedGenres.includes(g));
      });
    }
    if (thumbFilter) {
      result = result.filter(album => album.thumb === thumbFilter);
    }
    return result;
  }, [filteredAndSortedAlbums, selectedGenres, thumbFilter]);

  const toggleGenre = (genre) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const sortLabels = {
    artist: 'Artist',
    title: 'Title',
    year: 'Year',
    dateAdded: 'Date Added',
  };

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        {/* Wordmark */}
        <div>
          <div className="wordmark">
            Vinyl<span>.</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 1 }}>
            {loading ? '…' : `${filteredAndSortedAlbums.length} record${filteredAndSortedAlbums.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Stats toggle */}
          <button
            onClick={onToggleStats}
            className="btn-outline"
            title={showStats ? 'Hide stats' : 'Show stats'}
            style={{ padding: '6px 10px' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>

          {/* Sort */}
          <div style={{ position: 'relative' }} ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="btn-outline"
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              {sortLabels[sortBy]}
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                style={{ opacity: 0.5 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSortDropdown && (
              <div className="sort-dropdown">
                {Object.entries(sortLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onSortChange(key, sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc');
                      setShowSortDropdown(false);
                    }}
                    className={`sort-option ${sortBy === key ? 'sort-option--active' : ''}`}
                  >
                    {label}
                    {sortBy === key && (
                      <span style={{ fontSize: 11 }}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DB status dot */}
          {authLoading ? (
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-text-dim)' }} />
          ) : useCloudDatabase && user ? (
            <div
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#5fad79', cursor: 'default' }}
              title={user.email}
            />
          ) : (
            <div
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#5080d0', cursor: 'pointer' }}
              onClick={onSignIn}
              title="Local — click to sign in"
            />
          )}
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 14 }}>
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search your collection…"
        />
      </div>

      {/* ── Genre filters ── */}
      {availableGenres.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className={`${genresExpanded ? '' : 'scrollbar-hide'}`}
              style={{
                flex: 1,
                display: 'flex',
                flexWrap: genresExpanded ? 'wrap' : 'nowrap',
                gap: 5,
                overflowX: genresExpanded ? 'visible' : 'auto',
                position: 'relative'
              }}
            >
              <button
                onClick={() => setSelectedGenres([])}
                className={`filter-pill ${selectedGenres.length === 0 ? 'filter-pill--active' : ''}`}
              >
                All
              </button>
              {availableGenres.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`filter-pill ${selectedGenres.includes(genre) ? 'filter-pill--active' : ''}`}
                >
                  {genre}
                </button>
              ))}
            </div>
            <button
              onClick={() => setGenresExpanded(e => !e)}
              style={{ color: 'var(--color-text-dim)', flexShrink: 0, padding: 4 }}
              title={genresExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                style={{ transition: 'transform 200ms', transform: genresExpanded ? 'rotate(180deg)' : 'none' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Thumb filter ── */}
      {(thumbCounts.up > 0 || thumbCounts.down > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Rating:
          </span>
          <button
            onClick={() => setThumbFilter(null)}
            className={`filter-pill ${thumbFilter === null ? 'filter-pill--active' : ''}`}
          >
            All
          </button>
          <button
            onClick={() => setThumbFilter(thumbFilter === 'up' ? null : 'up')}
            className={`filter-pill ${thumbFilter === 'up' ? 'filter-pill--active' : ''}`}
            style={thumbFilter === 'up' ? { borderColor: '#5fad79', color: '#5fad79', background: 'rgba(95,173,121,0.1)' } : {}}
          >
            ↑ {thumbCounts.up}
          </button>
          <button
            onClick={() => setThumbFilter(thumbFilter === 'down' ? null : 'down')}
            className={`filter-pill ${thumbFilter === 'down' ? 'filter-pill--active' : ''}`}
            style={thumbFilter === 'down' ? { borderColor: '#c0504a', color: '#c0504a', background: 'rgba(192,80,74,0.1)' } : {}}
          >
            ↓ {thumbCounts.down}
          </button>
        </div>
      )}

      {/* ── Stats panel ── */}
      {showStats && stats && (
        <div style={{
          marginBottom: 20,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--color-text)' }}>
              Collection Stats
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {onOpenAIAnalysis && (
                <button onClick={onOpenAIAnalysis} className="btn-outline" style={{ fontSize: 12 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Mood
                </button>
              )}
              <button onClick={() => setShowTagBackfill(true)} className="btn-outline" style={{ fontSize: 12 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Tags
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { label: 'Albums', value: stats.totalAlbums },
              { label: 'Artists', value: stats.totalArtists },
              { label: 'Genres', value: stats.totalGenres },
              { label: 'Avg Year', value: stats.averageYear || '—' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card__label">{s.label}</div>
                <div className="stat-card__value">{s.value}</div>
              </div>
            ))}
          </div>

          {stats.topGenres && stats.topGenres.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-dim)', marginBottom: 8 }}>
                Top genres
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stats.topGenres.map(({ genre, count }) => (
                  <span key={genre} className="genre-tag">
                    {genre} <span style={{ color: 'var(--color-amber)', marginLeft: 4 }}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Album grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--color-text-muted)' }}>
          <div style={{
            width: 28, height: 28, margin: '0 auto 12px',
            border: '2px solid var(--color-border2)',
            borderTopColor: 'var(--color-amber)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 13 }}>Loading your collection…</p>
        </div>
      ) : displayedAlbums.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎶</div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            {searchQuery
              ? 'No albums match your search.'
              : selectedGenres.length > 0
              ? `Nothing in ${selectedGenres.join(', ')}.`
              : thumbFilter
              ? `No albums rated thumbs ${thumbFilter}.`
              : 'Your collection is empty — start adding records.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10
        }}
          className="album-grid"
        >
          <style>{`
            @media (min-width: 480px)  { .album-grid { grid-template-columns: repeat(3, 1fr) !important; } }
            @media (min-width: 720px)  { .album-grid { grid-template-columns: repeat(4, 1fr) !important; } }
            @media (min-width: 1024px) { .album-grid { grid-template-columns: repeat(5, 1fr) !important; gap: 12px !important; } }
            @media (min-width: 1280px) { .album-grid { grid-template-columns: repeat(6, 1fr) !important; } }
          `}</style>
          {displayedAlbums.map((album, i) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => onAlbumClick(album, displayedAlbums)}
              onEdit={onEditAlbum ? () => onEditAlbum(album) : undefined}
              onDelete={onDeleteAlbum}
              onUpdateAlbum={onUpdateAlbum}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
            />
          ))}
        </div>
      )}

      {/* ── FAB ── */}
      <button onClick={onQuickAdd} className="fab" title="Quick add album">
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" />
        </svg>
      </button>

      {/* ── Tag Backfill Modal ── */}
      <TagBackfillModal
        isOpen={showTagBackfill}
        onClose={() => setShowTagBackfill(false)}
        albums={albums}
        onUpdateAlbum={onUpdateAlbum}
      />
    </div>
  );
};

export default CollectionPage;
