-- Recommendation Engine Database Migration
-- Extends existing schema with recommendation-specific fields and tables

-- 1. Add recommendation fields to existing albums table
ALTER TABLE albums ADD COLUMN IF NOT EXISTS artist_mbids TEXT[];
ALTER TABLE albums ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE albums ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS normalized_artist TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS normalized_title TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS country TEXT;

-- 2. Create recommendation feedback table
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

-- 3. Create recommendation cache table
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

-- 4. Create user recommendation weights table
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

-- 5. Create external data cache table for API responses
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

-- 6. Enable Row Level Security on new tables
ALTER TABLE recs_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE recs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_data_cache ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies for recs_feedback
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

-- 8. Create RLS Policies for recs_cache
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

-- 9. Create RLS Policies for user_weights
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

-- 10. Create RLS Policies for external_data_cache (shared across users)
DROP POLICY IF EXISTS "All authenticated users can read external cache" ON external_data_cache;
CREATE POLICY "All authenticated users can read external cache"
  ON external_data_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage external cache" ON external_data_cache;
CREATE POLICY "Service role can manage external cache"
  ON external_data_cache FOR ALL
  USING (auth.role() = 'service_role');

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_albums_fingerprint ON albums(fingerprint);
CREATE INDEX IF NOT EXISTS idx_albums_normalized_artist ON albums(normalized_artist);
CREATE INDEX IF NOT EXISTS idx_albums_tags ON albums USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_albums_artist_mbids ON albums USING gin(artist_mbids);

CREATE INDEX IF NOT EXISTS idx_recs_feedback_user_id ON recs_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_recs_feedback_fingerprint ON recs_feedback(album_fingerprint);
CREATE INDEX IF NOT EXISTS idx_recs_feedback_type ON recs_feedback(feedback_type);

CREATE INDEX IF NOT EXISTS idx_recs_cache_user_id ON recs_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_recs_cache_key ON recs_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_recs_cache_expires_at ON recs_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_recs_cache_score ON recs_cache(score DESC);

CREATE INDEX IF NOT EXISTS idx_external_cache_key ON external_data_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_external_cache_expires_at ON external_data_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_external_cache_source ON external_data_cache(api_source);

-- 12. Create trigger for updated_at columns
CREATE TRIGGER update_recs_feedback_updated_at
  BEFORE UPDATE ON recs_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_weights_updated_at
  BEFORE UPDATE ON user_weights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 13. Create function to update album fingerprints
CREATE OR REPLACE FUNCTION update_album_fingerprints()
RETURNS VOID AS $$
BEGIN
  UPDATE albums
  SET
    fingerprint = LOWER(REGEXP_REPLACE(artist, '[^\w\s]', '', 'g')) || '::' || LOWER(REGEXP_REPLACE(title, '[^\w\s]', '', 'g')),
    normalized_artist = LOWER(REGEXP_REPLACE(artist, '[^\w\s]', '', 'g')),
    normalized_title = LOWER(REGEXP_REPLACE(title, '[^\w\s]', '', 'g')),
    tags = COALESCE(genre, ARRAY[]::TEXT[]) || COALESCE(moods, ARRAY[]::TEXT[])
  WHERE fingerprint IS NULL OR normalized_artist IS NULL OR normalized_title IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 14. Run initial fingerprint update for existing albums
SELECT update_album_fingerprints();

-- 15. Create trigger to auto-update fingerprints on album changes
CREATE OR REPLACE FUNCTION auto_update_album_fingerprints()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fingerprint = LOWER(REGEXP_REPLACE(NEW.artist, '[^\w\s]', '', 'g')) || '::' || LOWER(REGEXP_REPLACE(NEW.title, '[^\w\s]', '', 'g'));
  NEW.normalized_artist = LOWER(REGEXP_REPLACE(NEW.artist, '[^\w\s]', '', 'g'));
  NEW.normalized_title = LOWER(REGEXP_REPLACE(NEW.title, '[^\w\s]', '', 'g'));
  NEW.tags = COALESCE(NEW.genre, ARRAY[]::TEXT[]) || COALESCE(NEW.moods, ARRAY[]::TEXT[]);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_album_fingerprints_trigger
  BEFORE INSERT OR UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_album_fingerprints();

-- 16. Create cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql;

-- 17. Create view for user recommendation statistics
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

-- Enable security invoker for the view
ALTER VIEW user_recommendation_stats SET (security_invoker=true);