# Unified Database Interface

The unified database interface provides a consistent API for database operations regardless of the underlying storage mechanism (IndexedDB or Supabase).

## 🎯 Overview

This module automatically selects the appropriate database provider based on authentication status:
- **Authenticated users** → Supabase (cloud storage)
- **Guest users** → IndexedDB (local storage)

## 📁 Structure

```
src/services/database/
├── index.js                        # Main interface & factory
├── DatabaseInterface.js            # Abstract interface definition
├── supabaseClient.js              # Supabase configuration
├── providers/
│   ├── IndexedDBProvider.js       # Local storage implementation
│   ├── SupabaseProvider.js        # Cloud storage implementation
│   └── MockProvider.js            # Testing implementation
└── README.md                       # This file
```

## 🚀 Usage

### Basic Operations

```javascript
import Database from './services/database';

// The interface automatically selects the right provider
const albums = await Database.getAllAlbums();
const album = await Database.getAlbum(id);
await Database.addAlbum(albumData);
await Database.updateAlbum(id, albumData);
await Database.deleteAlbum(id);
```

### Provider Information

```javascript
// Check which provider is currently in use
const info = await Database.getProviderInfo();
console.log(info.name); // 'indexeddb' or 'supabase'
console.log(info.isCloud); // true or false
```

### Force Specific Provider

```javascript
// Force use of IndexedDB (for testing or offline mode)
await Database.setProvider('indexeddb');

// Force use of Supabase
await Database.setProvider('supabase');
```

## 📖 API Reference

### Album Operations

#### `getAllAlbums(options)`
Get all albums with optional filtering.

```javascript
// Get all albums
const albums = await Database.getAllAlbums();

// With filters
const filtered = await Database.getAllAlbums({
  artist: 'Radiohead',
  year: 2007,
  genre: 'Rock'
});
```

#### `getAlbum(id)`
Get a single album by ID.

```javascript
const album = await Database.getAlbum('album-123');
```

#### `addAlbum(albumData)`
Add a new album.

```javascript
const newAlbum = await Database.addAlbum({
  title: 'OK Computer',
  artist: 'Radiohead',
  year: 1997,
  genre: ['Alternative', 'Rock'],
  format: 'LP'
});
```

#### `updateAlbum(id, albumData)`
Update an existing album.

```javascript
await Database.updateAlbum('album-123', {
  ...existingAlbum,
  rating: 5,
  notes: 'Updated notes'
});
```

#### `deleteAlbum(id)`
Delete an album.

```javascript
await Database.deleteAlbum('album-123');
```

#### `checkAlbumExists(artist, title)`
Check if an album already exists.

```javascript
const exists = await Database.checkAlbumExists('Radiohead', 'OK Computer');
if (exists) {
  console.log('Album already in collection');
}
```

### Search Operations

#### `searchAlbums(query)`
Search albums by text.

```javascript
const results = await Database.searchAlbums('radiohead');
```

#### `getAlbumsByArtist(artist)`
Get all albums by a specific artist.

```javascript
const radioheadAlbums = await Database.getAlbumsByArtist('Radiohead');
```

### Statistics

#### `getCollectionStats()`
Get collection statistics.

```javascript
const stats = await Database.getCollectionStats();
// Returns: {
//   total_albums: 42,
//   unique_artists: 28,
//   oldest_album: 1967,
//   newest_album: 2024,
//   average_rating: 4.2,
//   total_spent: 892.50
// }
```

### Cache Operations

#### `getCacheItem(key)` / `setCacheItem(key, data)`
Cache operations for API responses.

```javascript
// Set cache
await Database.setCacheItem('lastfm_similar_radiohead', artistData);

// Get cache
const cached = await Database.getCacheItem('lastfm_similar_radiohead');
```

### Image Operations

#### `saveAlbumImage(albumId, imageData)`
Save album cover image.

```javascript
await Database.saveAlbumImage('album-123', base64ImageData);
```

#### `getAlbumImage(albumId)`
Get album cover image.

```javascript
const imageData = await Database.getAlbumImage('album-123');
```

### Data Migration

#### `exportData()`
Export all data.

```javascript
const backup = await Database.exportData();
// Returns: {
//   albums: [...],
//   exportDate: '2025-01-01T00:00:00Z',
//   version: 1,
//   provider: 'indexeddb'
// }
```

#### `importData(data)`
Import data.

```javascript
const count = await Database.importData(backupData);
console.log(`Imported ${count} albums`);
```

#### `migrateToCloud()`
Migrate from IndexedDB to Supabase.

```javascript
const result = await Database.migrateToCloud();
if (result.success) {
  console.log(result.message); // "Successfully migrated 42 albums to cloud storage"
}
```

#### `migrateToLocal()`
Migrate from Supabase to IndexedDB.

```javascript
const result = await Database.migrateToLocal();
if (result.success) {
  console.log(result.message); // "Successfully migrated 42 albums to local storage"
}
```

## 🧪 Testing

### Using MockProvider

```javascript
import { MockProvider } from './services/database/providers/MockProvider';

// Create mock instance
const mockDB = new MockProvider();

// Seed with test data
mockDB.seedTestData(10);

// Use like any other provider
const albums = await mockDB.getAllAlbums();

// Clear for next test
mockDB.clear();
```

### Testing with Database Factory

```javascript
import Database from './services/database';

// Force mock provider
await Database.setProvider('mock');

// Your tests here
const albums = await Database.getAllAlbums();
```

## 🏗️ Architecture

### Provider Pattern

The module uses the Strategy pattern with a factory:

1. **DatabaseInterface** - Abstract interface defining the contract
2. **Providers** - Concrete implementations (IndexedDB, Supabase, Mock)
3. **DatabaseFactory** - Selects and manages providers
4. **Singleton** - Single instance exported as `Database`

### Auto-Detection Logic

```
User loads app
     ↓
Factory checks authentication
     ↓
├─ Authenticated? → SupabaseProvider
└─ Not authenticated? → IndexedDBProvider
```

### Field Mapping

The Supabase provider automatically maps between database and frontend field names:

```javascript
// Database (snake_case) ←→ Frontend (camelCase)
cover_image_url ←→ coverImage
catalog_number ←→ catalogNumber
purchase_price ←→ purchasePrice
created_at ←→ createdAt
```

## 🔧 Adding a New Provider

To add a new storage backend:

1. Create a new provider class extending `DatabaseInterface`:

```javascript
import { DatabaseInterface } from '../DatabaseInterface.js';

export class MyNewProvider extends DatabaseInterface {
  async getAllAlbums(options = {}) {
    // Your implementation
  }

  // Implement all other methods...

  getProviderName() {
    return 'mynewprovider';
  }

  isCloudProvider() {
    return true; // or false
  }
}
```

2. Register it in the factory (`index.js`):

```javascript
import { MyNewProvider } from './providers/MyNewProvider.js';

async setProvider(providerName) {
  if (providerName === 'mynewprovider') {
    if (!this.myNewProvider) {
      this.myNewProvider = new MyNewProvider();
    }
    this.currentProvider = this.myNewProvider;
    return this.myNewProvider;
  }
  // ... existing providers
}
```

## 📝 Migration from Old Code

### Before (manual provider selection)

```javascript
// App.jsx - Old code
if (useCloudDatabase && user) {
  storedAlbums = await SupabaseDatabase.getAllAlbums();
} else {
  await initDatabase();
  storedAlbums = await getAllAlbums();
}
```

### After (unified interface)

```javascript
// App.jsx - New code
import Database from './services/database';

const storedAlbums = await Database.getAllAlbums();
```

The interface handles provider selection automatically!

## 🐛 Troubleshooting

### Issue: "User not authenticated" error

**Cause:** Trying to use Supabase when user is not logged in.

**Solution:** The factory should auto-fallback to IndexedDB. If not, check auth status:

```javascript
const info = await Database.getProviderInfo();
console.log('Current provider:', info.name);
```

### Issue: Data not syncing between providers

**Cause:** Each provider is independent - they don't auto-sync.

**Solution:** Use migration functions to manually sync:

```javascript
// Migrate local to cloud after sign-in
await Database.migrateToCloud();

// Migrate cloud to local before sign-out
await Database.migrateToLocal();
```

### Issue: Mock data persists between tests

**Cause:** Mock provider stores data in memory.

**Solution:** Clear mock data between tests:

```javascript
import { MockProvider } from './services/database/providers/MockProvider';

afterEach(async () => {
  const provider = await Database.getProvider();
  if (provider instanceof MockProvider) {
    provider.clear();
  }
});
```

## 🎓 Best Practices

1. **Always use the unified interface** - Don't import providers directly in components
2. **Handle provider switching** - When auth state changes, reload data
3. **Test with MockProvider** - Use mock provider for unit tests
4. **Migrate on auth changes** - Offer to migrate data when user signs in/out
5. **Check provider info** - Display current provider to user for transparency

## 📚 Related Documentation

- [Database Schema](../../../database/README.md) - SQL schema documentation
- [Supabase Setup](../../../database/schema.sql) - Database structure
- [Authentication Flow](../../supabase.js) - Auth integration

---

**Version:** 1.0
**Last Updated:** October 11, 2025
