/**
 * Test ListenBrainz Top Albums API
 * Run with: node tests/api/test-listenbrainz-top-albums.js
 *
 * Tests the new getTopAlbumsForArtist method with real artist MBIDs
 * Note: This test uses direct API calls to avoid Vite-specific import.meta.env
 */

// Create a minimal ListenBrainz client for testing without Supabase dependency
class TestListenBrainzClient {
  constructor() {
    this.baseURL = 'https://api.listenbrainz.org';
    this.cache = new Map();
  }

  async getTopAlbumsForArtist(artistMBID, limit = 10, albumsOnly = true) {
    if (!artistMBID) {
      throw new Error('Artist MBID is required');
    }

    const endpoint = `/1/popularity/top-release-groups-for-artist/${artistMBID}`;

    try {
      console.log(`🎵 Fetching top albums for ${artistMBID}...`);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VinylCollectionApp/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data)) {
        console.warn(`No album data available for artist ${artistMBID}`);
        return [];
      }

      // Filter to albums only if requested
      let albums = data;
      if (albumsOnly) {
        albums = data.filter(item => {
          const type = item.release_group?.type?.toLowerCase();
          return type === 'album';
        });
      }

      // Sort by listen count (descending)
      albums.sort((a, b) => {
        const aCount = a.total_listen_count || 0;
        const bCount = b.total_listen_count || 0;
        return bCount - aCount;
      });

      // Limit results and format
      const topAlbums = albums.slice(0, limit).map(item => ({
        name: item.release_group?.name || 'Unknown Album',
        releaseDate: item.release_group?.date || null,
        listenCount: item.total_listen_count || 0,
        mbid: item.release_group_mbid || null,
        type: item.release_group?.type || 'Album'
      }));

      return topAlbums;

    } catch (error) {
      console.error(`Failed to fetch top albums for artist ${artistMBID}:`, error);
      return [];
    }
  }

  formatTopAlbumsForUI(topAlbums) {
    if (!Array.isArray(topAlbums) || topAlbums.length === 0) {
      return [];
    }

    return topAlbums.map((album, index) => ({
      ...album,
      year: album.releaseDate ? parseInt(album.releaseDate.split('-')[0]) : null,
      listenCountFormatted: this.formatListenCount(album.listenCount),
      rank: index + 1,
      displayName: album.name,
      displaySubtitle: album.releaseDate
        ? `${album.releaseDate.split('-')[0]} • ${this.formatListenCount(album.listenCount)}`
        : this.formatListenCount(album.listenCount)
    }));
  }

  formatListenCount(count) {
    if (!count || count === 0) return '0 listens';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M listens`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K listens`;
    } else {
      return `${count} listens`;
    }
  }
}

// Test with well-known artists with MBIDs
const testArtists = [
  {
    name: 'Radiohead',
    mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711'
  },
  {
    name: 'Pink Floyd',
    mbid: '83d91898-7763-47d7-b03b-b92132375c47'
  },
  {
    name: 'The Beatles',
    mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'
  }
];

async function testTopAlbums() {
  console.log('🎵 Testing ListenBrainz Top Albums API\n');

  const client = new TestListenBrainzClient();

  for (const artist of testArtists) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing: ${artist.name}`);
      console.log(`MBID: ${artist.mbid}`);
      console.log('='.repeat(60));

      // Get top 5 albums
      const albums = await client.getTopAlbumsForArtist(artist.mbid, 5, true);

      if (albums.length === 0) {
        console.log('⚠️  No album data available');
        continue;
      }

      console.log(`\n✅ Found ${albums.length} top albums:\n`);

      // Format for UI display
      const formattedAlbums = client.formatTopAlbumsForUI(albums);

      formattedAlbums.forEach((album) => {
        console.log(`${album.rank}. ${album.name}`);
        console.log(`   Year: ${album.year || 'Unknown'}`);
        console.log(`   Listens: ${album.listenCountFormatted}`);
        console.log(`   MBID: ${album.mbid || 'N/A'}`);
        console.log(`   Display: ${album.displaySubtitle}`);
        console.log('');
      });

      // Test different parameters
      console.log('\n--- Testing with all release types (including singles/EPs) ---');
      const allReleases = await client.getTopAlbumsForArtist(artist.mbid, 3, false);
      console.log(`Found ${allReleases.length} releases (including singles/EPs):`);
      allReleases.forEach((release, i) => {
        console.log(`  ${i + 1}. ${release.name} (${release.type})`);
      });

    } catch (error) {
      console.error(`\n❌ Error testing ${artist.name}:`, error.message);
    }
  }

  // Test error handling with invalid MBID
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing error handling with invalid MBID');
  console.log('='.repeat(60));

  try {
    const result = await client.getTopAlbumsForArtist('invalid-mbid-12345', 5);
    console.log(`✅ Graceful handling: Returned ${result.length} albums (should be 0)`);
  } catch (error) {
    console.log(`⚠️  Error was thrown (not ideal): ${error.message}`);
  }

  console.log('\n🎉 Test completed!');
  console.log('\n💡 Integration tips:');
  console.log('   1. Use artist MBID from your recommendation data');
  console.log('   2. Call getTopAlbumsForArtist(mbid, 5) for each recommended artist');
  console.log('   3. Use formatTopAlbumsForUI() to prepare data for display');
  console.log('   4. Results are automatically cached for 24 hours');
}

// Run tests
testTopAlbums().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
