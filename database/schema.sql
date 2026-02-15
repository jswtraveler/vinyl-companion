-- =====================================================
-- VINYL COMPANION - CONSOLIDATED DATABASE SCHEMA
-- =====================================================
-- This is the complete, consolidated schema for the Vinyl Companion app.
-- It represents the final state after all migrations have been applied.
--
-- Version: 1.0
-- Last Updated: 2025-10-11
--
-- For setup instructions, see: database/README.md
-- For a user-friendly setup script, see: database/setup.sql
-- =====================================================

-- =====================================================
-- CORE TABLES: Album Collection
-- =====================================================

-- Main albums table - stores user's vinyl collection
CREATE TABLE IF NOT EXISTS albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Basic album information
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  year INTEGER,
  genre TEXT[], -- Array of genres

  -- Vinyl-specific details
  label TEXT,
  catalog_number TEXT,
  format TEXT DEFAULT 'LP', -- LP, EP, Single, etc.
  speed TEXT DEFAULT '33 RPM', -- 33 RPM, 45 RPM, 78 RPM
  size TEXT DEFAULT '12"', -- 12", 10", 7"
  country TEXT, -- Country of release

  -- Condition and ownership
  condition TEXT DEFAULT 'Near Mint', -- Mint, Near Mint, Very Good+, etc.
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  purchase_location TEXT,

  -- Media and identification
  cover_image_url TEXT, -- URL to cover art image
  identification_method TEXT, -- 'reverse-image-search', 'ocr', 'manual', etc.
  identification_confidence DECIMAL(3,2), -- 0.00 to 1.00

  -- Metadata from APIs
  musicbrainz_id TEXT,
  discogs_id TEXT,
  spotify_id TEXT,

  -- User notes and tracking
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  listening_count INTEGER DEFAULT 0,
  last_played DATE,

  -- AI Analysis and Mood Tags
  moods TEXT[], -- Array of AI-generated mood tags
  ai_analysis JSONB, -- AI analysis metadata (reasoning, confidence, timestamp, etc.)

  -- Recommendation Engine Fields
  artist_mbids TEXT[], -- MusicBrainz IDs for artist matching
  tags TEXT[], -- Combined genre + mood tags for recommendations
  fingerprint TEXT, -- Normalized artist::title for deduplication
  normalized_artist TEXT, -- Lowercase, alphanumeric artist name
  normalized_title TEXT, -- Lowercase, alphanumeric title

  -- System fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_album UNIQUE (user_id, artist, title)
);

-- Tracks table - detailed track listings for albums
CREATE TABLE IF NOT EXISTS tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE NOT NULL,
  track_number INTEGER NOT NULL,
  side TEXT, -- 'A', 'B', '1', '2', etc.
  title TEXT NOT NULL,
  duration INTERVAL, -- Track length
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_album_track UNIQUE (album_id, track_number, side)
);

-- =====================================================
-- RECOMMENDATION ENGINE TABLES
-- =====================================================

-- Recommendation feedback - tracks user likes/dislikes
CREATE TABLE IF NOT EXISTS recs_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  album_fingerprint TEXT NOT NULL,
  feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike', 'hide', 'wishlist', 'not_interested')) NOT NULL,
  feedback_context TEXT, -- Which list/context the feedback came from
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_feedback UNIQUE(user_id, album_fingerprint, feedback_type)
);

-- Recommendation cache - stores generated recommendations per user
CREATE TABLE IF NOT EXISTS recs_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cache_key TEXT NOT NULL, -- e.g., 'top_10', 'similar_to_radiohead', 'more_indie_rock'
  album_fingerprint TEXT NOT NULL,
  candidate_data JSONB NOT NULL, -- Full album data from external APIs
  score DECIMAL(5,4), -- 0.0000 to 1.0000
  reasons TEXT[], -- Human-readable reasons for recommendation
  list_type TEXT, -- 'top_10', 'because_you_own', 'more_genre', etc.
  source_data JSONB, -- Original data from Last.fm, MusicBrainz, etc.
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 day',

  CONSTRAINT unique_user_cache_entry UNIQUE(user_id, cache_key, album_fingerprint)
);

-- User recommendation weights - personalized algorithm weights
CREATE TABLE IF NOT EXISTS user_weights (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  artist_weight DECIMAL(3,2) DEFAULT 0.35 CHECK (artist_weight >= 0 AND artist_weight <= 1),
  genre_weight DECIMAL(3,2) DEFAULT 0.30 CHECK (genre_weight >= 0 AND genre_weight <= 1),
  era_weight DECIMAL(3,2) DEFAULT 0.15 CHECK (era_weight >= 0 AND era_weight <= 1),
  label_weight DECIMAL(3,2) DEFAULT 0.08 CHECK (label_weight >= 0 AND label_weight <= 1),
  mood_weight DECIMAL(3,2) DEFAULT 0.07 CHECK (mood_weight >= 0 AND mood_weight <= 1),
  popularity_weight DECIMAL(3,2) DEFAULT 0.05 CHECK (popularity_weight >= 0 AND popularity_weight <= 1),
  learning_rate DECIMAL(3,2) DEFAULT 0.01 CHECK (learning_rate >= 0 AND learning_rate <= 0.1),
  total_feedback INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- External data cache - caches API responses globally
CREATE TABLE IF NOT EXISTS external_data_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL, -- e.g., 'lastfm_similar_radiohead', 'lastfm_tag_indie'
  api_source TEXT NOT NULL, -- 'lastfm', 'musicbrainz', 'discogs'
  request_params JSONB, -- Original request parameters
  response_data JSONB NOT NULL, -- Full API response
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 day',
  hit_count INTEGER DEFAULT 0,

  CONSTRAINT unique_cache_key UNIQUE(cache_key)
);

-- =====================================================
-- GLOBAL CACHE TABLES (Shared Across Users)
-- =====================================================

-- Artist similarity cache - Last.fm similar artist relationships
-- Structure: One row per artist-to-artist similarity relationship
CREATE TABLE IF NOT EXISTS artist_similarity_cache (
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

-- Artist metadata cache - Last.fm artist information
CREATE TABLE IF NOT EXISTS artist_metadata_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    artist_name TEXT NOT NULL UNIQUE,
    artist_mbid UUID, -- MusicBrainz ID when available

    -- Metadata stored as JSONB for flexibility
    metadata JSONB,

    -- Spotify integration fields
    spotify_image_url TEXT, -- High-resolution artist image
    spotify_id TEXT, -- Spotify artist ID
    spotify_url TEXT, -- Spotify artist profile URL

    -- Cache metadata
    data_source TEXT DEFAULT 'lastfm',
    cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- User owned artists - links users to artists in their collection
CREATE TABLE IF NOT EXISTS user_owned_artists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_name TEXT NOT NULL,
    artist_mbid UUID, -- MusicBrainz ID when available
    normalized_name TEXT NOT NULL,

    -- Collection stats
    album_count INTEGER DEFAULT 1,
    total_albums_owned INTEGER DEFAULT 1,
    first_added_at TIMESTAMPTZ DEFAULT NOW(),
    last_added_at TIMESTAMPTZ DEFAULT NOW(),

    -- Preference indicators
    is_favorite BOOLEAN DEFAULT FALSE,
    play_frequency TEXT DEFAULT 'normal', -- 'high', 'normal', 'low'
    user_rating DECIMAL(2,1), -- 1.0-5.0 if user rates artists

    -- Cache optimization
    similarity_cache_key TEXT,
    metadata_cache_key TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, artist_name)
);

-- User artist recommendations cache - 24-hour cached recommendations
CREATE TABLE IF NOT EXISTS user_artist_recs_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Cache identification
    collection_fingerprint TEXT NOT NULL,
    profile_version INTEGER DEFAULT 1,
    algorithm_version TEXT DEFAULT 'mvp_v1',

    -- Recommendation data
    recommendations JSONB NOT NULL,
    recommendation_lists JSONB,
    total_recommendations INTEGER DEFAULT 0,

    -- Generation metadata
    generation_time_ms INTEGER,
    data_sources TEXT[],
    coverage_percentage DECIMAL(5,2),
    confidence_score DECIMAL(3,2),

    -- Diversity metrics
    unique_genres INTEGER,
    unique_decades INTEGER,
    diversity_score DECIMAL(3,2),

    -- Usage tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    user_feedback JSONB,

    -- Cache management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    is_stale BOOLEAN DEFAULT FALSE,

    -- Constraints
    UNIQUE(user_id, collection_fingerprint)
);

-- Collection change tracking - for cache invalidation
CREATE TABLE IF NOT EXISTS user_collection_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL, -- 'album_added', 'album_removed', 'album_updated'
    album_id UUID,
    artist_name TEXT,

    -- Change tracking
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    -- Metadata
    change_fingerprint TEXT
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recs_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE recs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_similarity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_metadata_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_owned_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_artist_recs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collection_changes ENABLE ROW LEVEL SECURITY;

-- Albums table policies
DROP POLICY IF EXISTS "Users can view their own albums" ON albums;
CREATE POLICY "Users can view their own albums"
  ON albums FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own albums" ON albums;
CREATE POLICY "Users can insert their own albums"
  ON albums FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own albums" ON albums;
CREATE POLICY "Users can update their own albums"
  ON albums FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own albums" ON albums;
CREATE POLICY "Users can delete their own albums"
  ON albums FOR DELETE
  USING (auth.uid() = user_id);

-- Tracks table policies
DROP POLICY IF EXISTS "Users can view tracks of their albums" ON tracks;
CREATE POLICY "Users can view tracks of their albums"
  ON tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = tracks.album_id
      AND albums.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert tracks to their albums" ON tracks;
CREATE POLICY "Users can insert tracks to their albums"
  ON tracks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = tracks.album_id
      AND albums.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update tracks of their albums" ON tracks;
CREATE POLICY "Users can update tracks of their albums"
  ON tracks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = tracks.album_id
      AND albums.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete tracks of their albums" ON tracks;
CREATE POLICY "Users can delete tracks of their albums"
  ON tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = tracks.album_id
      AND albums.user_id = auth.uid()
    )
  );

-- Recommendation feedback policies
DROP POLICY IF EXISTS "Users can view their own feedback" ON recs_feedback;
CREATE POLICY "Users can view their own feedback"
  ON recs_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own feedback" ON recs_feedback;
CREATE POLICY "Users can insert their own feedback"
  ON recs_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feedback" ON recs_feedback;
CREATE POLICY "Users can update their own feedback"
  ON recs_feedback FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own feedback" ON recs_feedback;
CREATE POLICY "Users can delete their own feedback"
  ON recs_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Recommendation cache policies
DROP POLICY IF EXISTS "Users can view their own cache" ON recs_cache;
CREATE POLICY "Users can view their own cache"
  ON recs_cache FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own cache" ON recs_cache;
CREATE POLICY "Users can insert their own cache"
  ON recs_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cache" ON recs_cache;
CREATE POLICY "Users can update their own cache"
  ON recs_cache FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cache" ON recs_cache;
CREATE POLICY "Users can delete their own cache"
  ON recs_cache FOR DELETE
  USING (auth.uid() = user_id);

-- User weights policies
DROP POLICY IF EXISTS "Users can view their own weights" ON user_weights;
CREATE POLICY "Users can view their own weights"
  ON user_weights FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own weights" ON user_weights;
CREATE POLICY "Users can insert their own weights"
  ON user_weights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own weights" ON user_weights;
CREATE POLICY "Users can update their own weights"
  ON user_weights FOR UPDATE
  USING (auth.uid() = user_id);

-- External data cache policies (shared across users)
DROP POLICY IF EXISTS "All authenticated users can read external cache" ON external_data_cache;
CREATE POLICY "All authenticated users can read external cache"
  ON external_data_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage external cache" ON external_data_cache;
CREATE POLICY "Service role can manage external cache"
  ON external_data_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Global cache policies (shared across users)
DROP POLICY IF EXISTS "Authenticated users can read similarity cache" ON artist_similarity_cache;
CREATE POLICY "Authenticated users can read similarity cache" ON artist_similarity_cache
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert similarity cache" ON artist_similarity_cache;
CREATE POLICY "Authenticated users can insert similarity cache" ON artist_similarity_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update similarity cache" ON artist_similarity_cache;
CREATE POLICY "Authenticated users can update similarity cache" ON artist_similarity_cache
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage similarity cache" ON artist_similarity_cache;
CREATE POLICY "Service role can manage similarity cache" ON artist_similarity_cache
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can read metadata cache" ON artist_metadata_cache;
CREATE POLICY "Authenticated users can read metadata cache" ON artist_metadata_cache
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert metadata cache" ON artist_metadata_cache;
CREATE POLICY "Authenticated users can insert metadata cache" ON artist_metadata_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update metadata cache" ON artist_metadata_cache;
CREATE POLICY "Authenticated users can update metadata cache" ON artist_metadata_cache
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage metadata cache" ON artist_metadata_cache;
CREATE POLICY "Service role can manage metadata cache" ON artist_metadata_cache
    FOR ALL USING (auth.role() = 'service_role');

-- User owned artists policies
DROP POLICY IF EXISTS "Users can manage their own owned artists" ON user_owned_artists;
CREATE POLICY "Users can manage their own owned artists" ON user_owned_artists
    FOR ALL USING (auth.uid() = user_id);

-- User artist recommendations cache policies
DROP POLICY IF EXISTS "Users can manage their own recommendation cache" ON user_artist_recs_cache;
CREATE POLICY "Users can manage their own recommendation cache" ON user_artist_recs_cache
    FOR ALL USING (auth.uid() = user_id);

-- User collection changes policies
DROP POLICY IF EXISTS "Users can manage their own collection changes" ON user_collection_changes;
CREATE POLICY "Users can manage their own collection changes" ON user_collection_changes
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Albums table indexes
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title);
CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at);
CREATE INDEX IF NOT EXISTS idx_albums_fingerprint ON albums(fingerprint);
CREATE INDEX IF NOT EXISTS idx_albums_normalized_artist ON albums(normalized_artist);
CREATE INDEX IF NOT EXISTS idx_albums_tags ON albums USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_albums_artist_mbids ON albums USING gin(artist_mbids);

-- Tracks table indexes
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);

-- Recommendation feedback indexes
CREATE INDEX IF NOT EXISTS idx_recs_feedback_user_id ON recs_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_recs_feedback_fingerprint ON recs_feedback(album_fingerprint);
CREATE INDEX IF NOT EXISTS idx_recs_feedback_type ON recs_feedback(feedback_type);

-- Recommendation cache indexes
CREATE INDEX IF NOT EXISTS idx_recs_cache_user_id ON recs_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_recs_cache_key ON recs_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_recs_cache_expires_at ON recs_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_recs_cache_score ON recs_cache(score DESC);

-- External data cache indexes
CREATE INDEX IF NOT EXISTS idx_external_cache_key ON external_data_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_external_cache_expires_at ON external_data_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_external_cache_source ON external_data_cache(api_source);

-- Artist similarity cache indexes
CREATE INDEX IF NOT EXISTS idx_similarity_source ON artist_similarity_cache(source_artist);
CREATE INDEX IF NOT EXISTS idx_similarity_target ON artist_similarity_cache(target_artist);
CREATE INDEX IF NOT EXISTS idx_similarity_source_mbid ON artist_similarity_cache(source_mbid) WHERE source_mbid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_similarity_target_mbid ON artist_similarity_cache(target_mbid) WHERE target_mbid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_similarity_score ON artist_similarity_cache(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_similarity_cached_at ON artist_similarity_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_similarity_ppr_lookup ON artist_similarity_cache (source_artist, similarity_score DESC) WHERE similarity_score >= 0.3;
CREATE INDEX IF NOT EXISTS idx_similarity_ppr_target ON artist_similarity_cache (target_artist, similarity_score DESC) WHERE similarity_score >= 0.3;

-- Artist metadata cache indexes
CREATE INDEX IF NOT EXISTS idx_metadata_artist_name ON artist_metadata_cache(artist_name);
CREATE INDEX IF NOT EXISTS idx_metadata_artist_mbid ON artist_metadata_cache(artist_mbid) WHERE artist_mbid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metadata_cached_at ON artist_metadata_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_metadata_gin ON artist_metadata_cache USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_artist_metadata_cache_spotify_id ON artist_metadata_cache(spotify_id);

-- User owned artists indexes
CREATE INDEX IF NOT EXISTS idx_user_artists_album_count ON user_owned_artists(user_id, album_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_artists_normalized_name ON user_owned_artists(user_id, normalized_name);
CREATE INDEX IF NOT EXISTS idx_user_artists_mbid ON user_owned_artists(artist_mbid);
CREATE INDEX IF NOT EXISTS idx_user_artists_favorite ON user_owned_artists(is_favorite, user_id);
CREATE INDEX IF NOT EXISTS idx_user_artists_collection ON user_owned_artists(user_id, album_count DESC, is_favorite DESC);

-- User artist recommendations cache indexes
CREATE INDEX IF NOT EXISTS idx_user_recs_expires_at ON user_artist_recs_cache(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_recs_created_at ON user_artist_recs_cache(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_recs_expires_global ON user_artist_recs_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_recs_is_stale ON user_artist_recs_cache(is_stale);
CREATE INDEX IF NOT EXISTS idx_user_recs_active ON user_artist_recs_cache(user_id, expires_at, is_stale);
CREATE INDEX IF NOT EXISTS idx_recommendations_gin ON user_artist_recs_cache USING GIN(recommendations);

-- User collection changes indexes
CREATE INDEX IF NOT EXISTS idx_collection_changes_user_date ON user_collection_changes(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_changes_processed ON user_collection_changes(processed_at);
CREATE INDEX IF NOT EXISTS idx_collection_changes_type ON user_collection_changes(change_type);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger: Albums updated_at
DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
CREATE TRIGGER update_albums_updated_at
  BEFORE UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Recommendation feedback updated_at
DROP TRIGGER IF EXISTS update_recs_feedback_updated_at ON recs_feedback;
CREATE TRIGGER update_recs_feedback_updated_at
  BEFORE UPDATE ON recs_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: User weights updated_at
DROP TRIGGER IF EXISTS update_user_weights_updated_at ON user_weights;
CREATE TRIGGER update_user_weights_updated_at
  BEFORE UPDATE ON user_weights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-update album fingerprints
CREATE OR REPLACE FUNCTION auto_update_album_fingerprints()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fingerprint = LOWER(REGEXP_REPLACE(NEW.artist, '[^\w\s]', '', 'g')) || '::' || LOWER(REGEXP_REPLACE(NEW.title, '[^\w\s]', '', 'g'));
  NEW.normalized_artist = LOWER(REGEXP_REPLACE(NEW.artist, '[^\w\s]', '', 'g'));
  NEW.normalized_title = LOWER(REGEXP_REPLACE(NEW.title, '[^\w\s]', '', 'g'));
  NEW.tags = COALESCE(NEW.genre, ARRAY[]::TEXT[]) || COALESCE(NEW.moods, ARRAY[]::TEXT[]);
  RETURN NEW;
END;
$$;

-- Trigger: Auto-update fingerprints on album insert/update
DROP TRIGGER IF EXISTS update_album_fingerprints_trigger ON albums;
CREATE TRIGGER update_album_fingerprints_trigger
  BEFORE INSERT OR UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_album_fingerprints();

-- Function: Invalidate user recommendation cache when collection changes
CREATE OR REPLACE FUNCTION invalidate_user_recommendation_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Trigger: Invalidate cache on album changes (commented out - enable if needed)
-- DROP TRIGGER IF EXISTS invalidate_recs_on_album_change ON albums;
-- CREATE TRIGGER invalidate_recs_on_album_change
--     AFTER INSERT OR UPDATE OR DELETE ON albums
--     FOR EACH ROW
--     EXECUTE FUNCTION invalidate_user_recommendation_cache();

-- Function: Clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Clean up expired recommendation cache
  DELETE FROM recs_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Clean up expired external data cache
  DELETE FROM external_data_cache WHERE expires_at < NOW();

  RETURN deleted_count;
END;
$$;

-- Function: Clean up all expired caches
CREATE OR REPLACE FUNCTION cleanup_expired_caches()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
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
$$;

-- Function: Personalized PageRank for artist recommendations
CREATE OR REPLACE FUNCTION personalized_pagerank_recommendations(
    p_user_id UUID,
    p_user_artists TEXT[],
    p_max_iterations INTEGER DEFAULT 20,
    p_damping_factor DECIMAL DEFAULT 0.85,
    p_min_similarity DECIMAL DEFAULT 0.3,
    p_convergence_threshold DECIMAL DEFAULT 0.0001,
    p_max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
    target_artist TEXT,
    ppr_score DECIMAL,
    normalized_score DECIMAL,
    node_degree INTEGER,
    connected_to TEXT[]
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_iteration INTEGER := 0;
    v_max_change DECIMAL := 1.0;
    v_user_artist_count INTEGER;
    v_restart_prob DECIMAL;
BEGIN
    -- Count user artists for restart probability
    SELECT COUNT(*) INTO v_user_artist_count
    FROM unnest(p_user_artists) AS artist;

    v_restart_prob := (1.0 - p_damping_factor) / v_user_artist_count;

    -- Create temporary table for PPR scores
    CREATE TEMP TABLE IF NOT EXISTS ppr_scores (
        artist TEXT PRIMARY KEY,
        score DECIMAL DEFAULT 0.0,
        new_score DECIMAL DEFAULT 0.0,
        is_user_artist BOOLEAN DEFAULT FALSE,
        degree INTEGER DEFAULT 0
    ) ON COMMIT DROP;

    -- Initialize: Get all artists in similarity graph + user artists
    -- Calculate node degrees (number of outgoing edges)
    INSERT INTO ppr_scores (artist, score, is_user_artist, degree)
    SELECT
        artist_name,
        CASE
            WHEN is_owned THEN 1.0 / v_user_artist_count
            ELSE 0.0
        END as initial_score,
        is_owned,
        COALESCE(degree, 0) as degree
    FROM (
        -- User owned artists
        SELECT
            LOWER(artist_name) as artist_name,
            TRUE as is_owned,
            COUNT(*) as degree
        FROM user_owned_artists owned
        LEFT JOIN artist_similarity_cache sim
            ON LOWER(owned.artist_name) = LOWER(sim.source_artist)
            AND sim.similarity_score >= p_min_similarity
        WHERE owned.user_id = p_user_id
        GROUP BY artist_name

        UNION

        -- Similar artists (reachable from user artists)
        SELECT
            LOWER(sim.target_artist) as artist_name,
            FALSE as is_owned,
            0 as degree
        FROM user_owned_artists owned
        JOIN artist_similarity_cache sim
            ON LOWER(owned.artist_name) = LOWER(sim.source_artist)
        WHERE owned.user_id = p_user_id
          AND sim.similarity_score >= p_min_similarity
          AND LOWER(sim.target_artist) != ALL(
              SELECT LOWER(unnest(p_user_artists))
          )
    ) all_artists;

    -- Update degrees for similar artists
    UPDATE ppr_scores
    SET degree = subquery.degree
    FROM (
        SELECT
            LOWER(source_artist) as artist_name,
            COUNT(*) as degree
        FROM artist_similarity_cache
        WHERE similarity_score >= p_min_similarity
          AND LOWER(source_artist) IN (SELECT artist FROM ppr_scores WHERE is_user_artist = FALSE)
        GROUP BY source_artist
    ) subquery
    WHERE ppr_scores.artist = subquery.artist_name
      AND ppr_scores.is_user_artist = FALSE;

    -- PageRank iterations
    WHILE v_iteration < p_max_iterations AND v_max_change > p_convergence_threshold LOOP
        v_iteration := v_iteration + 1;

        -- Reset new_score column
        UPDATE ppr_scores SET new_score = 0.0 WHERE artist IS NOT NULL;

        -- Propagate scores along edges (weighted by similarity)
        WITH score_propagation AS (
            SELECT
                LOWER(sim.target_artist) as target,
                SUM(
                    (scores.score * p_damping_factor * sim.similarity_score) /
                    NULLIF(sim_totals.total_similarity, 0)
                ) as propagated_score
            FROM ppr_scores scores
            JOIN artist_similarity_cache sim
                ON LOWER(scores.artist) = LOWER(sim.source_artist)
            JOIN (
                SELECT
                    LOWER(source_artist) as source,
                    SUM(similarity_score) as total_similarity
                FROM artist_similarity_cache
                WHERE similarity_score >= p_min_similarity
                GROUP BY source_artist
            ) sim_totals ON LOWER(sim.source_artist) = sim_totals.source
            WHERE sim.similarity_score >= p_min_similarity
            GROUP BY sim.target_artist
        )
        UPDATE ppr_scores
        SET new_score = COALESCE(propagated_score, 0.0)
        FROM score_propagation
        WHERE ppr_scores.artist = score_propagation.target;

        -- Add restart probability to user artists
        UPDATE ppr_scores
        SET new_score = new_score + v_restart_prob
        WHERE is_user_artist = TRUE;

        -- Calculate max change for convergence check
        SELECT MAX(ABS(new_score - score))
        INTO v_max_change
        FROM ppr_scores;

        -- Update scores for next iteration
        UPDATE ppr_scores
        SET score = new_score
        WHERE artist IS NOT NULL;
    END LOOP;

    -- Return results with degree normalization
    RETURN QUERY
    SELECT
        ppr.artist as target_artist,
        ROUND(ppr.score::numeric, 6) as ppr_score,
        ROUND((ppr.score / NULLIF(SQRT(ppr.degree), 0))::numeric, 6) as normalized_score,
        ppr.degree as node_degree,
        ARRAY(
            SELECT DISTINCT owned.artist_name
            FROM user_owned_artists owned
            JOIN artist_similarity_cache sim
                ON LOWER(owned.artist_name) = LOWER(sim.source_artist)
            WHERE owned.user_id = p_user_id
              AND LOWER(sim.target_artist) = ppr.artist
              AND sim.similarity_score >= p_min_similarity
            LIMIT 10
        ) as connected_to
    FROM ppr_scores ppr
    WHERE NOT ppr.is_user_artist
      AND ppr.score > 0.0001
    ORDER BY normalized_score DESC
    LIMIT p_max_results;
END;
$$;

-- Function: Get similarity scores for UI
CREATE OR REPLACE FUNCTION get_similarity_scores(
    p_target TEXT,
    p_sources TEXT[]
)
RETURNS TABLE (
    source_artist TEXT,
    similarity_score DECIMAL
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sim.source_artist,
        sim.similarity_score
    FROM artist_similarity_cache sim
    WHERE LOWER(sim.target_artist) = LOWER(p_target)
      AND LOWER(sim.source_artist) = ANY(
          SELECT LOWER(unnest(p_sources))
      );
END;
$$;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION personalized_pagerank_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION personalized_pagerank_recommendations TO service_role;
GRANT EXECUTE ON FUNCTION get_similarity_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_similarity_scores TO service_role;

-- =====================================================
-- VIEWS
-- =====================================================

-- View: User collection statistics
CREATE OR REPLACE VIEW user_collection_stats
WITH (security_invoker=true) AS
SELECT
  user_id,
  COUNT(*) as total_albums,
  COUNT(DISTINCT artist) as unique_artists,
  MIN(year) as oldest_album,
  MAX(year) as newest_album,
  AVG(rating) as average_rating,
  SUM(purchase_price) as total_spent
FROM albums
WHERE user_id = auth.uid()
GROUP BY user_id;

ALTER VIEW user_collection_stats SET (security_invoker=true);

-- View: User recommendation statistics
CREATE OR REPLACE VIEW user_recommendation_stats AS
SELECT
  u.user_id,
  u.artist_weight,
  u.genre_weight,
  u.era_weight,
  u.label_weight,
  u.mood_weight,
  u.popularity_weight,
  u.total_feedback,
  COUNT(DISTINCT rf.album_fingerprint) FILTER (WHERE rf.feedback_type = 'like') as total_likes,
  COUNT(DISTINCT rf.album_fingerprint) FILTER (WHERE rf.feedback_type = 'dislike') as total_dislikes,
  COUNT(DISTINCT rf.album_fingerprint) FILTER (WHERE rf.feedback_type = 'wishlist') as total_wishlist,
  COUNT(DISTINCT rc.album_fingerprint) as cached_recommendations
FROM user_weights u
LEFT JOIN recs_feedback rf ON u.user_id = rf.user_id
LEFT JOIN recs_cache rc ON u.user_id = rc.user_id AND rc.expires_at > NOW()
WHERE u.user_id = auth.uid()
GROUP BY u.user_id, u.artist_weight, u.genre_weight, u.era_weight, u.label_weight, u.mood_weight, u.popularity_weight, u.total_feedback;

ALTER VIEW user_recommendation_stats SET (security_invoker=true);

-- =====================================================
-- TABLE COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE albums IS 'Main table storing user vinyl record collections';
COMMENT ON TABLE tracks IS 'Detailed track listings for albums';
COMMENT ON TABLE recs_feedback IS 'User feedback on recommendations (likes, dislikes, etc.)';
COMMENT ON TABLE recs_cache IS 'Cached recommendation results per user (24-hour TTL)';
COMMENT ON TABLE user_weights IS 'Personalized recommendation algorithm weights per user';
COMMENT ON TABLE external_data_cache IS 'Global cache for external API responses';
COMMENT ON TABLE artist_similarity_cache IS 'Global cache for Last.fm similar artist relationships - one row per relationship';
COMMENT ON TABLE artist_metadata_cache IS 'Global cache for artist metadata from Last.fm and Spotify';
COMMENT ON TABLE user_owned_artists IS 'Links users to artists in their collection for fast querying';
COMMENT ON TABLE user_artist_recs_cache IS 'User-specific recommendation cache with 24-hour TTL';
COMMENT ON TABLE user_collection_changes IS 'Tracks collection changes for cache invalidation';

COMMENT ON FUNCTION personalized_pagerank_recommendations IS 'Generates artist recommendations using Personalized PageRank with degree normalization. Production implementation.';
COMMENT ON FUNCTION get_similarity_scores IS 'Case-insensitive lookup of similarity scores for recommendation UI.';

COMMENT ON COLUMN artist_metadata_cache.spotify_image_url IS 'High-resolution artist image URL from Spotify API';
COMMENT ON COLUMN artist_metadata_cache.spotify_id IS 'Spotify artist ID for API lookups';
COMMENT ON COLUMN artist_metadata_cache.spotify_url IS 'Spotify artist profile URL (external_urls.spotify)';

-- =====================================================
-- SCHEMA VERSION
-- =====================================================

-- Track schema version for future migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_version (version, description)
VALUES (1, 'Initial consolidated schema with all features')
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
