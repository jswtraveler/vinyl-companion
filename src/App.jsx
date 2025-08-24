import { useState, useEffect } from 'react'
import AlbumForm from './components/AlbumForm'
import AlbumCard from './components/AlbumCard'
// import SearchBar from './components/SearchBar'
// import CameraCapture from './components/CameraCapture'
// import IdentificationWizard from './components/IdentificationWizard'
import { initDatabase, getAllAlbums, addAlbum, searchAlbums } from './services/database'

function App() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  // Handlers
  const handleAddManually = () => {
    setShowAddForm(true);
  };

  const handleCameraClick = () => {
    alert('Camera feature coming soon! Use "Add Manually" for now.');
  };

  const handleSaveAlbum = async (albumData) => {
    try {
      console.log('Saving album to database:', albumData);
      
      // Save to database
      const savedAlbum = await addAlbum(albumData);
      
      // Update local state
      setAlbums(prevAlbums => [savedAlbum, ...prevAlbums]);
      
      alert(`Album "${savedAlbum.title}" by ${savedAlbum.artist} saved successfully!`);
      setShowAddForm(false);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Failed to save album:', err);
      alert(`Failed to save album: ${err.message}`);
      // Don't close the form so user can try again
    }
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Your Collection ({loading ? '...' : albums.length} albums)
          </h2>
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
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
                Add Album Manually
              </h2>
              <AlbumForm
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
