import { useState, useRef, useMemo } from 'react';
import AlbumCard from '../components/AlbumCard';
import SearchBar from '../components/SearchBar';
import TagBackfillModal from '../components/TagBackfillModal';

/**
 * CollectionPage Component
 *
 * Displays user's vinyl collection with search, sort, and quick stats
 */
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
  onDeleteAlbum,
  onQuickAdd,
  stats,
  showStats,
  onToggleStats,
  onUpdateAlbum,
  user,
  authLoading,
  useCloudDatabase
}) => {
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [showTagBackfill, setShowTagBackfill] = useState(false);
  const sortDropdownRef = useRef(null);

  // Extract unique genres from albums
  const availableGenres = useMemo(() => {
    const genreSet = new Set();
    albums.forEach(album => {
      if (album.genre && Array.isArray(album.genre)) {
        album.genre.forEach(g => genreSet.add(g));
      }
    });
    return Array.from(genreSet).sort();
  }, [albums]);

  // Filter albums by selected genres
  const displayedAlbums = useMemo(() => {
    if (selectedGenres.length === 0) {
      return filteredAndSortedAlbums;
    }
    return filteredAndSortedAlbums.filter(album => {
      if (!album.genre || !Array.isArray(album.genre)) return false;
      return album.genre.some(g => selectedGenres.includes(g));
    });
  }, [filteredAndSortedAlbums, selectedGenres]);

  const toggleGenre = (genre) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  return (
    <div className="pb-20">
      {/* Mobile Header - Minimal */}
      <div className="md:hidden mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-400">
            {loading ? '...' : `${filteredAndSortedAlbums.length} albums`}
          </div>
          {/* Database Status Indicator - Mobile */}
          <div className="flex items-center gap-2">
            {authLoading ? (
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            ) : useCloudDatabase && user ? (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="Cloud sync active"></div>
            ) : (
              <div className="w-2 h-2 bg-blue-500 rounded-full" title="Local storage"></div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search..."
            />
          </div>
          <button
            onClick={onToggleStats}
            className="px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title={showStats ? 'Hide Stats' : 'Show Stats'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop Header - Option 4 Style */}
      <div className="hidden md:flex items-center justify-between mb-4 gap-4">
        <h2 className="text-xl font-semibold text-white">
          Your Collection ({loading ? '...' : `${filteredAndSortedAlbums.length} albums`})
        </h2>

        <div className="flex items-center gap-2">
          <div className="w-64">
            <SearchBar
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search your collection..."
            />
          </div>

          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              Sort
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onSortChange('artist', sortBy === 'artist' && sortOrder === 'asc' ? 'desc' : 'asc');
                      setShowSortDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                  >
                    <span>Artist</span>
                    {sortBy === 'artist' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSortChange('title', sortBy === 'title' && sortOrder === 'asc' ? 'desc' : 'asc');
                      setShowSortDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                  >
                    <span>Title</span>
                    {sortBy === 'title' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSortChange('year', sortBy === 'year' && sortOrder === 'asc' ? 'desc' : 'asc');
                      setShowSortDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                  >
                    <span>Year</span>
                    {sortBy === 'year' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSortChange('dateAdded', sortBy === 'dateAdded' && sortOrder === 'asc' ? 'desc' : 'asc');
                      setShowSortDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                  >
                    <span>Date Added</span>
                    {sortBy === 'dateAdded' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onToggleStats}
            className="px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title={showStats ? 'Hide Stats' : 'Show Stats'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>

          {/* Database Status - Desktop */}
          <div className="flex items-center gap-2 ml-2">
            {authLoading ? (
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            ) : useCloudDatabase && user ? (
              <div className="flex items-center gap-2 group cursor-pointer" title={user.email}>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-400">Cloud</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-gray-400">Local</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Genre Filter Buttons with Sort Dropdown */}
      {availableGenres.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-400">Filter:</span>
            <div className="flex-1 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGenres([])}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedGenres.length === 0
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                All Genres
              </button>
              {availableGenres.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedGenres.includes(genre)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="px-3 py-1 text-xs bg-gray-800 border border-gray-600 text-gray-300 rounded-full hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                Sort by {sortBy === 'dateAdded' ? 'Date' : sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
              </button>

              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onSortChange('artist', sortBy === 'artist' && sortOrder === 'asc' ? 'desc' : 'asc');
                        setShowSortDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                    >
                      <span>Artist</span>
                      {sortBy === 'artist' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onSortChange('title', sortBy === 'title' && sortOrder === 'asc' ? 'desc' : 'asc');
                        setShowSortDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                    >
                      <span>Title</span>
                      {sortBy === 'title' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onSortChange('year', sortBy === 'year' && sortOrder === 'asc' ? 'desc' : 'asc');
                        setShowSortDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                    >
                      <span>Year</span>
                      {sortBy === 'year' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onSortChange('dateAdded', sortBy === 'dateAdded' && sortOrder === 'asc' ? 'desc' : 'asc');
                        setShowSortDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex items-center justify-between"
                    >
                      <span>Date Added</span>
                      {sortBy === 'dateAdded' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {stats && selectedGenres.length === 0 && (
        <div className="mb-4 flex gap-2 text-sm text-gray-400">
          <span>
            {stats.totalGenres > 0 && (
              <>Genres: {stats.topGenres.slice(0, 3).map(g => `${g.genre} (${g.count})`).join(' • ')}</>
            )}
          </span>
        </div>
      )}

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Collection Statistics</h3>
            <button
              onClick={() => setShowTagBackfill(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              title="Fetch Last.fm tags for existing albums"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Backfill Genre Tags
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-400">Total Albums</h4>
              <p className="text-2xl font-bold text-white">{stats.totalAlbums}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-400">Total Artists</h4>
              <p className="text-2xl font-bold text-white">{stats.totalArtists}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-400">Genres</h4>
              <p className="text-2xl font-bold text-white">{stats.totalGenres}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-400">Avg Year</h4>
              <p className="text-2xl font-bold text-white">{stats.averageYear}</p>
            </div>
          </div>
        </div>
      )}

      {/* Album Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="text-gray-400 mt-2">Loading your collection...</p>
        </div>
      ) : displayedAlbums.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">
            {searchQuery
              ? 'No albums found matching your search.'
              : selectedGenres.length > 0
              ? `No albums found in ${selectedGenres.join(', ')}.`
              : 'Your collection is empty. Add some albums to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {displayedAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => onAlbumClick(album)}
              onDelete={onDeleteAlbum}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button - Quick Add */}
      <button
        onClick={onQuickAdd}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform hover:scale-110 z-40"
        title="Quick Add Album"
      >
        {/* Vinyl record with plus sign */}
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {/* Outer circle (vinyl) */}
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          {/* Inner circle (label) */}
          <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
          {/* Plus sign */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m-4-4h8" />
        </svg>
      </button>

      {/* Tag Backfill Modal */}
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
