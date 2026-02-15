-- =====================================================
-- FIX: Set search_path on all functions
-- =====================================================
-- Resolves Supabase linter warning: "function_search_path_mutable"
-- Run this in the Supabase SQL Editor to fix all 8 functions.
--
-- Date: 2026-02-15
-- =====================================================

-- 1. update_updated_at_column (trigger function)
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 2. auto_update_album_fingerprints (trigger function)
ALTER FUNCTION public.auto_update_album_fingerprints() SET search_path = public;

-- 3. invalidate_user_recommendation_cache (trigger function)
ALTER FUNCTION public.invalidate_user_recommendation_cache() SET search_path = public;

-- 4. cleanup_expired_cache
ALTER FUNCTION public.cleanup_expired_cache() SET search_path = public;

-- 5. cleanup_expired_caches
ALTER FUNCTION public.cleanup_expired_caches() SET search_path = public;

-- 6. personalized_pagerank_recommendations
ALTER FUNCTION public.personalized_pagerank_recommendations(UUID, TEXT[], INTEGER, DECIMAL, DECIMAL, DECIMAL, INTEGER) SET search_path = public;

-- 7. get_similarity_scores
ALTER FUNCTION public.get_similarity_scores(TEXT, TEXT[]) SET search_path = public;

-- 8. update_album_fingerprints (legacy function - may exist in live DB but not in schema.sql)
-- If this fails with "does not exist", that's fine - just means it was already cleaned up.
DO $$
BEGIN
    EXECUTE 'ALTER FUNCTION public.update_album_fingerprints() SET search_path = public';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'update_album_fingerprints does not exist - skipping';
END;
$$;
