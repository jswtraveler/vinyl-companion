# Personal Vinyl Collection App - Claude Code Agent Guide

## Project Overview

Building a Progressive Web App (PWA) for tracking a personal vinyl record collection (~100 records) with automatic album identification using free APIs and services. The app prioritizes quick data entry through image recognition and audio fingerprinting while maintaining zero ongoing costs.

## Core Requirements

### Primary Features
- **Album Identification**: Multiple methods for automatic record identification
  - Reverse image search (Google, Bing, Yandex)
  - Audio fingerprinting via AcoustID/Chromaprint
  - OCR text extraction from album covers
- **Collection Management**: CRUD operations for vinyl records
- **Offline Functionality**: Works without internet connection
- **Mobile-First**: Camera integration for album cover photography
- **Export/Backup**: Data portability and backup capabilities

### Technical Constraints
- **Zero ongoing costs** - use only free APIs and services
- **No paid API dependencies** - work within free tier limitations
- **Personal use scale** - optimized for ~100 records
- **Cross-platform** - accessible from any device with web browser

## Recommended Technology Stack

### Core Architecture
- **Framework**: React with Vite for fast development
- **App Type**: Progressive Web App (PWA)
- **Storage**: IndexedDB for local data persistence
- **Styling**: Tailwind CSS for rapid UI development
- **Deployment**: Netlify or Vercel (free tier)

### Key Dependencies
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "idb": "^7.x",
    "workbox-precaching": "^6.x",
    "workbox-routing": "^6.x",
    "opencv-js": "^4.x",
    "tesseract.js": "^4.x"
  }
}
```

## API Integration Strategy

### Primary Identification Services

#### 1. Google Reverse Image Search (Primary)
- **Service**: `google-reverse-image-api.vercel.app`
- **Rate Limits**: Reasonable for personal use
- **Implementation**: REST API calls with image URLs
- **Expected Accuracy**: 90%+ for clear album covers

```javascript
const identifyAlbum = async (imageUrl) => {
  const response = await fetch('https://google-reverse-image-api.vercel.app/reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl })
  });
  return response.json();
};
```

#### 2. MusicBrainz API (Metadata)
- **Endpoint**: `https://musicbrainz.org/ws/2/`
- **Rate Limit**: 1 request per second
- **Usage**: Album metadata, artist info, release details
- **Authentication**: None required, but set User-Agent

```javascript
const searchMusicBrainz = async (query) => {
  const response = await fetch(
    `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json`,
    { headers: { 'User-Agent': 'VinylCollectionApp/1.0' } }
  );
  return response.json();
};
```

#### 3. Discogs API (Vinyl-Specific)
- **Endpoint**: `https://api.discogs.com/`
- **Rate Limit**: 60 requests/minute (authenticated)
- **Usage**: Vinyl pressing details, catalog numbers, marketplace data
- **Authentication**: Consumer key/secret (free)

#### 4. Cover Art Archive (Images)
- **Endpoint**: `https://coverartarchive.org/`
- **Usage**: High-quality album artwork
- **Integration**: Via MusicBrainz release IDs

### Fallback Services
- **Bing Visual Search**: Alternative reverse image search
- **TheAudioDB**: Additional metadata and images
- **Last.fm API**: Artist information and album details

## Core App Structure

### Component Architecture
```
src/
├── components/
│   ├── AlbumCard.jsx          # Individual album display
│   ├── AlbumForm.jsx          # Add/edit album form
│   ├── CameraCapture.jsx      # Camera integration
│   ├── SearchBar.jsx          # Collection search
│   └── IdentificationWizard.jsx # Multi-step ID process
├── services/
│   ├── albumIdentifier.js     # Image recognition service
│   ├── audioFingerprint.js    # Audio identification
│   ├── apiClients.js          # External API wrappers
│   └── database.js            # IndexedDB operations
├── utils/
│   ├── imageProcessing.js     # OpenCV image enhancement
│   ├── ocrService.js          # Text extraction
│   └── caching.js             # Service worker cache management
└── App.jsx                    # Main application
```

### Data Models

#### Album Record Structure
```javascript
const AlbumSchema = {
  id: 'unique-identifier',
  title: 'Album Title',
  artist: 'Artist Name',
  year: 2023,
  genre: ['Rock', 'Alternative'],
  label: 'Record Label',
  catalogNumber: 'CAT-123',
  format: 'LP', // LP, EP, Single, etc.
  speed: '33 RPM',
  condition: 'Near Mint',
  coverImage: 'base64-or-url',
  tracks: [
    { number: 1, title: 'Track Name', duration: '3:45' }
  ],
  dateAdded: '2024-01-01T00:00:00Z',
  purchasePrice: 25.99,
  purchaseLocation: 'Record Store Name',
  notes: 'Personal notes',
  identificationMethod: 'reverse-image-search',
  metadata: {
    musicbrainzId: 'mb-release-id',
    discogsId: 'discogs-release-id'
  }
};
```

## Implementation Phases

### Phase 1: Foundation (2-3 weeks)
1. **PWA Setup**
   - React + Vite project initialization
   - PWA configuration with web manifest
   - Service Worker for offline capability
   - IndexedDB integration for local storage

2. **Core Features**
   - Basic CRUD operations for albums
   - Collection display and search
   - Camera integration for cover photos
   - Export/import functionality

### Phase 2: Identification (2-3 weeks)
1. **Image Recognition**
   - Google reverse image search integration
   - Image preprocessing with OpenCV.js
   - OCR text extraction with Tesseract.js
   - Results parsing and album matching

2. **API Integration**
   - MusicBrainz metadata fetching
   - Discogs vinyl data integration
   - Cover Art Archive image retrieval
   - Rate limiting and error handling

### Phase 3: Enhancement (1-2 weeks)
1. **Advanced Features**
   - Audio fingerprinting setup
   - Multi-API fallback logic
   - Batch processing capabilities
   - Advanced search and filtering

2. **Polish**
   - UI/UX improvements
   - Performance optimization
   - Comprehensive error handling
   - Documentation and testing

## Key Implementation Details

### Camera Integration
```javascript
const CameraCapture = () => {
  const constraints = {
    video: {
      facingMode: { ideal: "environment" }, // Rear camera
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
  
  // Implementation for capturing album covers
};
```

### Image Processing Pipeline
```javascript
const preprocessAlbumCover = async (imageData) => {
  // 1. Crop to album cover area
  // 2. Enhance contrast and brightness
  // 3. Remove glare and reflections
  // 4. Standardize dimensions
  // 5. Convert to optimal format for API
};
```

### Offline Data Management
```javascript
// IndexedDB schema for offline storage
const dbSchema = {
  albums: 'id, title, artist, year, genre', // Main collection
  cache: 'key, data, timestamp',             // API response cache
  images: 'albumId, imageData',              // Cover art storage
  audio: 'albumId, fingerprint'              // Audio fingerprints
};
```

### Service Worker Strategy
```javascript
// Cache strategy for different content types
const cacheStrategy = {
  appShell: 'cache-first',      // Core app files
  albumData: 'cache-first',     // Collection data
  apiResponses: 'network-first', // Fresh data when online
  images: 'cache-first'         // Album artwork
};
```

## Performance Considerations

### API Rate Limiting
- **MusicBrainz**: 1 request/second - implement request queuing
- **Discogs**: 60 requests/minute - batch operations efficiently
- **Google Search**: Reasonable limits - monitor usage patterns

### Storage Optimization
- **Compress images** to WebP format for storage efficiency
- **Cache API responses** to minimize redundant requests
- **Implement data cleanup** for old cache entries

### Mobile Performance
- **Lazy load images** in collection view
- **Implement virtual scrolling** for large collections
- **Optimize camera capture** resolution and processing

## Development Workflow

### Getting Started
1. Clone/create React + Vite project
2. Configure PWA settings and manifest
3. Set up IndexedDB database schema
4. Implement basic album CRUD operations
5. Add camera capture functionality

### Testing Strategy
- **Unit tests** for utility functions and API clients
- **Integration tests** for identification workflows
- **Manual testing** on various devices and network conditions
- **Offline testing** to ensure PWA functionality

### Deployment
1. Build production bundle with `npm run build`
2. Deploy to Netlify/Vercel with automatic HTTPS
3. Configure PWA settings for installation prompts
4. Test installation and offline functionality

## Common Pitfalls and Solutions

### API Integration Issues
- **Rate limiting**: Implement exponential backoff and request queuing
- **CORS errors**: Use proxy services or direct API endpoints that support CORS
- **Authentication**: Store API keys securely, use environment variables

### PWA Challenges
- **Cache management**: Implement proper cache versioning and cleanup
- **Update mechanisms**: Handle app updates gracefully with user notification
- **Installation prompts**: Ensure proper PWA criteria are met

### Image Recognition Accuracy
- **Preprocessing**: Always enhance images before sending to APIs
- **Fallback methods**: Implement multiple identification strategies
- **Manual override**: Allow users to correct/override automatic identification

## Success Metrics

### Technical Goals
- **70-85% automatic identification accuracy** for clear album covers
- **Sub-2 second response times** for cached collection searches
- **Offline functionality** works for all core features
- **Zero ongoing costs** within free API tier limits

### User Experience Goals
- **Quick album addition** - under 30 seconds per record
- **Reliable offline access** to full collection
- **Cross-device synchronization** via export/import
- **Intuitive mobile interface** for record store use

## Additional Resources

### Documentation Links
- [PWA Guidelines](https://web.dev/progressive-web-apps/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MusicBrainz API Docs](https://musicbrainz.org/doc/MusicBrainz_API)
- [Discogs API Docs](https://www.discogs.com/developers/)

### Libraries and Tools
- [OpenCV.js Documentation](https://docs.opencv.org/4.x/df/d0a/tutorial_js_intro.html)
- [Tesseract.js OCR](https://github.com/naptha/tesseract.js)
- [Workbox PWA Tools](https://developers.google.com/web/tools/workbox)
- [IDB Library](https://github.com/jakearchibald/idb) for IndexedDB wrapper

This guide provides comprehensive direction for building a personal vinyl collection app using free services and modern web technologies, optimized for the Claude Code agent development workflow.