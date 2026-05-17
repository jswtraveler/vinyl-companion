import { useRef, useState, useEffect } from 'react';
import { ListenBrainzClient } from '../services/api/music/ListenBrainzClient.js';

const ArtistCarousel = ({ title, artists, showCount = false, albumCount = null }) => {
  const scrollRef = useRef(null);
  const [listenBrainzClient] = useState(() => new ListenBrainzClient());

  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  if (!artists || artists.length === 0) return null;

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>
            {title}
          </h3>
          {showCount && albumCount !== null && (
            <span style={{ fontSize: 11, color: 'var(--color-text-dim)', letterSpacing: '0.04em' }}>
              {albumCount} album{albumCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {artists.length > 3 && (
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={() => scroll('left')}
              className="btn-outline"
              style={{ padding: '4px 8px' }}
              aria-label="Scroll left"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className="btn-outline"
              style={{ padding: '4px 8px' }}
              aria-label="Scroll right"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="scrollbar-hide"
        style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollBehavior: 'smooth' }}
      >
        {artists.map((artist, index) => (
          <ArtistCard
            key={`${artist.artist}-${index}`}
            artist={artist}
            listenBrainzClient={listenBrainzClient}
          />
        ))}
      </div>
    </div>
  );
};

const ArtistCard = ({ artist, listenBrainzClient }) => {
  const [expanded, setExpanded] = useState(false);
  const [topAlbums, setTopAlbums] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (expanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 50);
    }
  }, [expanded]);

  const handleToggleExpand = async () => {
    if (!expanded && !topAlbums && artist.mbid) {
      setLoading(true);
      setError(null);
      try {
        const albums = await listenBrainzClient.getTopAlbumsForArtist(artist.mbid, 5, true);
        setTopAlbums(listenBrainzClient.formatTopAlbumsForUI(albums));
      } catch (err) {
        setError('Failed to load albums');
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  const hasImage = artist.image && artist.image !== '';

  return (
    <div
      ref={cardRef}
      style={{
        flexShrink: 0,
        width: expanded ? 260 : 156,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        overflow: 'hidden',
        transition: 'width 250ms ease, border-color 180ms ease',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
    >
      {/* Artist image */}
      <div style={{
        width: '100%',
        aspectRatio: '1',
        background: hasImage
          ? 'var(--color-surface2)'
          : `repeating-linear-gradient(-45deg, var(--color-surface2), var(--color-surface2) 4px, var(--color-surface) 4px, var(--color-surface) 12px)`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {hasImage ? (
          <img
            src={artist.image}
            alt={artist.artist}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <svg width="40" height="40" fill="none" stroke="var(--color-border2)" strokeWidth="1.25" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 11px' }}>
        <h4
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 2
          }}
          title={artist.artist}
        >
          {artist.artist}
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{
            fontSize: 10,
            color: 'var(--color-amber)',
            letterSpacing: '0.05em',
            fontWeight: 500
          }}>
            {artist.score}% match
          </span>
          {artist.connections && artist.connections.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--color-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              · {artist.connectionCount === 1
                ? `similar to ${artist.connections[0].sourceArtist}`
                : `${artist.connectionCount} connections`}
            </span>
          )}
        </div>

        {artist.mbid && (
          <button
            onClick={handleToggleExpand}
            style={{
              width: '100%',
              padding: '5px 0',
              fontSize: 11,
              color: expanded ? 'var(--color-amber)' : 'var(--color-text-muted)',
              background: 'var(--color-surface2)',
              border: '1px solid var(--color-border)',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              transition: 'color 140ms, border-color 140ms'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-border2)';
              e.currentTarget.style.color = 'var(--color-text)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = expanded ? 'var(--color-amber)' : 'var(--color-text-muted)';
            }}
          >
            <svg
              width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transition: 'transform 200ms', transform: expanded ? 'rotate(180deg)' : 'none' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? 'Hide albums' : 'Top albums'}
          </button>
        )}

        {/* Expanded albums */}
        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                <div style={{
                  width: 14, height: 14,
                  border: '2px solid var(--color-border2)',
                  borderTopColor: 'var(--color-amber)',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
              </div>
            )}

            {error && (
              <p style={{ fontSize: 11, color: '#e0706a', textAlign: 'center' }}>{error}</p>
            )}

            {!loading && !error && (!topAlbums || topAlbums.length === 0) && (
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center' }}>No album data</p>
            )}

            {!loading && !error && topAlbums && topAlbums.length > 0 && (
              <TopAlbumsList albums={topAlbums} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const TopAlbumsList = ({ albums }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-dim)', marginBottom: 4 }}>
      Top Albums
    </div>
    {albums.map((album, index) => (
      <div
        key={`${album.mbid || album.name}-${index}`}
        style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}
      >
        <span style={{ fontSize: 10, color: 'var(--color-amber)', flexShrink: 0, width: 14, textAlign: 'right' }}>
          {album.rank}.
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={album.name}>
            {album.name}
          </p>
          {album.displaySubtitle && (
            <p style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{album.displaySubtitle}</p>
          )}
        </div>
      </div>
    ))}
  </div>
);

export default ArtistCarousel;
