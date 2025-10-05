import { useState, useEffect, useMemo, useRef } from 'react'
import AlbumForm from './components/AlbumForm'
import AlbumCard from './components/AlbumCard'
import SearchBar from './components/SearchBar'
import CameraCapture from './components/CameraCapture'
import SimpleCameraCapture from './components/SimpleCameraCapture'
import IdentificationLoader from './components/IdentificationLoader'
import IdentificationResults from './components/IdentificationResults'
import AuthModal from './components/AuthModal'
import SuggestionsSection from './components/SuggestionsSection'
import RecommendationSection from './components/RecommendationSection'
import ArtistRecommendationSection from './components/ArtistRecommendationSection'
import AIAnalysisModal from './components/AIAnalysisModal'
import AlbumSearchModal from './components/AlbumSearchModal'
import { AlbumIdentifier } from './services/albumIdentifier'
import { ImageProcessor } from './utils/imageProcessing'
import { initDatabase, getAllAlbums, addAlbum, updateAlbum, deleteAlbum, saveAlbumImage, exportData, importData } from './services/database'
import { createNewAlbum } from './models/Album'
import { supabase } from './services/supabase'
import SupabaseDatabase from './services/supabaseDatabase'
import { MOOD_CATEGORIES } from './utils/moodUtils'

// New page components for tab navigation
import CollectionPage from './pages/CollectionPage'
import DiscoverPage from './pages/DiscoverPage'
import AddAlbumPage from './pages/AddAlbumPage'
import BottomTabBar from './components/navigation/BottomTabBar'
import QuickAddModal from './components/QuickAddModal'

function App() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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

  // Tab navigation state
  const [currentTab, setCurrentTab] = useState('collection')
  const [showQuickAdd, setShowQuickAdd] = useState(false)

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

  // Handle mobile app lifecycle - reload albums when app becomes visible again
  useEffect(() => {
    let reloadTimeout = null

    const debouncedReload = () => {
      // Debounce to prevent multiple rapid reloads from different events
      if (reloadTimeout) clearTimeout(reloadTimeout)
      reloadTimeout = setTimeout(() => {
        console.log('App became visible - reloading albums...')
        loadAlbums(useCloudDatabase)
      }, 100)
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && !authLoading) {
        debouncedReload()
      }
    }

    const handleFocus = () => {
      if (!authLoading) {
        debouncedReload()
      }
    }

    // Listen for mobile app lifecycle events
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    // iOS Safari specific - handles when user switches back to browser
    window.addEventListener('pageshow', handleFocus)

    return () => {
      if (reloadTimeout) clearTimeout(reloadTimeout)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handleFocus)
    }
  }, [authLoading, useCloudDatabase])

  // Initialize database and load albums
  useEffect(() => {
    if (!authLoading) {
      loadAlbums(useCloudDatabase)
    }
  }, [authLoading, useCloudDatabase])

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

  // Handlers
  const handleFindByName = () => {
    setAlbumSearchQuery('');
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

  const handleAIAnalysis = () => {
    setShowAIAnalysis(true);
  };

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

          // Update in database
          if (useCloudDatabase && user) {
            await SupabaseDatabase.updateAlbum(updatedAlbum.id, updatedAlbum);
          } else {
            await updateAlbum(updatedAlbum);
          }
          
          updatedAlbums[albumIndex] = updatedAlbum;
        }
      }
      
      setAlbums(updatedAlbums);
      console.log(`Applied AI analysis to ${analysisResults.length} albums`);
      
    } catch (err) {
      console.error('Failed to apply AI analysis:', err);
      setError('Failed to save AI analysis results. Please try again.');
    }
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
    setShowSortDropdown(false);
  };

  const toggleSortDirection = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const getSortLabel = (key) => {
    const labels = {
      'dateAdded': 'Date Added',
      'title': 'Album',
      'artist': 'Artist',
      'year': 'Date Released'
    };
    return labels[key] || key;
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
      
      // Success - no popup needed, just close the form
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
            onUpdateAlbum={async (albumId, updates) => {
              await SupabaseDatabase.updateAlbum(albumId, updates);
              await loadAlbums(); // Reload albums to reflect changes
            }}
            user={user}
            authLoading={authLoading}
            useCloudDatabase={useCloudDatabase}
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
                  <div className="flex items-center gap-2">
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
