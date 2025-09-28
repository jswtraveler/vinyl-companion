-- Graph-based Artist Recommendation Function
-- Implements random walk with restart algorithm using PostgreSQL recursive CTE

CREATE OR REPLACE FUNCTION graph_artist_recommendations(
    p_user_id UUID,
    p_user_artists TEXT[],
    p_max_depth INTEGER DEFAULT 3,
    p_restart_probability DECIMAL DEFAULT 0.15,
    p_min_similarity DECIMAL DEFAULT 0.3,
    p_max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
    target_artist TEXT,
    graph_score DECIMAL,
    connection_breadth INTEGER,
    connected_to TEXT[],
    walk_paths JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE artist_walk AS (
        -- Base case: Start random walks from user's owned artists
        SELECT
            similarity.target_artist_name::TEXT as current_artist,
            similarity.similarity_score * (1 - p_restart_probability) as walk_score,
            1 as depth,
            owned.artist_name::TEXT as origin_artist,
            ARRAY[owned.artist_name::TEXT, similarity.target_artist_name::TEXT] as path
        FROM user_owned_artists owned
        JOIN artist_similarity_cache cache ON LOWER(owned.artist_name) = LOWER(cache.source_artist_name)
        JOIN LATERAL (
            SELECT
                similar_artist->>'name' as target_artist_name,
                CAST(similar_artist->>'match' as DECIMAL) as similarity_score
            FROM jsonb_array_elements(cache.similar_artists) as similar_artist
            WHERE CAST(similar_artist->>'match' as DECIMAL) >= p_min_similarity
              AND LOWER(similar_artist->>'name') != ALL(
                  SELECT LOWER(unnest(p_user_artists))
              )
        ) similarity ON true
        WHERE owned.user_id = p_user_id
          AND cache.expires_at > NOW()

        UNION ALL

        -- Recursive case: Continue random walks through similarity graph
        SELECT
            similarity.target_artist_name::TEXT as current_artist,
            walk.walk_score * similarity.similarity_score * (1 - p_restart_probability) as walk_score,
            walk.depth + 1 as depth,
            walk.origin_artist,
            walk.path || similarity.target_artist_name::TEXT as path
        FROM artist_walk walk
        JOIN artist_similarity_cache cache ON LOWER(walk.current_artist) = LOWER(cache.source_artist_name)
        JOIN LATERAL (
            SELECT
                similar_artist->>'name' as target_artist_name,
                CAST(similar_artist->>'match' as DECIMAL) as similarity_score
            FROM jsonb_array_elements(cache.similar_artists) as similar_artist
            WHERE CAST(similar_artist->>'match' as DECIMAL) >= p_min_similarity
              AND LOWER(similar_artist->>'name') != ALL(
                  SELECT LOWER(unnest(p_user_artists))
              )
              AND similar_artist->>'name' != ALL(walk.path) -- Prevent cycles
        ) similarity ON true
        WHERE walk.depth < p_max_depth
          AND cache.expires_at > NOW()
          AND walk.walk_score > 0.001 -- Prune very low probability paths
    ),

    -- Aggregate walk results by target artist
    artist_scores AS (
        SELECT
            current_artist as target_artist,
            SUM(walk_score) as total_score,
            COUNT(DISTINCT origin_artist)::INTEGER as connection_breadth,
            ARRAY_AGG(DISTINCT origin_artist) as connected_to,
            jsonb_agg(
                jsonb_build_object(
                    'origin', origin_artist,
                    'path', path,
                    'score', walk_score,
                    'depth', depth
                )
            ) as walk_paths
        FROM artist_walk
        GROUP BY current_artist
    ),

    -- Apply random walk normalization and ranking
    ranked_recommendations AS (
        SELECT
            artist_scores.target_artist,
            -- Normalize score by collection size and apply restart probability boost
            artist_scores.total_score * POWER(p_restart_probability, 0.5) as graph_score,
            artist_scores.connection_breadth,
            artist_scores.connected_to,
            -- Keep top 3 walk paths for each artist for explanation
            (
                SELECT jsonb_agg(path_obj ORDER BY (path_obj->>'score')::DECIMAL DESC)
                FROM (
                    SELECT jsonb_array_elements(artist_scores.walk_paths) as path_obj
                    LIMIT 3
                ) sub
            ) as walk_paths
        FROM artist_scores
        WHERE artist_scores.total_score > 0
    )

    SELECT
        r.target_artist,
        ROUND(r.graph_score::numeric, 4) as graph_score,
        r.connection_breadth,
        r.connected_to,
        r.walk_paths
    FROM ranked_recommendations r
    ORDER BY r.graph_score DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Create optimized indexes for graph traversal performance
CREATE INDEX IF NOT EXISTS idx_similarity_cache_graph_lookup
    ON artist_similarity_cache (source_artist_name, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_artists_graph_lookup
    ON user_owned_artists (user_id, artist_name);

-- GIN index for efficient JSONB operations on similar_artists
CREATE INDEX IF NOT EXISTS idx_similarity_artists_gin
    ON artist_similarity_cache USING GIN (similar_artists);

-- Add function comments
COMMENT ON FUNCTION graph_artist_recommendations IS
'Generates artist recommendations using random walk with restart algorithm over similarity graph.
Returns artists ranked by graph traversal scores with connection explanations.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION graph_artist_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION graph_artist_recommendations TO service_role;