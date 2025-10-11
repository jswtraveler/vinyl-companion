-- Recommendation Caching Database Schema
-- MVP Phase: Persistent caching for Last.fm data and user recommendations
-- Created: 2024-01-26

-- =============================================
-- GLOBAL CACHES (Shared across all users)
-- =============================================

-- Artist similarity data from Last.fm API
-- Global cache with 30-day TTL to minimize API calls
CREATE TABLE IF NOT EXISTS artist_similarity_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_artist_name TEXT NOT NULL,
    source_artist_mbid UUID, -- MusicBrainz ID when available
    similar_artists JSONB NOT NULL, -- Array of similar artist objects
    data_source TEXT NOT NULL DEFAULT 'lastfm', -- 'lastfm' or 'listenbrainz'
    similarity_scores JSONB, -- Pre-computed similarity scores
    total_similar_count INTEGER DEFAULT 0,
    api_response_raw JSONB, -- Full API response for debugging

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 1,

    -- Constraints
    UNIQUE(source_artist_name, data_source)
);

-- Artist metadata from Last.fm (tags, listeners, etc.)
-- Global cache with 14-day TTL for relatively stable data
CREATE TABLE IF NOT EXISTS artist_metadata_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    artist_name TEXT NOT NULL,
    artist_mbid UUID, -- MusicBrainz ID when available

    -- Last.fm metadata
    listeners INTEGER,
    playcount BIGINT,
    tags JSONB, -- Array of tag objects with counts
    top_albums JSONB, -- Array of top album objects
    artist_info JSONB, -- Biography, images, etc.

    -- Enhanced metadata
    normalized_name TEXT NOT NULL, -- For matching
    genre_tags TEXT[], -- Extracted main genres
    primary_genre TEXT, -- Most common genre
    popularity_score DECIMAL(5,3), -- Normalized 0-1 score

    -- Metadata
    data_source TEXT NOT NULL DEFAULT 'lastfm',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 1,

    -- Constraints
    UNIQUE(artist_name, data_source)
);

-- =============================================
-- USER-SPECIFIC DATA
-- =============================================

-- User's owned artists (for recommendation generation)
-- Links users to their collection for fast querying
CREATE TABLE IF NOT EXISTS user_owned_artists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- Supabase auth.users.id
    artist_name TEXT NOT NULL,
    artist_mbid UUID, -- MusicBrainz ID when available
    normalized_name TEXT NOT NULL,

    -- Collection stats
    album_count INTEGER DEFAULT 1,
    total_albums_owned INTEGER DEFAULT 1, -- User's total for this artist
    first_added_at TIMESTAMPTZ DEFAULT NOW(),
    last_added_at TIMESTAMPTZ DEFAULT NOW(),

    -- Preference indicators
    is_favorite BOOLEAN DEFAULT FALSE,
    play_frequency TEXT DEFAULT 'normal', -- 'high', 'normal', 'low'
    user_rating DECIMAL(2,1), -- 1.0-5.0 if user rates artists

    -- Cache optimization
    similarity_cache_key TEXT, -- Links to artist_similarity_cache
    metadata_cache_key TEXT, -- Links to artist_metadata_cache

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, artist_name),

    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User's recommendation cache (24-hour TTL)
-- Stores generated recommendations to avoid recalculation
CREATE TABLE IF NOT EXISTS user_artist_recs_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,

    -- Cache identification
    collection_fingerprint TEXT NOT NULL, -- Hash of user's collection
    profile_version INTEGER DEFAULT 1, -- Increment when profile logic changes
    algorithm_version TEXT DEFAULT 'mvp_v1', -- Track algorithm changes

    -- Recommendation data
    recommendations JSONB NOT NULL, -- Full recommendation object
    recommendation_lists JSONB, -- Categorized lists (Top Picks, Similar Artists, etc.)
    total_recommendations INTEGER DEFAULT 0,

    -- Generation metadata
    generation_time_ms INTEGER, -- How long it took to generate
    data_sources TEXT[], -- 'lastfm', 'listenbrainz', 'profile_based'
    coverage_percentage DECIMAL(5,2), -- How much of collection had similarity data
    confidence_score DECIMAL(3,2), -- Overall confidence in recommendations

    -- Diversity metrics
    unique_genres INTEGER, -- Number of different genres in recommendations
    unique_decades INTEGER, -- Number of different decades
    diversity_score DECIMAL(3,2), -- Overall diversity metric

    -- Usage tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    user_feedback JSONB, -- Thumbs up/down, hidden items, etc.

    -- Cache management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    is_stale BOOLEAN DEFAULT FALSE, -- Mark when collection changes

    -- Constraints
    UNIQUE(user_id, collection_fingerprint),

    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
-- HELPER TABLES
-- =============================================

-- Collection change tracking (for cache invalidation)
CREATE TABLE IF NOT EXISTS user_collection_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    change_type TEXT NOT NULL, -- 'album_added', 'album_removed', 'album_updated'
    album_id UUID, -- Reference to albums table
    artist_name TEXT,

    -- Change tracking
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ, -- When recommendation cache was invalidated

    -- Metadata
    change_fingerprint TEXT, -- For deduplication

    -- No constraints needed for change tracking

    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on user-specific tables
ALTER TABLE user_owned_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_artist_recs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collection_changes ENABLE ROW LEVEL SECURITY;

-- Global caches are readable by all authenticated users
ALTER TABLE artist_similarity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_metadata_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only access their own data
CREATE POLICY "Users can manage their own owned artists" ON user_owned_artists
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recommendation cache" ON user_artist_recs_cache
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own collection changes" ON user_collection_changes
    FOR ALL USING (auth.uid() = user_id);

-- Global caches are readable by authenticated users
CREATE POLICY "Authenticated users can read artist similarity cache" ON artist_similarity_cache
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read artist metadata cache" ON artist_metadata_cache
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage global caches (for background jobs)
CREATE POLICY "Service role can manage similarity cache" ON artist_similarity_cache
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage metadata cache" ON artist_metadata_cache
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- FUNCTIONS FOR CACHE MANAGEMENT
-- =============================================

-- Function to invalidate user recommendation cache when collection changes
CREATE OR REPLACE FUNCTION invalidate_user_recommendation_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark existing cache as stale
    UPDATE user_artist_recs_cache
    SET is_stale = TRUE
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);

    -- Log the change
    INSERT INTO user_collection_changes (user_id, change_type, album_id, artist_name)
    VALUES (
        COALESCE(NEW.user_id, OLD.user_id),
        CASE
            WHEN TG_OP = 'INSERT' THEN 'album_added'
            WHEN TG_OP = 'DELETE' THEN 'album_removed'
            ELSE 'album_updated'
        END,
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.artist, OLD.artist)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_caches()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Clean up expired similarity cache
    DELETE FROM artist_similarity_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;

    -- Clean up expired metadata cache
    DELETE FROM artist_metadata_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;

    -- Clean up expired recommendation cache
    DELETE FROM user_artist_recs_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;

    -- Clean up old collection changes (keep 7 days)
    DELETE FROM user_collection_changes WHERE changed_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to invalidate cache when albums table changes
-- Note: This assumes you have an 'albums' table - adjust as needed
-- CREATE TRIGGER invalidate_recs_on_album_change
--     AFTER INSERT OR UPDATE OR DELETE ON albums
--     FOR EACH ROW
--     EXECUTE FUNCTION invalidate_user_recommendation_cache();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Create indexes for artist_similarity_cache
CREATE INDEX IF NOT EXISTS idx_similarity_source_mbid ON artist_similarity_cache(source_artist_mbid);
CREATE INDEX IF NOT EXISTS idx_similarity_expires_at ON artist_similarity_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_similarity_data_source ON artist_similarity_cache(data_source, created_at);

-- Create indexes for artist_metadata_cache
CREATE INDEX IF NOT EXISTS idx_metadata_artist_mbid ON artist_metadata_cache(artist_mbid);
CREATE INDEX IF NOT EXISTS idx_metadata_normalized_name ON artist_metadata_cache(normalized_name);
CREATE INDEX IF NOT EXISTS idx_metadata_primary_genre ON artist_metadata_cache(primary_genre);
CREATE INDEX IF NOT EXISTS idx_metadata_expires_at ON artist_metadata_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_metadata_popularity_score ON artist_metadata_cache(popularity_score DESC);

-- Create indexes for user_owned_artists
CREATE INDEX IF NOT EXISTS idx_user_artists_album_count ON user_owned_artists(user_id, album_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_artists_normalized_name ON user_owned_artists(user_id, normalized_name);
CREATE INDEX IF NOT EXISTS idx_user_artists_mbid ON user_owned_artists(artist_mbid);
CREATE INDEX IF NOT EXISTS idx_user_artists_favorite ON user_owned_artists(is_favorite, user_id);

-- Create indexes for user_artist_recs_cache
CREATE INDEX IF NOT EXISTS idx_user_recs_expires_at ON user_artist_recs_cache(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_recs_created_at ON user_artist_recs_cache(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_recs_expires_global ON user_artist_recs_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_recs_is_stale ON user_artist_recs_cache(is_stale);

-- Create indexes for user_collection_changes
CREATE INDEX IF NOT EXISTS idx_collection_changes_user_date ON user_collection_changes(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_changes_processed ON user_collection_changes(processed_at);
CREATE INDEX IF NOT EXISTS idx_collection_changes_type ON user_collection_changes(change_type);

-- Additional indexes for common query patterns (without WHERE clauses using NOW())
CREATE INDEX IF NOT EXISTS idx_similarity_cache_lookup
    ON artist_similarity_cache(source_artist_name, expires_at);

CREATE INDEX IF NOT EXISTS idx_metadata_cache_lookup
    ON artist_metadata_cache(normalized_name, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_artists_collection
    ON user_owned_artists(user_id, album_count DESC, is_favorite DESC);

CREATE INDEX IF NOT EXISTS idx_user_recs_active
    ON user_artist_recs_cache(user_id, expires_at, is_stale);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_similar_artists_gin
    ON artist_similarity_cache USING GIN(similar_artists);

CREATE INDEX IF NOT EXISTS idx_artist_tags_gin
    ON artist_metadata_cache USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_recommendations_gin
    ON user_artist_recs_cache USING GIN(recommendations);

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE artist_similarity_cache IS 'Global cache for Last.fm similar artist data with 30-day TTL';
COMMENT ON TABLE artist_metadata_cache IS 'Global cache for artist metadata (tags, listeners) with 14-day TTL';
COMMENT ON TABLE user_owned_artists IS 'User-specific table linking users to artists in their collection';
COMMENT ON TABLE user_artist_recs_cache IS 'User-specific recommendation cache with 24-hour TTL';
COMMENT ON TABLE user_collection_changes IS 'Tracks collection changes for cache invalidation';

-- Done!
-- This schema provides:
-- 1. Global caches for expensive API data
-- 2. User-specific linking and recommendation storage
-- 3. Automatic cache invalidation
-- 4. Row-level security
-- 5. Performance optimizations
-- 6. Background cleanup functions