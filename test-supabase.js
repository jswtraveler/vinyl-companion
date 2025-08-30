/**
 * Test Supabase Connection
 * Quick test to verify our database setup works
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

// Create test Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const testSupabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseSetup() {
  console.log('🧪 Testing Supabase setup...\n');

  try {
    // Test 0: Basic service health check
    console.log('0. Testing Supabase service availability...');
    try {
      const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      console.log(`   Health check status: ${healthCheck.status}`);
      if (healthCheck.status !== 200) {
        const errorText = await healthCheck.text();
        console.log(`   Health check error: ${errorText}`);
      }
    } catch (healthError) {
      console.log(`   Health check failed: ${healthError.message}`);
    }

    // Test 1: Basic connection
    console.log('\n1. Testing basic connection...');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Key: ${supabaseAnonKey.substring(0, 20)}...`);
    
    // Try a simple query first
    const { data, error } = await testSupabase
      .from('albums')
      .select('*')
      .limit(1);
    
    console.log('   Raw response:', { data, error });
    
    if (error) {
      console.log('   Error code:', error.code);
      console.log('   Error message:', error.message);
      console.log('   Error details:', JSON.stringify(error, null, 2));
      
      if (error.code === 'PGRST116') {
        console.log('   Albums table does not exist! ❌');
        console.log('   Please run the database schema SQL in Supabase dashboard');
        return;
      } else if (error.message.includes('JWT') || error.code === 'PGRST301') {
        console.log('   Table exists but requires authentication (RLS working) ✅');
      } else {
        throw error;
      }
    } else {
      console.log('   Connection: ✅ SUCCESS\n');
    }

    // Test 2: Auth state (should be null/not logged in)
    console.log('2. Testing auth state...');
    const { data: { user } } = await testSupabase.auth.getUser();
    console.log(`   Current user: ${user ? user.email : 'Not logged in (expected)'} ✅\n`);

    // Test 3: Albums table access (should be restricted by RLS)
    console.log('3. Testing Row Level Security...');
    try {
      const { data: albums, error: albumError } = await testSupabase
        .from('albums')
        .select('*')
        .limit(1);
      
      if (albumError) {
        if (albumError.message.includes('JWT') || albumError.code === 'PGRST301') {
          console.log('   RLS: Working correctly (auth required) ✅\n');
        } else {
          console.log(`   RLS: Unexpected error - ${albumError.message} ❌\n`);
        }
      } else {
        console.log('   RLS: No restrictions (check your policies) ⚠️\n');
      }
    } catch (error) {
      console.log(`   RLS: Error testing - ${error.message} ❌\n`);
    }

    // Test 4: Check environment variables
    console.log('4. Checking configuration...');
    console.log(`   Supabase URL: ${supabaseUrl ? '✅' : '❌'}`);
    console.log(`   Anon Key: ${supabaseAnonKey ? '✅' : '❌'}\n`);

    console.log('🎉 Supabase setup test completed!');
    console.log('\nNext steps:');
    console.log('1. Run the app: npm run dev');
    console.log('2. Try the authentication modal');
    console.log('3. Test adding an album after login');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Check your .env file has correct Supabase credentials');
    console.log('2. Verify the database schema was created in Supabase dashboard');
    console.log('3. Make sure RLS policies are enabled');
  }
}

// Run the test
testSupabaseSetup();