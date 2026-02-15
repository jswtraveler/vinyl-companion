/**
 * Check Supabase cache status
 * Run this to see what data exists in your cache
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCacheStatus() {
  console.log('🔍 Checking Supabase cache status...\n');

  try {
    // Check artist_similarity_cache
    const { data: similarityData, error: simError, count: simCount } = await supabase
      .from('artist_similarity_cache')
      .select('*', { count: 'exact', head: true });

    if (simError) {
      console.error('❌ Error checking similarity cache:', simError);
    } else {
      console.log(`📊 Artist Similarity Cache: ${simCount || 0} entries`);
    }

    // Check artist_metadata_cache
    const { data: metadataData, error: metaError, count: metaCount } = await supabase
      .from('artist_metadata_cache')
      .select('*', { count: 'exact', head: true });

    if (metaError) {
      console.error('❌ Error checking metadata cache:', metaError);
    } else {
      console.log(`📊 Artist Metadata Cache: ${metaCount || 0} entries`);
    }

    // Check user_artist_recs_cache
    const { data: recsData, error: recsError, count: recsCount } = await supabase
      .from('user_artist_recs_cache')
      .select('*', { count: 'exact', head: true });

    if (recsError) {
      console.error('❌ Error checking recommendations cache:', recsError);
    } else {
      console.log(`📊 User Recommendations Cache: ${recsCount || 0} entries`);
    }

    // Sample some similarity data if available
    if (simCount && simCount > 0) {
      console.log('\n📋 Sample similarity data:');
      const { data: samples } = await supabase
        .from('artist_similarity_cache')
        .select('source_artist, target_artist, similarity_score')
        .limit(5);

      samples?.forEach(sample => {
        console.log(`  "${sample.source_artist}" → "${sample.target_artist}" (${Math.round(sample.similarity_score * 100)}%)`);
      });
    }

    // Sample some metadata if available
    if (metaCount && metaCount > 0) {
      console.log('\n📋 Sample metadata:');
      const { data: metaSamples } = await supabase
        .from('artist_metadata_cache')
        .select('artist_name, spotify_image_url, metadata')
        .limit(5);

      metaSamples?.forEach(sample => {
        const genreCount = sample.metadata?.genres?.length || 0;
        const tagCount = sample.metadata?.tags?.length || 0;
        console.log(`  "${sample.artist_name}" - ${genreCount} genres, ${tagCount} tags, ${sample.spotify_image_url ? '✓' : '✗'} image`);
      });
    }

    console.log('\n✅ Cache status check complete');

  } catch (error) {
    console.error('❌ Failed to check cache status:', error);
  }
}

checkCacheStatus();
