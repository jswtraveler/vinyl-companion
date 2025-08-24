import { useState, useEffect, useMemo } from 'react'
import AlbumForm from './components/AlbumForm'
import AlbumCard from './components/AlbumCard'
import SearchBar from './components/SearchBar'
// import CameraCapture from './components/CameraCapture'
// import IdentificationWizard from './components/IdentificationWizard'
import { initDatabase, getAllAlbums, addAlbum, updateAlbum, deleteAlbum } from './services/database'

function App() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingAlbum, setEditingAlbum] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('dateAdded')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showStats, setShowStats] = useState(false)

  // Initialize database and load albums on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('Initializing database...')
        await initDatabase()
        
        console.log('Loading albums from database...')
        const storedAlbums = await getAllAlbums()
        setAlbums(storedAlbums)
        
        console.log(`Loaded ${storedAlbums.length} albums from database`)
      } catch (err) {
        console.error('Failed to initialize app:', err)
        setError('Failed to load your vinyl collection. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [])

  // Search and sort functionality
  const filteredAndSortedAlbums = useMemo(() => {
    let filtered = albums

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = albums.filter(album => 
        album.title.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query) ||
        (album.genre && album.genre.some(g => g.toLowerCase().includes(query))) ||
        (album.label && album.label.toLowerCase().includes(query)) ||
        (album.year && album.year.toString().includes(query))
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy]
      let bValue = b[sortBy]

      // Handle special cases
      if (sortBy === 'dateAdded') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      } else if (sortBy === 'title' || sortBy === 'artist') {
        aValue = aValue?.toLowerCase() || ''
        bValue = bValue?.toLowerCase() || ''
      } else if (sortBy === 'year') {
        aValue = aValue || 0
        bValue = bValue || 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [albums, searchQuery, sortBy, sortOrder])

  // Statistics calculation
  const stats = useMemo(() => {
    if (albums.length === 0) return null

    const totalAlbums = albums.length
    const genreCount = {}
    const formatCount = {}
    const decadeCount = {}
    let totalValue = 0

    albums.forEach(album => {
      // Genre statistics
      if (album.genre && Array.isArray(album.genre)) {
        album.genre.forEach(genre => {
          genreCount[genre] = (genreCount[genre] || 0) + 1
        })
      }

      // Format statistics
      if (album.format) {
        formatCount[album.format] = (formatCount[album.format] || 0) + 1
      }

      // Decade statistics
      if (album.year) {
        const decade = Math.floor(album.year / 10) * 10
        decadeCount[decade] = (decadeCount[decade] || 0) + 1
      }

      // Value calculation
      if (album.purchasePrice) {
        totalValue += album.purchasePrice
      }
    })

    return {
      totalAlbums,
      totalValue,
      averageValue: totalValue / totalAlbums,
      topGenres: Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 5),
      formats: Object.entries(formatCount).sort((a, b) => b[1] - a[1]),
      decades: Object.entries(decadeCount).sort((a, b) => a[0] - b[0])
    }
  }, [albums])

  // Handlers
  const handleAddManually = () => {
    setShowAddForm(true);
  };

  const handleCameraClick = () => {
    alert('Camera feature coming soon! Use "Add Manually" for now.');
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const toggleStats = () => {
    setShowStats(!showStats);
  };

  const handleSaveAlbum = async (albumData) => {
    try {
      const isEditing = editingAlbum !== null;
      console.log(isEditing ? 'Updating album:' : 'Saving new album:', albumData);
      
      let savedAlbum;
      if (isEditing) {
        // Update existing album
        savedAlbum = await updateAlbum(albumData);
        // Update local state
        setAlbums(prevAlbums => 
          prevAlbums.map(album => 
            album.id === savedAlbum.id ? savedAlbum : album
          )
        );
      } else {
        // Add new album
        savedAlbum = await addAlbum(albumData);
        // Update local state
        setAlbums(prevAlbums => [savedAlbum, ...prevAlbums]);
      }
      
      alert(`Album "${savedAlbum.title}" by ${savedAlbum.artist} ${isEditing ? 'updated' : 'saved'} successfully!`);
      setShowAddForm(false);
      setEditingAlbum(null);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Failed to save album:', err);
      alert(`Failed to save album: ${err.message}`);
      // Don't close the form so user can try again
    }
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingAlbum(null);
  };

  const handleEditAlbum = (album) => {
    setEditingAlbum(album);
    setShowAddForm(true);
  };

  const handleDeleteAlbum = async (album) => {
    if (!confirm(`Are you sure you want to delete "${album.title}" by ${album.artist}?`)) {
      return;
    }

    try {
      await deleteAlbum(album.id);
      
      // Update local state
      setAlbums(prevAlbums => prevAlbums.filter(a => a.id !== album.id));
      
      alert(`Album "${album.title}" deleted successfully!`);
      setError(null);
    } catch (err) {
      console.error('Failed to delete album:', err);
      alert(`Failed to delete album: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Vinyl Companion</h1>
            <div className="flex gap-3">
              <button
                onClick={handleCameraClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Identify Album</span>
                <span className="sm:hidden">Camera</span>
              </button>
              <button
                onClick={handleAddManually}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">Add Manually</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Collection ({loading ? '...' : `${filteredAndSortedAlbums.length} of ${albums.length}`} albums)
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleStats}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showStats 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Stats
              </button>
            </div>
          </div>

          {/* Search Bar */}
          {albums.length > 0 && (
            <div className="mb-4">
              <SearchBar 
                onSearch={handleSearch} 
                placeholder="Search by title, artist, genre, label, or year..."
              />
            </div>
          )}

          {/* Sort Controls */}
          {albums.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-gray-600">Sort by:</span>
                {[
                  { key: 'dateAdded', label: 'Date Added' },
                  { key: 'title', label: 'Title' },
                  { key: 'artist', label: 'Artist' },
                  { key: 'year', label: 'Year' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleSortChange(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      sortBy === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {label}
                    {sortBy === key && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Statistics Section */}
          {showStats && stats && (
            <div className="mb-6 bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Statistics</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-600">Total Albums</h4>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalAlbums}</p>
                </div>
                
                {stats.totalValue > 0 && (
                  <>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-green-600">Total Value</h4>
                      <p className="text-2xl font-bold text-green-900">${stats.totalValue.toFixed(2)}</p>
                    </div>
                    
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-yellow-600">Average Value</h4>
                      <p className="text-2xl font-bold text-yellow-900">${stats.averageValue.toFixed(2)}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Genres */}
                {stats.topGenres.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 mb-2">Top Genres</h4>
                    <div className="space-y-2">
                      {stats.topGenres.map(([genre, count]) => (
                        <div key={genre} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{genre}</span>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formats */}
                {stats.formats.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 mb-2">Formats</h4>
                    <div className="space-y-2">
                      {stats.formats.map(([format, count]) => (
                        <div key={format} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{format}</span>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decades */}
                {stats.decades.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 mb-2">By Decade</h4>
                    <div className="space-y-2">
                      {stats.decades.map(([decade, count]) => (
                        <div key={decade} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{decade}s</span>
                          <span className="text-sm font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <div className="mb-4 text-sm text-gray-600">
              {filteredAndSortedAlbums.length === 0 ? (
                <>No albums found for "{searchQuery}"</>
              ) : filteredAndSortedAlbums.length < albums.length ? (
                <>Showing {filteredAndSortedAlbums.length} of {albums.length} albums for "{searchQuery}"</>
              ) : null}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading your vinyl collection...</p>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No albums yet</h3>
            <p className="text-gray-500 mb-6">Start building your collection by adding your first vinyl record!</p>
            <p className="text-gray-500">Use the "Add Manually" button in the header above to add your first album.</p>
          </div>
        ) : filteredAndSortedAlbums.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No albums found</h3>
            <p className="text-gray-500 mb-4">No albums match your search criteria.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedAlbums.map((album) => (
              <AlbumCard 
                key={album.id} 
                album={album} 
                onEdit={handleEditAlbum}
                onDelete={handleDeleteAlbum}
              />
            ))}
          </div>
        )}

        {showAddForm && (
          <div style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <h2 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '16px'}}>
                {editingAlbum ? 'Edit Album' : 'Add Album Manually'}
              </h2>
              <AlbumForm
                album={editingAlbum}
                mode={editingAlbum ? 'edit' : 'add'}
                onSave={handleSaveAlbum}
                onCancel={handleCancelForm}
              />
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default App
