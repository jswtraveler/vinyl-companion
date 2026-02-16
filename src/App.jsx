import { useState, useEffect, useMemo, useRef } from 'react'
import AlbumForm from './components/AlbumForm'
import CameraCapture from './components/CameraCapture'
import IdentificationResults from './components/IdentificationResults'
import AuthModal from './components/AuthModal'
import AIAnalysisModal from './components/AIAnalysisModal'
import AlbumSearchModal from './components/AlbumSearchModal'
import { createNewAlbum } from './models/Album'
import Database from './services/database/index.js'
import { MOOD_CATEGORIES } from './utils/moodUtils'

// Custom hooks
import { useAuthentication, useAlbumCollection, useAlbumIdentification } from './hooks'

// Page components for tab navigation
import CollectionPage from './pages/CollectionPage'
import DiscoverPage from './pages/DiscoverPage'
import AddAlbumPage from './pages/AddAlbumPage'
import BottomTabBar from './components/navigation/BottomTabBar'
import QuickAddModal from './components/QuickAddModal'
import KeepItGoingPanel from './components/KeepItGoingPanel'

function App() {
  // Use custom hooks for cleaner component
  const { user, authLoading, useCloudDatabase, handleSignOut } = useAuthentication()
  const { albums, loading, error, setError, loadAlbums, handleSaveAlbum: saveAlbumToDb, handleDeleteAlbum: deleteAlbumFromDb, handleUpdateAlbum } = useAlbumCollection(useCloudDatabase, authLoading)
  const {
    isIdentifying,
    identificationStage,
    identificationProgress,
    identificationResults,
    identifyingImage,
    showIdentificationResults,
    handleIdentifyAlbum,
    handleCameraIdentify,
    handleCloseIdentificationResults,
    handleSelectIdentifiedAlbum: selectIdentifiedAlbum
  } = useAlbumIdentification()

  // UI state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAlbum, setEditingAlbum] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('artist')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const sortDropdownRef = useRef(null)
  const [showStats, setShowStats] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showAlbumSearch, setShowAlbumSearch] = useState(false)
  const [albumSearchQuery, setAlbumSearchQuery] = useState('')
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  // Tab navigation state
  const [currentTab, setCurrentTab] = useState('collection')
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortDropdown]);

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
    const artistSet = new Set()
    const genreCount = {}
    const formatCount = {}
    const decadeCount = {}
    let totalValue = 0
    let totalYears = 0
    let yearCount = 0

    albums.forEach(album => {
      // Artist statistics
      if (album.artist) {
        artistSet.add(album.artist)
      }

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
        totalYears += album.year
        yearCount++
      }

      // Value calculation
      if (album.purchasePrice) {
        totalValue += album.purchasePrice
      }
    })

    return {
      totalAlbums,
      totalArtists: artistSet.size,
      totalGenres: Object.keys(genreCount).length,
      averageYear: yearCount > 0 ? Math.round(totalYears / yearCount) : 0,
      totalValue,
      averageValue: totalValue / totalAlbums,
      topGenres: Object.entries(genreCount).map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      formats: Object.entries(formatCount).sort((a, b) => b[1] - a[1]),
      decades: Object.entries(decadeCount).sort((a, b) => a[0] - b[0])
    }
  }, [albums])

  // Camera handlers
  const handleCameraClose = () => {
    setShowCamera(false);
  };

  const handleCameraCapture = async (imageData) => {
    console.log('Image captured:', imageData);
  };

  const handleCameraSave = async (imageData) => {
    try {
      console.log('User chose to manually add album with captured photo');

      // Close camera
      setShowCamera(false);

      // Create a partial album object for the form with the captured image
      const albumWithImage = {
        coverImage: imageData,
        identificationMethod: 'camera',
        genre: [],
        notes: 'Album cover captured with camera',
        purchasePrice: null,
        purchaseLocation: ''
      };

      // Open the add form with the captured image pre-loaded
      setEditingAlbum(albumWithImage);
      setShowAddForm(true);

      console.log('Opening add form with captured image');
    } catch (err) {
      console.error('Failed to prepare camera capture for manual entry:', err);
      setError(`Failed to prepare photo for manual entry: ${err.message}`);
    }
  };

  const handleCameraIdentifyWrapper = async (imageData) => {
    try {
      // Close camera
      setShowCamera(false);

      // Use the identification hook
      const result = await handleCameraIdentify(imageData);

      if (!result.success) {
        // Fallback to manual entry with the captured image
        const albumWithImage = {
          coverImage: imageData,
          identificationMethod: 'camera',
          genre: [],
          notes: result.error || 'Album cover captured with camera - identification failed',
          purchasePrice: null,
          purchaseLocation: ''
        };
        setEditingAlbum(albumWithImage);
        setShowAddForm(true);
      }
    } catch (err) {
      console.error('Failed to identify camera capture:', err);
      setError(`Failed to identify album: ${err.message}`);
    }
  };

  // AI Analysis handler
  const handleApplyAIResults = async (analysisResults) => {
    try {
      // Apply AI-suggested mood tags to albums
      const updatedAlbums = [...albums];

      for (const result of analysisResults) {
        const albumIndex = updatedAlbums.findIndex(album => album.id === result.albumId);
        if (albumIndex !== -1) {
          // Add AI suggestions to existing moods (don't replace)
          const existingMoods = updatedAlbums[albumIndex].moods || [];
          const newMoods = [...new Set([...existingMoods, ...result.suggestedMoods])];

          const updatedAlbum = {
            ...updatedAlbums[albumIndex],
            moods: newMoods,
            aiAnalysis: {
              suggestedMoods: result.suggestedMoods,
              reasoning: result.reasoning,
              confidence: result.confidence,
              timestamp: new Date().toISOString()
            }
          };

          // Update in database using unified interface
          await Database.updateAlbum(updatedAlbum.id, updatedAlbum);
        }
      }

      // Reload albums to reflect changes
      await loadAlbums();
      console.log(`Applied AI analysis to ${analysisResults.length} albums`);

    } catch (err) {
      console.error('Failed to apply AI analysis:', err);
      setError('Failed to save AI analysis results. Please try again.');
    }
  };

  // Album CRUD handlers
  const handleSaveAlbum = async (albumData) => {
    try {
      await saveAlbumToDb(albumData, editingAlbum);

      // Success - close the form
      setShowAddForm(false);
      setEditingAlbum(null);
      setError(null);
    } catch (err) {
      console.error('Failed to save album:', err);

      if (err.message.includes('not authenticated')) {
        alert('Please sign in to save albums to the cloud database.');
        setShowAuth(true);
      } else {
        alert(`Failed to save album: ${err.message}`);
      }
      // Don't close the form so user can try again
    }
  };

  const handleDeleteAlbum = async (album) => {
    if (!confirm(`Are you sure you want to delete "${album.title}" by ${album.artist}?`)) {
      return;
    }

    try {
      await deleteAlbumFromDb(album);

      const dbType = useCloudDatabase ? 'cloud' : 'local';
      alert(`Album "${album.title}" deleted successfully from ${dbType} database!`);
      setError(null);
    } catch (err) {
      console.error('Failed to delete album:', err);
      alert(`Failed to delete album: ${err.message}`);
    }
  };

  const handleEditAlbum = (album) => {
    setEditingAlbum(album);
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingAlbum(null);
  };

  const handleSelectIdentifiedAlbumWrapper = async (selectedAlbum) => {
    try {
      const albumWithMetadata = selectIdentifiedAlbum(selectedAlbum);

      // Open the add form with pre-filled data
      setEditingAlbum(albumWithMetadata);
      setShowAddForm(true);

      console.log('Opening add form with identified album data');
    } catch (err) {
      console.error('Failed to handle selected album:', err);
      setError(`Failed to process selected album: ${err.message}`);
    }
  };

  // Tab navigation helpers
  const handleQuickAddSearch = (searchTerm) => {
    console.log('Quick add search:', searchTerm);
    setAlbumSearchQuery(searchTerm);
    setShowAlbumSearch(true);
    setShowQuickAdd(false);
  };

  const handleQuickAddAdvanced = () => {
    setCurrentTab('add');
    setShowQuickAdd(false);
  };

  const handleAddPageFindByName = () => {
    setAlbumSearchQuery('');
    setShowAlbumSearch(true);
  };

  const handleAddPageIdentifyImage = () => {
    setShowCamera(true);
  };

  const handleAddPageManualEntry = () => {
    setShowAddForm(true);
    setEditingAlbum(null);
  };

  const toggleStats = () => {
    setShowStats(!showStats);
  };

  const handleSignIn = () => {
    setShowAuth(true);
  };

  const handleAuthSuccess = (user) => {
    console.log('Authentication successful:', user.email);
    setShowAuth(false);
  };

  // Render the appropriate page based on current tab
  // Keep all tabs mounted but hide inactive ones to preserve component state
  const renderPage = () => {
    return (
      <>
        <div style={{ display: currentTab === 'collection' ? 'block' : 'none' }}>
          <CollectionPage
            albums={albums}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={(e) => setSearchQuery(e.target.value)}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(newSortBy, newSortOrder) => {
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            filteredAndSortedAlbums={filteredAndSortedAlbums}
            onAlbumClick={handleEditAlbum}
            onDeleteAlbum={handleDeleteAlbum}
            onQuickAdd={() => setShowQuickAdd(true)}
            stats={stats}
            showStats={showStats}
            onToggleStats={toggleStats}
            onUpdateAlbum={handleUpdateAlbum}
            user={user}
            authLoading={authLoading}
            useCloudDatabase={useCloudDatabase}
            onSignIn={handleSignIn}
            onOpenAIAnalysis={() => setShowAIAnalysis(true)}
          />
        </div>

        <div style={{ display: currentTab === 'discover' ? 'block' : 'none' }}>
          <DiscoverPage
            albums={albums}
            user={user}
            useCloudDatabase={useCloudDatabase}
          />
        </div>

        <div style={{ display: currentTab === 'add' ? 'block' : 'none' }}>
          <AddAlbumPage
            onFindByName={handleAddPageFindByName}
            onIdentifyImage={handleAddPageIdentifyImage}
            onManualEntry={handleAddPageManualEntry}
          />
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Minimal header - only shown on non-collection pages or as fallback */}
      {currentTab !== 'collection' && (
        <header className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* App name on desktop, hidden on mobile */}
              <div className="hidden md:block">
                <h1 className="text-lg font-semibold text-white">Vinyl Companion</h1>
              </div>

              {/* Database Status - compact */}
              <div className="flex items-center gap-2 ml-auto">
                {authLoading ? (
                  <span className="text-xs text-gray-400">Loading...</span>
                ) : useCloudDatabase && user ? (
                  <div className="flex items-center gap-2 group cursor-pointer" title={user.email}>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-400 hidden md:inline">Cloud</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => {
                      console.log('Local indicator clicked, opening auth modal');
                      setShowAuth(true);
                    }}
                    title="Click to sign in"
                  >
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-400 hidden md:inline">Local</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

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

        {/* Tab-based page rendering */}
        {renderPage()}

        {/* Modals and Overlays - remain global */}

        {/* Quick Add Modal */}
        <QuickAddModal
          isOpen={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          onSearch={handleQuickAddSearch}
          onAdvanced={handleQuickAddAdvanced}
        />

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
              backgroundColor: '#1f2937',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              {editingAlbum && (
                <KeepItGoingPanel
                  targetAlbum={editingAlbum}
                  allAlbums={albums}
                  onSelectAlbum={(album) => setEditingAlbum(album)}
                />
              )}
              <AlbumForm
                album={editingAlbum}
                mode={editingAlbum ? 'edit' : 'add'}
                onSave={handleSaveAlbum}
                onCancel={handleCancelForm}
              />
            </div>
          </div>
        )}

        {/* Camera Capture */}
        {showCamera && (
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={handleCameraClose}
            onSaveToAlbum={handleCameraSave}
            onIdentifyAlbum={handleCameraIdentifyWrapper}
          />
        )}

        {/* Identification Results */}
        {showIdentificationResults && identificationResults && (
          <IdentificationResults
            results={identificationResults}
            onSelectResult={handleSelectIdentifiedAlbumWrapper}
            onRetry={() => {
              // Retry identification with the same image
              handleCameraIdentifyWrapper(identifyingImage);
            }}
            onCancel={handleCloseIdentificationResults}
            originalImage={identifyingImage}
          />
        )}

        {/* Album Search by Name Modal */}
        {showAlbumSearch && (
          <AlbumSearchModal
            onClose={() => {
              setShowAlbumSearch(false);
              setAlbumSearchQuery('');
            }}
            initialSearchQuery={albumSearchQuery}
            onSelectAlbum={(album) => {
              setShowAlbumSearch(false);
              setAlbumSearchQuery('');
              // Convert search result to new album format (remove external ID)
              const newAlbum = createNewAlbum({
                title: album.title,
                artist: album.artist,
                year: album.year,
                format: album.format,
                genre: album.genre,
                label: album.label,
                catalogNumber: album.catalogNumber,
                coverImage: album.coverImage,
                country: album.country,
                identificationMethod: 'discogs-search',
                metadata: {
                  discogsId: album.id
                }
              });
              setEditingAlbum(newAlbum);
              setShowAddForm(true);
            }}
          />
        )}

        {/* AI Analysis Modal */}
        {showAIAnalysis && (
          <AIAnalysisModal
            albums={albums}
            availableMoods={MOOD_CATEGORIES}
            onClose={() => setShowAIAnalysis(false)}
            onApplyResults={handleApplyAIResults}
          />
        )}

        {/* Authentication Modal */}
        {showAuth && (
          <AuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

      </main>

      {/* Bottom Tab Navigation */}
      <BottomTabBar
        currentTab={currentTab}
        onNavigate={setCurrentTab}
      />
    </div>
  )
}


export default App
