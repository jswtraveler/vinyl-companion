-- Personalized PageRank with Degree Normalization
-- Replaces graph_artist_recommendations() random walk algorithm
-- Provides faster, more stable, and diverse recommendations

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
) AS $$
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
        -- User owned artists (from database table - requires authentication)
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
            0 as degree -- Will be updated below
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

        -- Reset new_score column (WHERE clause required by Supabase)
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
                -- Calculate sum of similarities for each source (for normalization)
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

        -- Update scores for next iteration (WHERE clause required by Supabase)
        UPDATE ppr_scores
        SET score = new_score
        WHERE artist IS NOT NULL;
    END LOOP;

    -- Return results with degree normalization
    RETURN QUERY
    SELECT
        ppr.artist as target_artist,
        ROUND(ppr.score::numeric, 6) as ppr_score,
        -- Degree normalization: favor less-connected artists
        ROUND((ppr.score / NULLIF(SQRT(ppr.degree), 0))::numeric, 6) as normalized_score,
        ppr.degree as node_degree,
        -- Find which user artists connect to this recommendation
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
      AND ppr.score > 0.0001  -- Filter very low scores
    ORDER BY normalized_score DESC
    LIMIT p_max_results;

    -- Cleanup happens automatically with ON COMMIT DROP
END;
$$ LANGUAGE plpgsql;

-- Create optimized indexes for PPR (different from random walk)
CREATE INDEX IF NOT EXISTS idx_similarity_ppr_lookup
    ON artist_similarity_cache (source_artist, similarity_score DESC)
    WHERE similarity_score >= 0.3;

CREATE INDEX IF NOT EXISTS idx_similarity_ppr_target
    ON artist_similarity_cache (target_artist, similarity_score DESC)
    WHERE similarity_score >= 0.3;

-- Grant permissions
GRANT EXECUTE ON FUNCTION personalized_pagerank_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION personalized_pagerank_recommendations TO service_role;

-- Add function comment
COMMENT ON FUNCTION personalized_pagerank_recommendations IS
'Generates artist recommendations using Personalized PageRank with degree normalization.
Converges in 15-20 iterations, provides stable deterministic results, and surfaces diverse recommendations.
Replaces random walk algorithm for better performance and timeout prevention.';
