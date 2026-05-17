import { useState, useRef, useEffect } from 'react';
import ArtistRecommendationSection from '../components/ArtistRecommendationSection';

const DiscoverPage = ({ albums, user, useCloudDatabase }) => {
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);
  const [recommendationActions, setRecommendationActions] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };
    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionsMenu]);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>
            Discover
          </h2>
          <p style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
            Artists you might like, based on your collection
          </p>
        </div>

        {albums.length >= 5 && recommendationActions && (
          <div style={{ position: 'relative' }} ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="btn-outline"
              style={{ padding: '7px 10px' }}
              title="Actions"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showActionsMenu && (
              <div className="sort-dropdown" style={{ minWidth: 190 }}>
                <button
                  onClick={() => { recommendationActions.onRefresh(); setShowActionsMenu(false); }}
                  disabled={recommendationActions.loading}
                  className="sort-option"
                >
                  Refresh recommendations
                </button>
                <button
                  onClick={() => { recommendationActions.onFixGenres(); setShowActionsMenu(false); }}
                  disabled={recommendationActions.loading || !recommendationActions.hasRecommendations}
                  className="sort-option"
                >
                  Fix genres
                </button>
                <button
                  onClick={() => { recommendationActions.onGetImages(); setShowActionsMenu(false); }}
                  disabled={recommendationActions.loading}
                  className="sort-option"
                >
                  Get images
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {albums.length > 0 ? (
        <ArtistRecommendationSection
          albums={albums}
          user={user}
          useCloudDatabase={useCloudDatabase}
          onActionsReady={setRecommendationActions}
        />
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '56px 24px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 4
        }}>
          <svg width="48" height="48" fill="none" stroke="var(--color-border2)" strokeWidth="1.25" viewBox="0 0 24 24"
            style={{ margin: '0 auto 16px' }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text)', marginBottom: 8 }}>
            Nothing to discover yet
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Add at least 5 albums to your collection and we'll suggest artists based on your taste.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
