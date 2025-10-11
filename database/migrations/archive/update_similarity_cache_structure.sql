-- Update artist_similarity_cache structure for Edge Function compatibility
-- This migration converts from single-record with multiple similar artists (JSONB array)
-- to one record per similar artist relationship for better querying

-- Create new structure table
CREATE TABLE IF NOT EXISTS artist_similarity_cache_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_artist TEXT NOT NULL,
    source_mbid TEXT,
    target_artist TEXT NOT NULL,
    target_mbid TEXT,
    similarity_score DECIMAL(4,3) DEFAULT 0.000, -- 0.000 to 1.000
    data_source TEXT NOT NULL DEFAULT 'lastfm',
    cached_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_artist, target_artist)
);

-- Copy existing data if it exists (convert from old JSONB structure to new row-per-relationship)
DO $$
DECLARE
    rec RECORD;
    similar_artist JSONB;
BEGIN
    -- Check if old table has data
    IF EXISTS (SELECT 1 FROM artist_similarity_cache LIMIT 1) THEN
        -- Iterate through old records
        FOR rec IN SELECT * FROM artist_similarity_cache LOOP
            -- Extract each similar artist from JSONB array
            FOR similar_artist IN SELECT * FROM jsonb_array_elements(rec.similar_artists) LOOP
                INSERT INTO artist_similarity_cache_new (
                    source_artist,
                    source_mbid,
                    target_artist,
                    target_mbid,
                    similarity_score,
                    data_source,
                    cached_at
                ) VALUES (
                    rec.source_artist_name,
                    rec.source_artist_mbid::TEXT,
                    similar_artist->>'name',
                    similar_artist->>'mbid',
                    COALESCE((similar_artist->>'match')::DECIMAL, 0.5),
                    rec.data_source,
                    rec.created_at
                )
                ON CONFLICT (source_artist, target_artist) DO NOTHING;
            END LOOP;
        END LOOP;
    END IF;
END $$;

-- Drop old table and rename new one
DROP TABLE IF EXISTS artist_similarity_cache;
ALTER TABLE artist_similarity_cache_new RENAME TO artist_similarity_cache;

-- Enable RLS
ALTER TABLE artist_similarity_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for global read access
DROP POLICY IF EXISTS "Authenticated users can read artist similarity cache" ON artist_similarity_cache;
CREATE POLICY "Authenticated users can read artist similarity cache"
    ON artist_similarity_cache
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage similarity cache" ON artist_similarity_cache;
CREATE POLICY "Service role can manage similarity cache"
    ON artist_similarity_cache
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add policy for authenticated users to write (for client-side progressive collection)
DROP POLICY IF EXISTS "Authenticated users can write to similarity cache" ON artist_similarity_cache;
CREATE POLICY "Authenticated users can write to similarity cache"
    ON artist_similarity_cache
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_similarity_source ON artist_similarity_cache(source_artist);
CREATE INDEX IF NOT EXISTS idx_similarity_target ON artist_similarity_cache(target_artist);
CREATE INDEX IF NOT EXISTS idx_similarity_source_mbid ON artist_similarity_cache(source_mbid) WHERE source_mbid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_similarity_target_mbid ON artist_similarity_cache(target_mbid) WHERE target_mbid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_similarity_score ON artist_similarity_cache(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_similarity_cached_at ON artist_similarity_cache(cached_at);

-- Update artist_metadata_cache structure for Edge Function
-- Change from complex structure to simpler metadata JSONB

ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS listeners;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS playcount;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS tags;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS top_albums;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS artist_info;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS normalized_name;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS genre_tags;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS primary_genre;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS popularity_score;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS data_source;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS created_at;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS updated_at;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS expires_at;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS last_accessed_at;
ALTER TABLE artist_metadata_cache DROP COLUMN IF EXISTS access_count;

-- Add simplified structure
ALTER TABLE artist_metadata_cache ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE artist_metadata_cache ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'lastfm';
ALTER TABLE artist_metadata_cache ADD COLUMN IF NOT EXISTS cached_at TIMESTAMPTZ DEFAULT NOW();

-- Drop old constraint
ALTER TABLE artist_metadata_cache DROP CONSTRAINT IF EXISTS artist_metadata_cache_artist_name_data_source_key;

-- Add new unique constraint
ALTER TABLE artist_metadata_cache ADD CONSTRAINT artist_metadata_cache_artist_name_unique UNIQUE(artist_name);

-- Enable RLS if not already enabled
ALTER TABLE artist_metadata_cache ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
DROP POLICY IF EXISTS "Authenticated users can read artist metadata cache" ON artist_metadata_cache;
CREATE POLICY "Authenticated users can read artist metadata cache"
    ON artist_metadata_cache
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage metadata cache" ON artist_metadata_cache;
CREATE POLICY "Service role can manage metadata cache"
    ON artist_metadata_cache
    FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can write to metadata cache" ON artist_metadata_cache;
CREATE POLICY "Authenticated users can write to metadata cache"
    ON artist_metadata_cache
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Create simplified indexes
DROP INDEX IF EXISTS idx_metadata_artist_mbid;
DROP INDEX IF EXISTS idx_metadata_normalized_name;
DROP INDEX IF EXISTS idx_metadata_primary_genre;
DROP INDEX IF EXISTS idx_metadata_expires_at;
DROP INDEX IF EXISTS idx_metadata_popularity_score;

CREATE INDEX IF NOT EXISTS idx_metadata_artist_name ON artist_metadata_cache(artist_name);
CREATE INDEX IF NOT EXISTS idx_metadata_artist_mbid ON artist_metadata_cache(artist_mbid) WHERE artist_mbid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metadata_cached_at ON artist_metadata_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_metadata_gin ON artist_metadata_cache USING GIN(metadata);

COMMENT ON TABLE artist_similarity_cache IS 'Global cache for artist similarity relationships - one row per relationship';
COMMENT ON TABLE artist_metadata_cache IS 'Global cache for artist metadata from Last.fm';
