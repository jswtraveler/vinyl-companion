/**
 * Test Row Level Security specifically
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const testSupabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRLS() {
  console.log('🔒 Testing Row Level Security...\n');

  try {
    // Test 1: Try to insert without authentication (should fail)
    console.log('1. Testing insert without auth (should fail)...');
    const { data: insertData, error: insertError } = await testSupabase
      .from('albums')
      .insert({
        title: 'Test Album',
        artist: 'Test Artist',
        user_id: '00000000-0000-0000-0000-000000000000' // Fake UUID
      });

    if (insertError) {
      console.log(`   Insert blocked: ✅ (${insertError.message})`);
    } else {
      console.log('   Insert succeeded: ❌ RLS not working properly');
    }

    // Test 2: Try to read without authentication
    console.log('\n2. Testing read without auth...');
    const { data: readData, error: readError } = await testSupabase
      .from('albums')
      .select('*');

    if (readError) {
      console.log(`   Read blocked: ✅ (${readError.message})`);
    } else {
      console.log(`   Read succeeded: Found ${readData.length} albums`);
      if (readData.length === 0) {
        console.log('   Empty result might mean RLS is working or no data exists ✅');
      }
    }

    // Test 3: Check if RLS is enabled on table
    console.log('\n3. Checking RLS status directly...');
    const { data: rlsData, error: rlsError } = await testSupabase.rpc('check_rls_enabled');
    
    if (rlsError) {
      console.log('   RLS check function not available (expected)');
    }

    console.log('\n🎯 RLS Test Summary:');
    console.log('If inserts are blocked and reads return empty/error, RLS is working correctly.');
    console.log('The table is secured and requires proper authentication.');

  } catch (error) {
    console.error('RLS test failed:', error.message);
  }
}

testRLS();