/**
 * Test script for persistent recommendation caching
 * Run with: node tests/integration/test-caching.js
 *
 * This script tests the database schema and caching service functionality
 * without requiring the full app to be running.
 */

import { RecommendationCacheService } from '../../src/services/recommendations/data/CacheManager.js';

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Use service role key for testing to bypass RLS
const SUPABASE_KEY = process.env.VITE_SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

async function testCachingService() {
  console.log('🧪 Testing Persistent Recommendation Caching\n');

  try {
    // Initialize the caching service
    const cacheService = new RecommendationCacheService(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Cache service initialized');

    // Test data (using valid UUIDs)
    const testUserId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID format
    const testArtist = 'Radiohead';
    const testSimilarArtists = [
      { name: 'Thom Yorke', match: 0.9, mbid: '550e8400-e29b-41d4-a716-446655440001' },
      { name: 'Portishead', match: 0.8, mbid: '550e8400-e29b-41d4-a716-446655440002' },
      { name: 'Massive Attack', match: 0.7, mbid: '550e8400-e29b-41d4-a716-446655440003' }
    ];

    const testAlbums = [
      {
        artist: 'Radiohead',
        title: 'OK Computer',
        dateAdded: new Date().toISOString(),
        metadata: { musicbrainz: { artistId: '550e8400-e29b-41d4-a716-446655440010' } }
      },
      {
        artist: 'Pink Floyd',
        title: 'Dark Side of the Moon',
        dateAdded: new Date().toISOString(),
        metadata: { musicbrainz: { artistId: '550e8400-e29b-41d4-a716-446655440011' } }
      }
    ];

    // Test 1: Similar Artists Caching
    console.log('\n📝 Test 1: Similar Artists Caching');

    // Set cache
    const setCacheResult = await cacheService.setSimilarArtistsCache(
      testArtist,
      '550e8400-e29b-41d4-a716-446655440010',
      testSimilarArtists,
      'lastfm'
    );
    console.log(`   Set cache result: ${setCacheResult ? '✅ Success' : '❌ Failed'}`);

    // Get cache
    const getCacheResult = await cacheService.getSimilarArtistsCache(testArtist, 'lastfm');
    if (getCacheResult) {
      console.log(`   Get cache result: ✅ Success (${getCacheResult.similarArtists.length} artists)`);
      console.log(`   Cache metadata: cached=${getCacheResult.metadata.cached}, source=${getCacheResult.metadata.dataSource}`);
    } else {
      console.log('   Get cache result: ❌ Failed or not found');
    }

    // Test 2: Collection Fingerprinting
    console.log('\n📝 Test 2: Collection Fingerprinting');

    const fingerprint1 = cacheService.generateCollectionFingerprint(testAlbums);
    const fingerprint2 = cacheService.generateCollectionFingerprint(testAlbums);
    const fingerprint3 = cacheService.generateCollectionFingerprint([...testAlbums, { artist: 'New Artist', title: 'New Album' }]);

    console.log(`   Same collection fingerprints match: ${fingerprint1 === fingerprint2 ? '✅ Yes' : '❌ No'}`);
    console.log(`   Different collection fingerprints differ: ${fingerprint1 !== fingerprint3 ? '✅ Yes' : '❌ No'}`);
    console.log(`   Fingerprint format: ${fingerprint1} (${typeof fingerprint1})`);

    // Test 3: User Owned Artists Sync
    console.log('\n📝 Test 3: User Owned Artists Sync');

    const syncResult = await cacheService.syncUserOwnedArtists(testUserId, testAlbums);
    console.log(`   Sync owned artists result: ${syncResult ? '✅ Success' : '❌ Failed'}`);

    // Test 4: User Recommendations Cache
    console.log('\n📝 Test 4: User Recommendations Cache');

    const testRecommendations = {
      total: 5,
      lists: {
        topPicks: {
          title: 'Top Picks',
          items: [
            { artist: 'Arcade Fire', title: 'Funeral', score: 95 },
            { artist: 'The National', title: 'Boxer', score: 90 }
          ]
        }
      }
    };

    const collectionFingerprint = cacheService.generateCollectionFingerprint(testAlbums);

    // Set user recommendations cache
    const setRecsResult = await cacheService.setUserRecommendationsCache(
      testUserId,
      collectionFingerprint,
      testRecommendations,
      { duration: 1500, confidence: 0.8, diversity: 0.7 }
    );
    console.log(`   Set recommendations cache result: ${setRecsResult ? '✅ Success' : '❌ Failed'}`);

    // Get user recommendations cache
    const getRecsResult = await cacheService.getUserRecommendationsCache(testUserId, collectionFingerprint);
    if (getRecsResult) {
      console.log(`   Get recommendations cache result: ✅ Success`);
      console.log(`   Recommendations total: ${getRecsResult.recommendations?.total || 0}`);
      console.log(`   Cache metadata: confidence=${getRecsResult.metadata.confidence}, diversity=${getRecsResult.metadata.diversity}`);
    } else {
      console.log('   Get recommendations cache result: ❌ Failed or not found');
    }

    // Test 5: Cache Statistics
    console.log('\n📝 Test 5: Cache Statistics');

    const stats = await cacheService.getCacheStats();
    console.log('   Cache statistics:');
    console.log(`     - Similarity cache entries: ${stats.similarity_cache}`);
    console.log(`     - Metadata cache entries: ${stats.metadata_cache}`);
    console.log(`     - User recommendations: ${stats.user_recommendations}`);

    // Test 6: Cache Invalidation
    console.log('\n📝 Test 6: Cache Invalidation');

    const invalidateResult = await cacheService.invalidateUserRecommendations(testUserId);
    console.log(`   Invalidate user cache result: ${invalidateResult ? '✅ Success' : '❌ Failed'}`);

    // Verify cache is invalidated
    const getInvalidatedResult = await cacheService.getUserRecommendationsCache(testUserId, collectionFingerprint);
    console.log(`   Cache after invalidation: ${getInvalidatedResult ? '❌ Still cached' : '✅ Successfully invalidated'}`);

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', error.stack);

    // Check if it's a connection error
    if (error.message.includes('fetch')) {
      console.log('\n💡 Tip: Make sure your Supabase URL and API key are correctly set in your .env file');
      console.log('   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY should be configured');
    }
  }
}

// Run the test
testCachingService().then(() => {
  console.log('\n✨ Test script finished');
}).catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
});