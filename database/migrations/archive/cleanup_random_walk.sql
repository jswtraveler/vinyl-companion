-- Cleanup Random Walk Implementation
-- Removes old graph_artist_recommendations function and related indexes
-- Run after successful PPR migration

-- Drop old random walk function
DROP FUNCTION IF EXISTS graph_artist_recommendations(UUID, TEXT[], INTEGER, DECIMAL, DECIMAL, INTEGER);

-- Drop random walk specific indexes
DROP INDEX IF EXISTS idx_similarity_graph_base_case;
DROP INDEX IF EXISTS idx_similarity_graph_recursive;
DROP INDEX IF EXISTS idx_similarity_high_score;

-- Note: Keep these general indexes (used by PPR)
-- - idx_similarity_source
-- - idx_similarity_target
-- - idx_similarity_source_mbid
-- - idx_user_owned_artists_graph
-- - idx_similarity_ppr_lookup
-- - idx_similarity_ppr_target

COMMENT ON FUNCTION personalized_pagerank_recommendations IS
'Generates artist recommendations using Personalized PageRank with degree normalization.
Replaces deprecated graph_artist_recommendations random walk function.
Production implementation as of 2025-01.';
