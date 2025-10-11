-- Fix RLS policies for global cache tables
-- Allow authenticated users to INSERT/UPDATE global caches

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can read artist similarity cache" ON artist_similarity_cache;
DROP POLICY IF EXISTS "Authenticated users can read similarity cache" ON artist_similarity_cache;
DROP POLICY IF EXISTS "Authenticated users can insert similarity cache" ON artist_similarity_cache;
DROP POLICY IF EXISTS "Authenticated users can update similarity cache" ON artist_similarity_cache;
DROP POLICY IF EXISTS "Service role can manage similarity cache" ON artist_similarity_cache;

DROP POLICY IF EXISTS "Authenticated users can read artist metadata cache" ON artist_metadata_cache;
DROP POLICY IF EXISTS "Authenticated users can read metadata cache" ON artist_metadata_cache;
DROP POLICY IF EXISTS "Authenticated users can insert metadata cache" ON artist_metadata_cache;
DROP POLICY IF EXISTS "Authenticated users can update metadata cache" ON artist_metadata_cache;
DROP POLICY IF EXISTS "Service role can manage metadata cache" ON artist_metadata_cache;

-- Create new permissive policies for global caches
-- These are shared resources that all users can contribute to

-- Artist similarity cache policies
CREATE POLICY "Authenticated users can read similarity cache" ON artist_similarity_cache
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert similarity cache" ON artist_similarity_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update similarity cache" ON artist_similarity_cache
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Artist metadata cache policies
CREATE POLICY "Authenticated users can read metadata cache" ON artist_metadata_cache
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert metadata cache" ON artist_metadata_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update metadata cache" ON artist_metadata_cache
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Service role policies for administrative operations
CREATE POLICY "Service role can manage similarity cache" ON artist_similarity_cache
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage metadata cache" ON artist_metadata_cache
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments explaining the policy rationale
COMMENT ON POLICY "Authenticated users can insert similarity cache" ON artist_similarity_cache IS
'Global cache shared by all users - anyone can contribute similarity data from Last.fm API';

COMMENT ON POLICY "Authenticated users can insert metadata cache" ON artist_metadata_cache IS
'Global cache shared by all users - anyone can contribute artist metadata from Last.fm API';