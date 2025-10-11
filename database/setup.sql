-- =====================================================
-- VINYL COMPANION - DATABASE SETUP SCRIPT
-- =====================================================
--
-- This script sets up the complete Vinyl Companion database.
-- Run this on a fresh Supabase project to create all tables,
-- indexes, functions, and security policies.
--
-- USAGE:
--   1. Log into your Supabase project dashboard
--   2. Go to SQL Editor
--   3. Copy and paste this entire file
--   4. Click "Run" to execute
--
-- ESTIMATED TIME: 5-10 seconds
--
-- For detailed schema documentation, see: database/schema.sql
-- For help and information, see: database/README.md
--
-- =====================================================

\echo '================================================'
\echo 'Starting Vinyl Companion Database Setup...'
\echo '================================================'

-- Load the complete schema
\i schema.sql

\echo ''
\echo '================================================'
\echo 'Database Setup Complete!'
\echo '================================================'
\echo ''
\echo 'Tables Created:'
\echo '  ✓ albums - Vinyl record collection'
\echo '  ✓ tracks - Track listings'
\echo '  ✓ recs_feedback - Recommendation feedback'
\echo '  ✓ recs_cache - Recommendation cache'
\echo '  ✓ user_weights - Algorithm weights'
\echo '  ✓ external_data_cache - API response cache'
\echo '  ✓ artist_similarity_cache - Similar artists'
\echo '  ✓ artist_metadata_cache - Artist metadata'
\echo '  ✓ user_owned_artists - User-artist links'
\echo '  ✓ user_artist_recs_cache - Recommendations'
\echo '  ✓ user_collection_changes - Change tracking'
\echo ''
\echo 'Security:'
\echo '  ✓ Row Level Security enabled on all tables'
\echo '  ✓ User isolation policies created'
\echo '  ✓ Global cache sharing configured'
\echo ''
\echo 'Performance:'
\echo '  ✓ All indexes created'
\echo '  ✓ GIN indexes for JSONB columns'
\echo '  ✓ Partial indexes for common queries'
\echo ''
\echo 'Functions:'
\echo '  ✓ personalized_pagerank_recommendations()'
\echo '  ✓ get_similarity_scores()'
\echo '  ✓ cleanup_expired_cache()'
\echo '  ✓ Auto-update triggers configured'
\echo ''
\echo 'Next Steps:'
\echo '  1. Test authentication with your app'
\echo '  2. Add your first album'
\echo '  3. Explore recommendations'
\echo ''
\echo 'For help, see: database/README.md'
\echo '================================================'
