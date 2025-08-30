import { useState, useEffect, useMemo } from 'react'
import AlbumForm from './components/AlbumForm'
import AlbumCard from './components/AlbumCard'
import SearchBar from './components/SearchBar'
import CameraCapture from './components/CameraCapture'
import SimpleCameraCapture from './components/SimpleCameraCapture'
import IdentificationLoader from './components/IdentificationLoader'
import IdentificationResults from './components/IdentificationResults'
import AuthModal from './components/AuthModal'
import { AlbumIdentifier } from './services/albumIdentifier'
import { ImageProcessor } from './utils/imageProcessing'
import { initDatabase, getAllAlbums, addAlbum, updateAlbum, deleteAlbum, saveAlbumImage, exportData, importData } from './services/database'
import { createNewAlbum } from './models/Album'
import { supabase } from './services/supabase'
import SupabaseDatabase from './services/supabaseDatabase'

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
  const [showCamera, setShowCamera] = useState(false)
  const [showAlbumSearch, setShowAlbumSearch] = useState(false)
  
  // Authentication state
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [useCloudDatabase, setUseCloudDatabase] = useState(false)
  
  // Album identification state
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [identificationStage, setIdentificationStage] = useState('searching')
  const [identificationProgress, setIdentificationProgress] = useState(0)
  const [identificationResults, setIdentificationResults] = useState(null)
  const [identifyingImage, setIdentifyingImage] = useState(null)
  const [showIdentificationResults, setShowIdentificationResults] = useState(false)

  // Authentication effect - check for existing session
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth session error:', error)
        } else if (session?.user) {
          console.log('User already logged in:', session.user.email)
          setUser(session.user)
          setUseCloudDatabase(true)
        } else {
          console.log('No active session - using local database')
          setUseCloudDatabase(false)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setAuthLoading(false)
      }
    }

    initAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        setUseCloudDatabase(true)
        setShowAuth(false)
        // Reload albums from cloud database
        loadAlbums(true)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUseCloudDatabase(false)
        // Reload albums from local database
        loadAlbums(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Initialize database and load albums
  useEffect(() => {
    if (!authLoading) {
      loadAlbums(useCloudDatabase)
    }
  }, [authLoading, useCloudDatabase])

  const loadAlbums = async (useCloud = false) => {
    try {
      setLoading(true)
      setError(null)
      
      let storedAlbums = []
      
      if (useCloud && user) {
        console.log('Loading albums from Supabase...')
        storedAlbums = await SupabaseDatabase.getAllAlbums()
      } else {
        console.log('Loading albums from local IndexedDB...')
        await initDatabase()
        storedAlbums = await getAllAlbums()
      }
      
      setAlbums(storedAlbums)
      console.log(`Loaded ${storedAlbums.length} albums from ${useCloud ? 'cloud' : 'local'} database`)
    } catch (err) {
      console.error('Failed to load albums:', err)
      setError(`Failed to load your vinyl collection. ${useCloud ? 'Cloud database error.' : 'Local database error.'} Please refresh the page.`)
    } finally {
      setLoading(false)
    }
  }

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
  const handleFindByName = () => {
    setShowAlbumSearch(true);
  };

  const handleAddManually = () => {
    setShowAddForm(true);
  };

  const handleCameraClick = () => {
    setShowCamera(true);
  };

  const handleCameraClose = () => {
    setShowCamera(false);
  };

  const handleIdentifyAlbum = async (imageData) => {
    try {
      console.log('Starting album identification with mobile proxy support...');
      setShowCamera(false);
      
      // Test environment variable first
      const apiKey = import.meta.env.VITE_SERPAPI_KEY;
      if (!apiKey) {
        console.error('SerpAPI key not found');
        openManualFormWithError('SerpAPI key not configured', imageData);
        return;
      }
      
      // Show identification progress UI
      setIsIdentifying(true);
      setIdentificationStage('initializing');
      setIdentificationProgress(10);
      setIdentifyingImage(imageData);
      
      try {
        // Step 1: Initialize SerpAPI client with mobile proxy support
        setIdentificationStage('initializing');
        const { SerpApiClient } = await import('./services/serpApiClient.js');
        const serpClient = new SerpApiClient(apiKey);
        
        const debugInfo = serpClient.getDebugInfo();
        console.log('SerpAPI Client Debug Info:', debugInfo);
        
        setIdentificationProgress(20);
        
        // Step 2: Process image for optimal API results
        setIdentificationStage('processing');
        const { ImageProcessor } = await import('./utils/imageProcessing.js');
        
        let processedImage;
        try {
          processedImage = await ImageProcessor.optimizeForAPI(imageData);
          console.log('Image processed successfully');
        } catch (processingError) {
          console.warn('Image processing failed, using original:', processingError);
          processedImage = imageData; // Fallback to original
        }
        
        setIdentificationProgress(40);
        
        // Step 3: Perform album identification with timeout
        setIdentificationStage('searching');
        const identificationTimeout = 30000; // 30 seconds timeout
        
        const identificationPromise = serpClient.identifyAlbum(processedImage);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Identification timeout - taking too long')), identificationTimeout)
        );
        
        const result = await Promise.race([identificationPromise, timeoutPromise]);
        
        setIdentificationProgress(80);
        
        if (result.success && result.candidates && result.candidates.length > 0) {
          // Success! Show results
          console.log('Album identification successful:', result);
          setIdentificationStage('complete');
          setIdentificationProgress(100);
          setIdentificationResults(result);
          
          // Wait a moment to show completion, then open form
          setTimeout(() => {
            const topResult = result.candidates[0];
            const albumData = {
              title: topResult.title || 'Unknown Title',
              artist: topResult.artist || 'Unknown Artist',
              year: topResult.year || null,
              coverImage: imageData,
              notes: `Identified via SerpAPI (${result.requestMethod}) - Confidence: ${Math.round((topResult.confidence || 0.5) * 100)}%`,
              identificationMethod: 'serpapi-' + result.requestMethod,
              genre: [],
              purchasePrice: null,
              purchaseLocation: ''
            };
            
            setIsIdentifying(false);
            setEditingAlbum(albumData);
            setShowAddForm(true);
          }, 1000);
          
          return;
          
        } else {
          // No results found
          console.warn('No album matches found:', result);
          setIdentificationStage('no-results');
          setIdentificationProgress(100);
          
          setTimeout(() => {
            openManualFormWithMessage('No matches found for this album cover', imageData);
          }, 2000);
          return;
        }
        
      } catch (error) {
        console.error('Album identification error:', error);
        
        // Determine error type and provide appropriate feedback
        let errorMessage = 'Identification failed';
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out - please try again';
        } else if (error.message.includes('CORS') || error.message.includes('Network')) {
          errorMessage = 'Network error - using manual entry';
        } else if (error.type === 'PROXY_ERROR') {
          errorMessage = 'Service temporarily unavailable';
        }
        
        setIdentificationStage('error');
        setTimeout(() => {
          openManualFormWithError(errorMessage, imageData, error);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Critical identification error:', error);
      openManualFormWithError('Identification system error', imageData, error);
    }
  };

  // Helper method to open manual form with error context
  const openManualFormWithError = (message, imageData, error = null) => {
    console.log('Opening manual form due to error:', message);
    setIsIdentifying(false);
    
    const albumWithImage = {
      coverImage: imageData,
      identificationMethod: 'camera-manual',
      genre: [],
      notes: `Automatic identification failed: ${message}`,
      purchasePrice: null,
      purchaseLocation: ''
    };
    setEditingAlbum(albumWithImage);
    setShowAddForm(true);
  };

  // Helper method to open manual form with informational message
  const openManualFormWithMessage = (message, imageData) => {
    console.log('Opening manual form:', message);
    setIsIdentifying(false);
    
    const albumWithImage = {
      coverImage: imageData,
      identificationMethod: 'camera-manual',
      genre: [],
      notes: message,
      purchasePrice: null,
      purchaseLocation: ''
    };
    setEditingAlbum(albumWithImage);
    setShowAddForm(true);
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
        // Don't set title/artist - let user fill these in manually
        coverImage: imageData,
        identificationMethod: 'camera',
        // Set defaults for other fields
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

  const handleCameraIdentify = async (imageData) => {
    try {
      console.log('User chose to identify album with captured photo');
      
      // Close camera
      setShowCamera(false);
      
      // Start identification process using existing file upload logic
      setIsIdentifying(true);
      setIdentificationResults(null);
      setIdentifyingImage(imageData); // Store the captured image
      
      // Process the image for identification
      console.log('Processing captured image...');
      const processedImage = await ImageProcessor.processForIdentification(imageData);
      
      if (!processedImage) {
        throw new Error('Failed to process captured image');
      }
      
      // Start identification using comprehensive album identifier
      console.log('Starting album identification...');
      const { AlbumIdentifier } = await import('./services/albumIdentifier.js');
      
      try {
        const result = await AlbumIdentifier.identifyFromImage(processedImage);
        
        if (result && result.candidates && result.candidates.length > 0) {
          console.log('Identification successful:', result);
          setIdentificationResults(result);
          setShowIdentificationResults(true);
        } else {
          console.log('No albums found in identification');
          // Fallback to manual entry with the captured image
          const albumWithImage = {
            coverImage: imageData,
            identificationMethod: 'camera',
            genre: [],
            notes: 'Album cover captured with camera - identification found no results',
            purchasePrice: null,
            purchaseLocation: ''
          };
          setEditingAlbum(albumWithImage);
          setShowAddForm(true);
        }
      } catch (identError) {
        console.error('Identification failed:', identError);
        // Fallback to manual entry with the captured image
        const albumWithImage = {
          coverImage: imageData,
          identificationMethod: 'camera',
          genre: [],
          notes: 'Album cover captured with camera - identification failed',
          purchasePrice: null,
          purchaseLocation: ''
        };
        setEditingAlbum(albumWithImage);
        setShowAddForm(true);
      }
    } catch (err) {
      console.error('Failed to identify camera capture:', err);
      setError(`Failed to identify album: ${err.message}`);
    } finally {
      setIsIdentifying(false);
    }
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
      // Check if this is editing an existing album in our database
      const isExistingAlbum = editingAlbum && albums.some(album => album.id === editingAlbum.id);
      console.log(isExistingAlbum ? 'Updating existing album:' : 'Saving new album:', albumData);
      
      let savedAlbum;
      
      if (useCloudDatabase && user) {
        // Use Supabase database
        if (isExistingAlbum) {
          savedAlbum = await SupabaseDatabase.updateAlbum(editingAlbum.id, albumData);
        } else {
          savedAlbum = await SupabaseDatabase.addAlbum(albumData);
        }
      } else {
        // Use local IndexedDB
        if (isExistingAlbum) {
          savedAlbum = await updateAlbum(albumData);
        } else {
          savedAlbum = await addAlbum(albumData);
        }
      }
      
      // Update local state
      if (isExistingAlbum) {
        setAlbums(prevAlbums => 
          prevAlbums.map(album => 
            album.id === savedAlbum.id ? savedAlbum : album
          )
        );
      } else {
        setAlbums(prevAlbums => [savedAlbum, ...prevAlbums]);
      }
      
      const dbType = useCloudDatabase ? 'cloud' : 'local';
      alert(`Album "${savedAlbum.title}" by ${savedAlbum.artist} ${isExistingAlbum ? 'updated' : 'saved'} successfully to ${dbType} database!`);
      setShowAddForm(false);
      setEditingAlbum(null);
      setError(null); // Clear any previous errors
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
      if (useCloudDatabase && user) {
        // Use Supabase database
        await SupabaseDatabase.deleteAlbum(album.id);
      } else {
        // Use local IndexedDB
        await deleteAlbum(album.id);
      }
      
      // Update local state
      setAlbums(prevAlbums => prevAlbums.filter(a => a.id !== album.id));
      
      const dbType = useCloudDatabase ? 'cloud' : 'local';
      alert(`Album "${album.title}" deleted successfully from ${dbType} database!`);
      setError(null);
    } catch (err) {
      console.error('Failed to delete album:', err);
      alert(`Failed to delete album: ${err.message}`);
    }
  };

  // Authentication handlers
  const handleSignIn = () => {
    setShowAuth(true);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      alert('Signed out successfully!');
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out: ' + error.message);
    }
  };

  const handleAuthSuccess = (user) => {
    console.log('Authentication successful:', user.email);
    setUser(user);
    setShowAuth(false);
  };

  const handleSelectIdentifiedAlbum = async (selectedAlbum) => {
    try {
      console.log('User selected identified album:', selectedAlbum);
      
      // Close identification results
      setShowIdentificationResults(false);
      
      // Prepare album data with the captured image and selected metadata
      const albumWithMetadata = {
        ...selectedAlbum,
        coverImage: identifyingImage, // Use the captured image
        identificationMethod: 'camera-serpapi',
        notes: selectedAlbum.notes || 'Album identified from camera capture',
        // Preserve user-editable fields as empty for user input
        purchasePrice: null,
        purchaseLocation: '',
        // Let user edit condition if they want
        condition: selectedAlbum.condition || 'Near Mint'
      };
      
      // Open the add form with pre-filled data
      setEditingAlbum(albumWithMetadata);
      setShowAddForm(true);
      
      console.log('Opening add form with identified album data');
    } catch (err) {
      console.error('Failed to handle selected album:', err);
      setError(`Failed to process selected album: ${err.message}`);
    }
  };

  const handleCloseIdentificationResults = () => {
    console.log('Closing identification results');
    setShowIdentificationResults(false);
    setIdentificationResults(null);
    setIdentifyingImage(null);
    setIsIdentifying(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Vinyl Companion</h1>
              {/* Database Status Indicator */}
              <div className="flex items-center gap-2">
                {authLoading ? (
                  <span className="text-sm text-gray-500">Loading...</span>
                ) : useCloudDatabase && user ? (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Cloud ({user.email})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Local</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Auth Controls */}
              {!authLoading && (
                <>
                  {user ? (
                    <button
                      onClick={handleSignOut}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-1 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSignIn}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-1 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Sign In</span>
                    </button>
                  )}
                </>
              )}
              
              {/* Main Action Buttons */}
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
                onClick={handleFindByName}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Find by Name</span>
                <span className="sm:hidden">Search</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

        {/* Camera Capture */}
        {showCamera && (
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={handleCameraClose}
            onSaveToAlbum={handleCameraSave}
            onIdentifyAlbum={handleCameraIdentify}
          />
        )}

        {/* Identification Results */}
        {showIdentificationResults && identificationResults && (
          <IdentificationResults
            results={identificationResults}
            onSelectResult={handleSelectIdentifiedAlbum}
            onRetry={() => {
              // Retry identification with the same image
              handleCameraIdentify(identifyingImage);
            }}
            onCancel={handleCloseIdentificationResults}
            originalImage={identifyingImage}
          />
        )}

        {/* Album Search by Name Modal */}
        {showAlbumSearch && (
          <AlbumSearchModal 
            onClose={() => setShowAlbumSearch(false)}
            onSelectAlbum={(album) => {
              setShowAlbumSearch(false);
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

        {/* Authentication Modal */}
        {showAuth && (
          <AuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

      </main>
    </div>
  )
}

// Simple Album Search Modal Component
const AlbumSearchModal = ({ onClose, onSelectAlbum }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      // Use Discogs client directly for album-only search
      const { DiscogsClient } = await import('./services/apiClients.js');
      const results = await DiscogsClient.searchReleases(searchQuery.trim());
      
      // Transform results to include source info
      const transformedResults = results.map(result => ({
        ...result,
        source: 'discogs',
        identificationMethod: 'manual-discogs-search'
      }));
      
      setSearchResults(transformedResults);
    } catch (error) {
      console.error('Album search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Find Album by Name</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Search Input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter album name (e.g., 'Dark Side of the Moon')"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Search Discogs database for vinyl records by album name
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">Searching Discogs...</span>
            </div>
          )}

          {!isSearching && hasSearched && searchResults.length === 0 && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-8v0M7 4h10" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No albums found</h3>
              <p className="text-gray-500">Try a different search term or check spelling</p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Found {searchResults.length} results from Discogs:
              </p>
              {searchResults.map((album, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectAlbum(album)}
                >
                  <div className="flex items-start space-x-4">
                    {album.coverImage && (
                      <img
                        src={album.coverImage}
                        alt={album.title}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{album.title}</h3>
                      <p className="text-gray-600">{album.artist}</p>
                      {album.year && <p className="text-sm text-gray-500">{album.year}</p>}
                      {album.format && <p className="text-sm text-purple-600">Format: {album.format}</p>}
                      {album.label && <p className="text-sm text-gray-500">Label: {album.label}</p>}
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Discogs
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasSearched && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Search for Albums</h3>
              <p className="text-gray-500">Enter an album name to search Discogs database</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              Powered by Discogs - the vinyl marketplace database
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App
