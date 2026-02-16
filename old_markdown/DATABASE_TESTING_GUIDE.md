# Testing Guide: Unified Database Interface

This guide covers testing the unified database interface to ensure it works correctly in all scenarios.

## Testing Approaches

### 1. Manual Testing (Recommended First)
Test the app manually to verify basic functionality.

### 2. Browser Console Testing
Use browser DevTools console for quick verification.

### 3. Automated Unit Tests
Create test files for comprehensive coverage.

---

## 1. Manual Testing

### Test 1: Guest User - IndexedDB Provider

**Scenario**: Test that guest users use IndexedDB

**Steps**:
1. Open the app in your browser
2. **DO NOT sign in** - stay as guest
3. Open browser DevTools (F12) → Console tab
4. Look for logs showing provider selection:
   - Should see: `"Loading albums from indexeddb (local)..."`
5. Add a test album:
   - Click "Add Album"
   - Fill in some test data
   - Save
6. Refresh the page
7. Verify the album persists (stored in IndexedDB)

**Expected Result**:
- Console shows "indexeddb" provider
- Albums persist across page refreshes
- No authentication required

---

### Test 2: Authenticated User - Supabase Provider

**Scenario**: Test that authenticated users use Supabase

**Steps**:
1. Sign in to your account
2. Open browser DevTools → Console tab
3. Look for logs showing provider selection:
   - Should see: `"Loading albums from supabase (cloud)..."`
4. Add a test album
5. Sign out
6. Sign back in
7. Verify the album persists (stored in Supabase cloud)

**Expected Result**:
- Console shows "supabase" provider when signed in
- Albums persist in cloud across devices
- Albums available after sign out and sign in

---

### Test 3: Provider Switching

**Scenario**: Test that provider switches when authentication changes

**Steps**:
1. Start as guest user
2. Add an album as guest (stored in IndexedDB)
3. Note the album count
4. Sign in
5. Observe provider switch in console logs
6. Note that you may now see different albums (from Supabase)
7. Sign out
8. Verify you see guest albums again (from IndexedDB)

**Expected Result**:
- Provider automatically switches on auth changes
- Guest albums stored locally, user albums stored in cloud
- Each storage is independent (no automatic sync)

---

## 2. Browser Console Testing

### Test Console Commands

Open your browser console and run these commands to test the interface directly:

#### Check Current Provider
```javascript
const providerInfo = await Database.getProviderInfo();
console.log('Provider:', providerInfo.name);
console.log('Is Cloud:', providerInfo.isCloud);
```

**Expected Output** (guest):
```
Provider: indexeddb
Is Cloud: false
```

**Expected Output** (authenticated):
```
Provider: supabase
Is Cloud: true
```

---

#### Test CRUD Operations

**Get All Albums:**
```javascript
const albums = await Database.getAllAlbums();
console.log(`Found ${albums.length} albums:`, albums);
```

**Add Test Album:**
```javascript
const testAlbum = {
  title: 'Test Album',
  artist: 'Test Artist',
  year: 2024,
  genre: ['Rock'],
  format: 'LP'
};
const saved = await Database.addAlbum(testAlbum);
console.log('Saved album:', saved);
```

**Update Album:**
```javascript
// First, get an album ID from your collection
const albums = await Database.getAllAlbums();
const albumId = albums[0]?.id;

if (albumId) {
  const updated = await Database.updateAlbum(albumId, {
    ...albums[0],
    notes: 'Updated via console test'
  });
  console.log('Updated album:', updated);
}
```

**Delete Album:**
```javascript
// Get test album
const albums = await Database.getAllAlbums();
const testAlbum = albums.find(a => a.title === 'Test Album');

if (testAlbum) {
  await Database.deleteAlbum(testAlbum.id);
  console.log('Deleted test album');
}
```

**Check Album Exists:**
```javascript
const exists = await Database.checkAlbumExists('Test Artist', 'Test Album');
console.log('Album exists:', exists);
```

---

#### Test Cache Operations

**Set Cache Item:**
```javascript
await Database.setCacheItem('test-key', { data: 'test value' });
console.log('Cache item set');
```

**Get Cache Item:**
```javascript
const cached = await Database.getCacheItem('test-key');
console.log('Cached data:', cached);
```

---

#### Test Statistics

**Get Collection Stats:**
```javascript
const stats = await Database.getCollectionStats();
console.log('Collection stats:', stats);
```

**Expected Output:**
```javascript
{
  total_albums: 42,
  unique_artists: 28,
  oldest_album: 1967,
  newest_album: 2024,
  average_rating: 4.2,
  total_spent: 892.50
}
```

---

#### Test Search Operations

**Search Albums:**
```javascript
const results = await Database.searchAlbums('radiohead');
console.log('Search results:', results);
```

**Get Albums by Artist:**
```javascript
const artistAlbums = await Database.getAlbumsByArtist('Radiohead');
console.log('Artist albums:', artistAlbums);
```

---

## 3. Automated Unit Tests

### Create Test File

Create `src/services/database/__tests__/database.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from '../index.js';

describe('Unified Database Interface', () => {
  beforeEach(async () => {
    // Force use of mock provider for testing
    await Database.setProvider('mock');
    const provider = await Database.getProvider();
    provider.clear(); // Clear any existing test data
  });

  it('should get provider info', async () => {
    const info = await Database.getProviderInfo();
    expect(info.name).toBe('mock');
    expect(info.isCloud).toBe(false);
  });

  it('should add an album', async () => {
    const album = {
      title: 'OK Computer',
      artist: 'Radiohead',
      year: 1997,
      genre: ['Alternative', 'Rock'],
      format: 'LP'
    };

    const saved = await Database.addAlbum(album);

    expect(saved.id).toBeDefined();
    expect(saved.title).toBe('OK Computer');
    expect(saved.artist).toBe('Radiohead');
  });

  it('should get all albums', async () => {
    // Add test albums
    await Database.addAlbum({ title: 'Album 1', artist: 'Artist 1' });
    await Database.addAlbum({ title: 'Album 2', artist: 'Artist 2' });

    const albums = await Database.getAllAlbums();

    expect(albums).toHaveLength(2);
  });

  it('should update an album', async () => {
    const album = await Database.addAlbum({
      title: 'Original Title',
      artist: 'Artist'
    });

    const updated = await Database.updateAlbum(album.id, {
      ...album,
      title: 'Updated Title'
    });

    expect(updated.title).toBe('Updated Title');
  });

  it('should delete an album', async () => {
    const album = await Database.addAlbum({
      title: 'To Delete',
      artist: 'Artist'
    });

    await Database.deleteAlbum(album.id);

    const albums = await Database.getAllAlbums();
    expect(albums).toHaveLength(0);
  });

  it('should check if album exists', async () => {
    await Database.addAlbum({
      title: 'Kid A',
      artist: 'Radiohead'
    });

    const exists = await Database.checkAlbumExists('Radiohead', 'Kid A');
    const notExists = await Database.checkAlbumExists('Radiohead', 'In Rainbows');

    expect(exists).toBeTruthy();
    expect(notExists).toBeNull();
  });

  it('should search albums', async () => {
    await Database.addAlbum({ title: 'OK Computer', artist: 'Radiohead' });
    await Database.addAlbum({ title: 'Kid A', artist: 'Radiohead' });
    await Database.addAlbum({ title: 'Random Album', artist: 'Other Artist' });

    const results = await Database.searchAlbums('radiohead');

    expect(results).toHaveLength(2);
  });

  it('should get albums by artist', async () => {
    await Database.addAlbum({ title: 'Album 1', artist: 'Radiohead' });
    await Database.addAlbum({ title: 'Album 2', artist: 'Radiohead' });
    await Database.addAlbum({ title: 'Album 3', artist: 'The National' });

    const radioheadAlbums = await Database.getAlbumsByArtist('Radiohead');

    expect(radioheadAlbums).toHaveLength(2);
  });

  it('should get collection stats', async () => {
    await Database.addAlbum({
      title: 'Album 1',
      artist: 'Artist 1',
      year: 2020,
      rating: 5,
      purchasePrice: 25.99
    });
    await Database.addAlbum({
      title: 'Album 2',
      artist: 'Artist 2',
      year: 2021,
      rating: 4,
      purchasePrice: 30.00
    });

    const stats = await Database.getCollectionStats();

    expect(stats.total_albums).toBe(2);
    expect(stats.unique_artists).toBe(2);
    expect(stats.oldest_album).toBe(2020);
    expect(stats.newest_album).toBe(2021);
    expect(stats.average_rating).toBe(4.5);
    expect(stats.total_spent).toBe(55.99);
  });

  it('should cache items', async () => {
    const testData = { foo: 'bar', timestamp: Date.now() };

    await Database.setCacheItem('test-key', testData);
    const cached = await Database.getCacheItem('test-key');

    expect(cached).toEqual(testData);
  });
});
```

---

### Run Tests

If you have Vitest set up:

```bash
npm run test
```

Or add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

---

## 4. Integration Testing

### Test Migration Between Providers

**Scenario**: Test migrating data from local to cloud

```javascript
// In browser console:

// 1. Start as guest, add test data
await Database.setProvider('indexeddb');
await Database.addAlbum({ title: 'Local Album', artist: 'Local Artist' });

// 2. Check local data
const localAlbums = await Database.getAllAlbums();
console.log('Local albums:', localAlbums);

// 3. Sign in (this switches to Supabase automatically)
// Then in console:

// 4. Migrate local data to cloud
const result = await Database.migrateToCloud();
console.log('Migration result:', result);

// 5. Verify migration
const cloudAlbums = await Database.getAllAlbums();
console.log('Cloud albums:', cloudAlbums);
```

---

## 5. Error Testing

### Test Error Handling

**Scenario 1: Update non-existent album**
```javascript
try {
  await Database.updateAlbum('fake-id-123', { title: 'Test' });
} catch (error) {
  console.log('Error caught correctly:', error.message);
}
```

**Scenario 2: Delete non-existent album**
```javascript
try {
  await Database.deleteAlbum('fake-id-456');
} catch (error) {
  console.log('Error caught correctly:', error.message);
}
```

**Scenario 3: Invalid data**
```javascript
try {
  await Database.addAlbum({ /* missing required fields */ });
} catch (error) {
  console.log('Error caught correctly:', error.message);
}
```

---

## 6. Verification Checklist

Use this checklist to verify the unified database interface is working:

### Basic Functionality
- [ ] Provider info shows correct provider name
- [ ] Provider info shows correct isCloud value
- [ ] Can add albums
- [ ] Can get all albums
- [ ] Can get single album by ID
- [ ] Can update albums
- [ ] Can delete albums
- [ ] Can check if album exists

### Search & Filter
- [ ] Can search albums by text
- [ ] Can get albums by artist
- [ ] Can filter albums with options

### Statistics
- [ ] Collection stats return correct values
- [ ] Stats update after adding/deleting albums

### Cache Operations
- [ ] Can set cache items
- [ ] Can get cache items
- [ ] Cache persists correctly

### Provider Selection
- [ ] Guest users use IndexedDB
- [ ] Authenticated users use Supabase
- [ ] Provider switches on auth changes
- [ ] Can manually set provider

### Migration
- [ ] Can migrate data to cloud
- [ ] Can migrate data to local
- [ ] Migration counts are correct

### Error Handling
- [ ] Errors are caught and logged
- [ ] Fallback to IndexedDB on auth errors
- [ ] User-friendly error messages

---

## Quick Test Script

Run this in your browser console for a quick overall test:

```javascript
(async () => {
  console.log('=== Database Interface Test ===');

  // 1. Provider Info
  const info = await Database.getProviderInfo();
  console.log('✓ Provider:', info.name, '(cloud:', info.isCloud + ')');

  // 2. Add Album
  const album = await Database.addAlbum({
    title: 'Test Album ' + Date.now(),
    artist: 'Test Artist',
    year: 2024,
    genre: ['Rock'],
    format: 'LP'
  });
  console.log('✓ Added album:', album.id);

  // 3. Get Albums
  const albums = await Database.getAllAlbums();
  console.log('✓ Total albums:', albums.length);

  // 4. Update Album
  const updated = await Database.updateAlbum(album.id, {
    ...album,
    notes: 'Test note'
  });
  console.log('✓ Updated album');

  // 5. Search
  const results = await Database.searchAlbums('Test');
  console.log('✓ Search found:', results.length, 'results');

  // 6. Stats
  const stats = await Database.getCollectionStats();
  console.log('✓ Collection stats:', stats);

  // 7. Cache
  await Database.setCacheItem('test', { data: 'value' });
  const cached = await Database.getCacheItem('test');
  console.log('✓ Cache working:', cached.data === 'value');

  // 8. Delete Album
  await Database.deleteAlbum(album.id);
  console.log('✓ Deleted test album');

  console.log('=== All Tests Passed! ===');
})();
```

Copy and paste this into your browser console to run all basic tests at once.

---

## Troubleshooting

### Issue: "Database is not defined"

**Solution**: The Database object is not exposed globally. You need to:

1. Open browser DevTools
2. Go to Sources tab
3. Find `src/services/database/index.js`
4. Set a breakpoint and inspect `Database`

OR

Add to your App.jsx temporarily:
```javascript
// At top of App.jsx
import Database from './services/database';
window.Database = Database; // Expose for testing
```

Then rebuild and you can use `Database` in console.

---

### Issue: Provider not switching on auth changes

**Check**:
1. Auth state change triggers component re-render
2. `loadAlbums()` is called after auth change
3. Console logs show provider switch

---

### Issue: Albums not persisting

**Check**:
1. Browser allows IndexedDB (not in private mode)
2. Supabase credentials are correct
3. Network tab shows successful requests (for Supabase)
4. Application tab → IndexedDB shows data (for IndexedDB)

---

## Recommended Testing Order

1. **Start Simple**: Run the Quick Test Script in console
2. **Manual Testing**: Test as guest, then as authenticated user
3. **Provider Switching**: Test sign in/out flow
4. **Console Commands**: Test each operation individually
5. **Error Cases**: Try to break things intentionally
6. **Migration**: Test data migration between providers
7. **Automated Tests**: Create test file for CI/CD

---

**Next Steps**: Which testing approach would you like to start with? I recommend starting with the Quick Test Script in your browser console!
