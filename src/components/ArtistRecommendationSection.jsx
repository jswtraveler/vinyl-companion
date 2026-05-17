import { useRecommendations } from '../hooks/useRecommendations.js';
import ArtistMetadataRefreshModal from './ArtistMetadataRefreshModal.jsx';
import SpotifyImageBackfillModal from './SpotifyImageBackfillModal.jsx';
import ArtistCarousel from './ArtistCarousel.jsx';

const ArtistRecommendationSection = ({ albums, user, useCloudDatabase, onActionsReady }) => {
  const {
    recommendations,
    genreRecommendations,
    loading,
    error,
    hasEnoughAlbums,
    recommendationService,
    showMetadataRefreshModal,
    setShowMetadataRefreshModal,
    showSpotifyBackfillModal,
    setShowSpotifyBackfillModal,
    handleMetadataRefreshComplete,
  } = useRecommendations({ albums, user, useCloudDatabase, onActionsReady });

  if (!hasEnoughAlbums) {
    return (
      <div style={{
        padding: '20px 20px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14
      }}>
        <svg width="18" height="18" fill="none" stroke="var(--color-text-dim)" strokeWidth="1.75" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--color-text)', marginBottom: 4 }}>
            Check These Artists Out
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Add at least 5 albums to discover new artists based on your music taste.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, color: 'var(--color-text-muted)' }}>
          <div style={{
            width: 16, height: 16, flexShrink: 0,
            border: '2px solid var(--color-border2)',
            borderTopColor: 'var(--color-amber)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 13 }}>Analyzing your collection…</span>
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 13,
          color: '#e0706a',
          marginBottom: 20,
          padding: '10px 14px',
          background: 'rgba(192,80,74,0.08)',
          border: '1px solid rgba(192,80,74,0.25)',
          borderRadius: 3
        }}>
          {error}
        </div>
      )}

      {recommendations && !loading && (
        <div>
          <ArtistCarousel
            title="Based On Your Collection"
            artists={recommendations.artists}
            showCount={false}
          />

          {Object.entries(genreRecommendations).map(([genre, data]) => (
            <ArtistCarousel
              key={genre}
              title={genre}
              artists={data.artists}
              showCount={true}
              albumCount={data.count}
            />
          ))}

          {recommendations.total === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0' }}>
              No recommendations yet — try adding more albums to improve suggestions.
            </div>
          )}
        </div>
      )}

      <ArtistMetadataRefreshModal
        isOpen={showMetadataRefreshModal}
        onClose={() => setShowMetadataRefreshModal(false)}
        artists={recommendations?.metadata?.allSimilarArtists || recommendations?.artists || []}
        cacheService={recommendationService?.cacheService}
        onRefreshComplete={handleMetadataRefreshComplete}
      />

      <SpotifyImageBackfillModal
        isOpen={showSpotifyBackfillModal}
        onClose={() => setShowSpotifyBackfillModal(false)}
        cacheService={recommendationService?.cacheService}
      />
    </div>
  );
};

export default ArtistRecommendationSection;
