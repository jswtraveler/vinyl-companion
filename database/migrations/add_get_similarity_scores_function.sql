-- Helper function for case-insensitive similarity score lookup
-- Used by PPR recommendation UI to show connection percentages

CREATE OR REPLACE FUNCTION get_similarity_scores(
    p_target TEXT,
    p_sources TEXT[]
)
RETURNS TABLE (
    source_artist TEXT,
    similarity_score DECIMAL
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_similarity_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_similarity_scores TO service_role;

COMMENT ON FUNCTION get_similarity_scores IS
'Case-insensitive lookup of similarity scores for recommendation UI.
Returns similarity scores for edges from p_sources to p_target.';
