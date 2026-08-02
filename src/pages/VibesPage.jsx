import { useState, useMemo } from 'react';
import { MOOD_PLAYLISTS, getMoodPlaylistById } from '../data/moodPlaylists.js';
import { SESSION_SIZES } from '../data/sessionSizes.js';
import { albumMatchesRule } from '../services/playlists/playlistBuilder.js';
import MoodCard from '../components/vibes/MoodCard.jsx';
import PlaylistView from '../components/vibes/PlaylistView.jsx';
import AlbumDetailModal from '../components/AlbumDetailModal.jsx';

const VibesPage = ({ albums, onOpenAIAnalysis, playlists, onSavePlaylist, onDeletePlaylist }) => {
  const [sessionSizeId, setSessionSizeId] = useState('session');
  const [activeMoodId, setActiveMoodId] = useState(null);
  const [viewingAlbum, setViewingAlbum] = useState(null);
  const [viewingAlbumList, setViewingAlbumList] = useState(null);
  const [openSavedPlaylist, setOpenSavedPlaylist] = useState(null); // { playlist, albums }

  const matchCounts = useMemo(() => {
    const counts = {};
    MOOD_PLAYLISTS.forEach(playlist => {
      counts[playlist.id] = (albums || []).filter(a => albumMatchesRule(a, playlist.match)).length;
    });
    return counts;
  }, [albums]);

  const sessionSize = SESSION_SIZES.find(s => s.id === sessionSizeId) || SESSION_SIZES[1];
  const activeMood = activeMoodId ? getMoodPlaylistById(activeMoodId) : null;

  const handleMoodTap = (playlist) => {
    setActiveMoodId(playlist.id === activeMoodId ? null : playlist.id);
  };

  const handleOpenAlbum = (album, contextList) => {
    setViewingAlbum(album);
    setViewingAlbumList(contextList);
  };

  const handleSave = async ({ mood, albums: playlistAlbums }) => {
    if (!onSavePlaylist) return;
    try {
      await onSavePlaylist({
        name: mood.name,
        moodId: mood.id,
        albumIds: playlistAlbums.map(a => a.id),
        note: ''
      });
    } catch (err) {
      console.error('Failed to save playlist:', err);
    }
  };

  const handleOpenSavedPlaylist = (playlist) => {
    const byId = new Map(albums.map(a => [a.id, a]));
    const resolvedAlbums = (playlist.albumIds || []).map(id => byId.get(id)).filter(Boolean);
    setOpenSavedPlaylist({ playlist, albums: resolvedAlbums });
  };

  if (albums.length < 5) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <VibesHeader />
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
              d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text)', marginBottom: 8 }}>
            Not enough records yet
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Add a few more records and we'll build playlists from your collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <VibesHeader />

      {/* Session-size selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {SESSION_SIZES.map(size => {
          const active = size.id === sessionSizeId;
          return (
            <button
              key={size.id}
              onClick={() => setSessionSizeId(size.id)}
              className="btn-outline"
              style={active ? {
                borderColor: 'var(--color-amber-dim)',
                color: 'var(--color-amber)',
                background: 'var(--color-surface2)'
              } : undefined}
            >
              {size.label}
            </button>
          );
        })}
      </div>

      {/* Mood grid — scrolls independently, session-size row above stays put */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        maxHeight: '60vh',
        overflowY: 'auto',
        paddingBottom: 4,
        marginBottom: 20
      }}>
        {MOOD_PLAYLISTS.map(playlist => (
          <MoodCard
            key={playlist.id}
            playlist={playlist}
            count={matchCounts[playlist.id] || 0}
            onClick={() => handleMoodTap(playlist)}
          />
        ))}
      </div>

      {activeMood && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setActiveMoodId(null); }}
        >
          <div style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <PlaylistView
              mood={activeMood}
              albums={albums}
              sessionSize={sessionSize}
              onClose={() => setActiveMoodId(null)}
              onOpenAlbum={handleOpenAlbum}
              onOpenAIAnalysis={matchCounts[activeMood.id] === 0 ? onOpenAIAnalysis : undefined}
              onSave={onSavePlaylist ? handleSave : undefined}
            />
          </div>
        </div>
      )}

      {/* Saved playlists */}
      {onSavePlaylist && playlists && playlists.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
            Saved Playlists
          </h3>
          {playlists.map(playlist => (
            <div
              key={playlist.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                borderRadius: 4, padding: '10px 12px', marginBottom: 8, cursor: 'pointer'
              }}
              onClick={() => handleOpenSavedPlaylist(playlist)}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{playlist.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                  {(playlist.albumIds || []).length} record{(playlist.albumIds || []).length === 1 ? '' : 's'}
                </div>
              </div>
              {onDeletePlaylist && (
                <button
                  className="btn-outline"
                  style={{ padding: '5px 8px' }}
                  onClick={(e) => { e.stopPropagation(); onDeletePlaylist(playlist.id); }}
                  title="Delete"
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {openSavedPlaylist && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpenSavedPlaylist(null); }}
        >
          <div style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <PlaylistView
              mood={{
                id: openSavedPlaylist.playlist.moodId || 'saved',
                name: openSavedPlaylist.playlist.name,
                emoji: '💿',
                match: getMoodPlaylistById(openSavedPlaylist.playlist.moodId)?.match || {},
                order: 'chronological'
              }}
              albums={openSavedPlaylist.albums}
              sessionSize={{ targetCount: openSavedPlaylist.albums.length, targetMinutes: null }}
              onClose={() => setOpenSavedPlaylist(null)}
              onOpenAlbum={handleOpenAlbum}
            />
          </div>
        </div>
      )}

      {viewingAlbum && (
        <AlbumDetailModal
          album={viewingAlbum}
          allAlbums={viewingAlbumList || albums}
          onClose={() => { setViewingAlbum(null); setViewingAlbumList(null); }}
          onSelectSimilar={(album) => setViewingAlbum(album)}
        />
      )}
    </div>
  );
};

const VibesHeader = () => (
  <div style={{ marginBottom: 20 }}>
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>
      Vibes
    </h2>
    <p style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
      Playlists built from records you own.
    </p>
  </div>
);

export default VibesPage;
