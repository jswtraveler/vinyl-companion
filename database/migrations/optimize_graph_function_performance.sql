-- Optimize graph function to prevent timeouts
-- Reduces complexity by limiting depth to 2 and adding more aggressive pruning

CREATE OR REPLACE FUNCTION graph_artist_recommendations(
    p_user_id UUID,
    p_user_artists TEXT[],
    p_max_depth INTEGER DEFAULT 2,  -- Reduced from 3
    p_restart_probability DECIMAL DEFAULT 0.15,
    p_min_similarity DECIMAL DEFAULT 0.4,  -- Increased from 0.3 for faster queries
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
    WITH base_similarities AS (
        -- Pre-filter base case to limit search space
        SELECT
            similarity.target_artist,
            similarity.similarity_score,
            owned.artist_name as source_artist
        FROM user_owned_artists owned
        JOIN artist_similarity_cache similarity
            ON LOWER(owned.artist_name) = LOWER(similarity.source_artist)
        WHERE owned.user_id = p_user_id
          AND similarity.data_source = 'lastfm'
          AND similarity.similarity_score >= p_min_similarity
          AND LOWER(similarity.target_artist) != ALL(
              SELECT LOWER(unnest(p_user_artists))
          )
    ),
    artist_walk AS (
        -- Base case: Start random walks from filtered base
        SELECT
            base.target_artist::TEXT as current_artist,
            base.similarity_score * (1 - p_restart_probability) as walk_score,
            1 as depth,
            base.source_artist::TEXT as origin_artist,
            ARRAY[base.source_artist::TEXT, base.target_artist::TEXT] as path
        FROM base_similarities base

        UNION ALL

        -- Recursive case: Continue random walks (limited depth)
        SELECT
            next_sim.target_artist::TEXT as current_artist,
            walk.walk_score * next_sim.similarity_score * (1 - p_restart_probability) as walk_score,
            walk.depth + 1 as depth,
            walk.origin_artist,
            walk.path || next_sim.target_artist::TEXT as path
        FROM artist_walk walk
        JOIN artist_similarity_cache next_sim
            ON LOWER(walk.current_artist) = LOWER(next_sim.source_artist)
        WHERE walk.depth < LEAST(p_max_depth, 2)  -- Cap at depth 2
          AND next_sim.data_source = 'lastfm'
          AND next_sim.similarity_score >= p_min_similarity
          AND LOWER(next_sim.target_artist) != ALL(
              SELECT LOWER(unnest(p_user_artists))
          )
          AND next_sim.target_artist != ALL(walk.path) -- Prevent cycles
          AND walk.walk_score > 0.01 -- More aggressive pruning
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
        HAVING SUM(walk_score) > 0.01  -- Filter low-scoring artists early
    ),

    -- Apply random walk normalization and ranking
    ranked_recommendations AS (
        SELECT
            artist_scores.target_artist,
            artist_scores.total_score * POWER(p_restart_probability, 0.5) as graph_score,
            artist_scores.connection_breadth,
            artist_scores.connected_to,
            -- Keep top 3 walk paths for each artist
            (
                SELECT jsonb_agg(path_obj ORDER BY (path_obj->>'score')::DECIMAL DESC)
                FROM (
                    SELECT jsonb_array_elements(artist_scores.walk_paths) as path_obj
                    LIMIT 3
                ) sub
            ) as walk_paths,
            random() as random_factor
        FROM artist_scores
    )

    SELECT
        r.target_artist,
        ROUND(r.graph_score::numeric, 4) as graph_score,
        r.connection_breadth,
        r.connected_to,
        r.walk_paths
    FROM ranked_recommendations r
    -- Mix deterministic score with randomness (70% score, 30% random)
    ORDER BY (r.graph_score * 0.7 + r.random_factor * 0.3) DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION graph_artist_recommendations IS
'Optimized graph recommendations with reduced depth and aggressive pruning to prevent timeouts.
Default depth=2, min_similarity=0.4 for better performance.';
