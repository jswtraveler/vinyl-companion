-- Update Graph-based Artist Recommendation Function for new schema
-- Works with row-per-relationship artist_similarity_cache structure
-- Adds randomization to prevent identical results every time

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
            similarity.target_artist::TEXT as current_artist,
            similarity.similarity_score * (1 - p_restart_probability) as walk_score,
            1 as depth,
            owned.artist_name::TEXT as origin_artist,
            ARRAY[owned.artist_name::TEXT, similarity.target_artist::TEXT] as path
        FROM user_owned_artists owned
        JOIN artist_similarity_cache similarity
            ON LOWER(owned.artist_name) = LOWER(similarity.source_artist)
        WHERE owned.user_id = p_user_id
          AND similarity.data_source = 'lastfm'
          AND similarity.similarity_score >= p_min_similarity
          AND LOWER(similarity.target_artist) != ALL(
              SELECT LOWER(unnest(p_user_artists))
          )

        UNION ALL

        -- Recursive case: Continue random walks through similarity graph
        SELECT
            next_sim.target_artist::TEXT as current_artist,
            walk.walk_score * next_sim.similarity_score * (1 - p_restart_probability) as walk_score,
            walk.depth + 1 as depth,
            walk.origin_artist,
            walk.path || next_sim.target_artist::TEXT as path
        FROM artist_walk walk
        JOIN artist_similarity_cache next_sim
            ON LOWER(walk.current_artist) = LOWER(next_sim.source_artist)
        WHERE walk.depth < p_max_depth
          AND next_sim.data_source = 'lastfm'
          AND next_sim.similarity_score >= p_min_similarity
          AND LOWER(next_sim.target_artist) != ALL(
              SELECT LOWER(unnest(p_user_artists))
          )
          AND next_sim.target_artist != ALL(walk.path) -- Prevent cycles
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
            ) as walk_paths,
            -- Add random component for variety
            random() as random_factor
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
    -- Mix deterministic score with randomness for variety while keeping quality high
    ORDER BY (r.graph_score * 0.7 + r.random_factor * 0.3) DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION graph_artist_recommendations IS
'Generates artist recommendations using random walk with restart algorithm over similarity graph.
Updated for row-per-relationship schema. Returns artists with mixed scoring (70% graph score, 30% random) for variety.';
