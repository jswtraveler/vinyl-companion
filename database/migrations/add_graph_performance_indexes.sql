-- Add indexes to improve graph traversal performance

-- Composite index for the base case join in graph traversal
-- This speeds up: JOIN artist_similarity_cache ON source_artist = owned.artist_name
CREATE INDEX IF NOT EXISTS idx_similarity_graph_base_case
    ON artist_similarity_cache (source_artist, data_source, similarity_score)
    WHERE data_source = 'lastfm';

-- Index for recursive case joins
-- This speeds up: JOIN artist_similarity_cache ON source_artist = walk.current_artist
CREATE INDEX IF NOT EXISTS idx_similarity_graph_recursive
    ON artist_similarity_cache (source_artist, target_artist, similarity_score)
    WHERE data_source = 'lastfm';

-- Index for user owned artists lookup
CREATE INDEX IF NOT EXISTS idx_user_owned_artists_graph
    ON user_owned_artists (user_id, artist_name);

-- Partial index for high-similarity relationships (faster traversal)
CREATE INDEX IF NOT EXISTS idx_similarity_high_score
    ON artist_similarity_cache (source_artist, similarity_score DESC)
    WHERE similarity_score >= 0.3 AND data_source = 'lastfm';

COMMENT ON INDEX idx_similarity_graph_base_case IS 'Optimizes base case of graph random walk';
COMMENT ON INDEX idx_similarity_graph_recursive IS 'Optimizes recursive traversal in graph algorithm';
COMMENT ON INDEX idx_similarity_high_score IS 'Fast lookup for high-quality similarity relationships';
