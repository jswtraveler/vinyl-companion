# Vinyl Companion Database Documentation

This directory contains the complete database schema and setup scripts for the Vinyl Companion app.

## 📁 Files

- **`schema.sql`** - Complete, consolidated database schema (single source of truth)
- **`setup.sql`** - User-friendly setup script for new database instances
- **`README.md`** - This file
- **`migrations/`** - Historical migrations (archived for reference)

## 🚀 Quick Start

### Setting Up a New Database

1. **Create a new Supabase project** at https://supabase.com
2. **Go to SQL Editor** in your Supabase dashboard
3. **Copy the contents** of `schema.sql`
4. **Paste and run** in the SQL Editor
5. **Done!** Your database is ready

### Alternative: Use the Setup Script

If you're using the Supabase CLI or PostgreSQL:

```bash
psql -U postgres -d your_database < database/setup.sql
```

## 📊 Database Overview

### Core Tables

#### **albums**
Main table storing user vinyl record collections.

**Key fields:**
- Basic info: `title`, `artist`, `year`, `genre[]`
- Vinyl details: `format`, `speed`, `size`, `condition`
- Metadata: `musicbrainz_id`, `discogs_id`, `spotify_id`
- AI features: `moods[]`, `ai_analysis`
- Recommendation fields: `fingerprint`, `normalized_artist`, `tags[]`

#### **tracks**
Detailed track listings for albums (optional).

#### **recs_feedback**
User feedback on recommendations (likes, dislikes, wishlists).

#### **recs_cache**
Cached recommendation results per user (24-hour TTL).

#### **user_weights**
Personalized recommendation algorithm weights per user.

### Global Cache Tables (Shared Across Users)

#### **artist_similarity_cache**
Similar artist relationships from Last.fm.
- Structure: One row per artist-to-artist relationship
- Example: `Radiohead → The National (0.85)`

#### **artist_metadata_cache**
Artist metadata from Last.fm and Spotify.
- Includes: Tags, images, bio, Spotify data
- Cached for 14-30 days

#### **user_owned_artists**
Links users to artists in their collection for fast recommendation generation.

#### **user_artist_recs_cache**
User-specific cached recommendations (24-hour TTL).

## 🔒 Security

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

**User-specific tables:**
- Users can only access their own data
- Enforced via `auth.uid() = user_id` checks

**Global cache tables:**
- All authenticated users can read
- All authenticated users can write (contribute to shared cache)
- Service role has full access for background jobs

### Example Policies

```sql
-- Users can only see their own albums
CREATE POLICY "Users can view their own albums"
  ON albums FOR SELECT
  USING (auth.uid() = user_id);

-- All users can read global similarity cache
CREATE POLICY "Authenticated users can read similarity cache"
  ON artist_similarity_cache FOR SELECT
  USING (auth.role() = 'authenticated');
```

## ⚡ Performance

### Indexes

The schema includes comprehensive indexes for optimal performance:

**Standard indexes:**
- Foreign keys and primary keys
- Frequently queried columns (`user_id`, `artist`, `title`, etc.)

**GIN indexes** for array/JSONB columns:
- `albums.tags` - Array search
- `albums.genre` - Array search
- `artist_metadata_cache.metadata` - JSONB search
- `user_artist_recs_cache.recommendations` - JSONB search

**Partial indexes** for common queries:
- `WHERE similarity_score >= 0.3` for PageRank lookups
- `WHERE spotify_id IS NOT NULL` for Spotify data

### Query Performance Tips

```sql
-- Good: Uses index on normalized_artist
SELECT * FROM albums
WHERE normalized_artist = 'radiohead';

-- Good: Uses GIN index on tags
SELECT * FROM albums
WHERE 'indie' = ANY(tags);

-- Good: Uses partial index
SELECT * FROM artist_similarity_cache
WHERE source_artist = 'Radiohead'
  AND similarity_score >= 0.3;
```

## 🤖 Functions

### personalized_pagerank_recommendations()

Generates artist recommendations using Personalized PageRank algorithm.

**Usage:**
```sql
SELECT * FROM personalized_pagerank_recommendations(
  p_user_id := auth.uid(),
  p_user_artists := ARRAY['Radiohead', 'The National'],
  p_max_iterations := 20,
  p_damping_factor := 0.85,
  p_min_similarity := 0.3,
  p_max_results := 50
);
```

**Returns:**
- `target_artist` - Recommended artist name
- `ppr_score` - Raw PageRank score
- `normalized_score` - Degree-normalized score (prevents popular artists from dominating)
- `node_degree` - Number of connections artist has
- `connected_to[]` - Which of your artists connect to this recommendation

### get_similarity_scores()

Helper function for UI - gets similarity scores for display.

**Usage:**
```sql
SELECT * FROM get_similarity_scores(
  p_target := 'The National',
  p_sources := ARRAY['Radiohead', 'Arcade Fire']
);
```

### cleanup_expired_cache()

Removes expired cache entries. Run periodically via cron job.

**Usage:**
```sql
SELECT cleanup_expired_cache(); -- Returns count of deleted rows
```

### cleanup_expired_caches()

Cleans up all expired caches including user recommendation caches.

**Usage:**
```sql
SELECT cleanup_expired_caches(); -- Returns count of deleted rows
```

## 🔄 Triggers

### Auto-Update Triggers

**updated_at columns:**
- `albums.updated_at`
- `recs_feedback.updated_at`
- `user_weights.updated_at`

Automatically updated on every UPDATE.

**Album fingerprints:**
- `albums.fingerprint` - Normalized artist::title for deduplication
- `albums.normalized_artist` - Lowercase artist name
- `albums.normalized_title` - Lowercase title
- `albums.tags` - Combined genre + moods arrays

Automatically generated on INSERT/UPDATE.

### Cache Invalidation Trigger

**invalidate_user_recommendation_cache()** (optional, currently disabled)

When enabled, automatically marks user recommendation caches as stale when albums are added/removed.

To enable:
```sql
CREATE TRIGGER invalidate_recs_on_album_change
    AFTER INSERT OR UPDATE OR DELETE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_user_recommendation_cache();
```

## 📈 Views

### user_collection_stats

Statistics about a user's collection.

**Usage:**
```sql
SELECT * FROM user_collection_stats;
```

**Returns:**
- `total_albums` - Count of albums
- `unique_artists` - Count of distinct artists
- `oldest_album` - Year of oldest album
- `newest_album` - Year of newest album
- `average_rating` - Average user rating
- `total_spent` - Sum of purchase prices

### user_recommendation_stats

Statistics about recommendation usage and feedback.

**Usage:**
```sql
SELECT * FROM user_recommendation_stats;
```

**Returns:**
- Algorithm weights
- Feedback counts (likes, dislikes, wishlists)
- Cached recommendation count

## 🔧 Maintenance

### Recommended Cron Jobs

Set up these cron jobs in Supabase for optimal performance:

**1. Daily cache cleanup (2 AM)**
```sql
SELECT cron.schedule(
  'cleanup-expired-caches',
  '0 2 * * *', -- 2 AM every day
  $$ SELECT cleanup_expired_caches(); $$
);
```

**2. Weekly vacuum (Sunday 3 AM)**
```sql
SELECT cron.schedule(
  'vacuum-tables',
  '0 3 * * 0', -- 3 AM every Sunday
  $$
    VACUUM ANALYZE albums;
    VACUUM ANALYZE artist_similarity_cache;
    VACUUM ANALYZE artist_metadata_cache;
  $$
);
```

### Monitoring Queries

**Check cache hit rates:**
```sql
SELECT
  'Artist Similarity' as cache_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE cached_at > NOW() - INTERVAL '7 days') as recent_entries
FROM artist_similarity_cache
UNION ALL
SELECT
  'Artist Metadata',
  COUNT(*),
  COUNT(*) FILTER (WHERE cached_at > NOW() - INTERVAL '7 days')
FROM artist_metadata_cache;
```

**Check user activity:**
```sql
SELECT
  COUNT(DISTINCT user_id) as total_users,
  SUM(album_count) as total_albums,
  AVG(album_count) as avg_albums_per_user
FROM user_owned_artists;
```

**Check recommendation cache status:**
```sql
SELECT
  COUNT(*) as total_caches,
  COUNT(*) FILTER (WHERE is_stale = false AND expires_at > NOW()) as active_caches,
  COUNT(*) FILTER (WHERE is_stale = true) as stale_caches,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_caches
FROM user_artist_recs_cache;
```

## 🐛 Troubleshooting

### Issue: "permission denied for table albums"

**Solution:** Ensure RLS policies are created and user is authenticated.

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'albums';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'albums';
```

### Issue: "could not find similar artists"

**Solution:** Populate artist_similarity_cache using the progressive collection service or manually via Last.fm API.

```sql
-- Check if cache has data
SELECT COUNT(*) FROM artist_similarity_cache;

-- Check for specific artist
SELECT * FROM artist_similarity_cache
WHERE source_artist ILIKE '%radiohead%';
```

### Issue: Slow recommendation queries

**Solution:** Ensure indexes are created and similarity cache is populated.

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'artist_similarity_cache'
ORDER BY idx_scan DESC;

-- Analyze tables
ANALYZE artist_similarity_cache;
ANALYZE user_owned_artists;
```

## 📚 Additional Resources

- **Supabase Documentation:** https://supabase.com/docs
- **PostgreSQL Documentation:** https://www.postgresql.org/docs/
- **Row Level Security Guide:** https://supabase.com/docs/guides/auth/row-level-security

## 🔄 Migration History

All previous migrations have been consolidated into `schema.sql`. Historical migration files are preserved in `migrations/archive/` for reference.

### Migration Timeline

1. **Initial Schema** - Albums and tracks tables
2. **Recommendation Fields** - Added fingerprints and tags
3. **Caching Layer** - Global cache tables
4. **Cache Restructure** - One-row-per-relationship model
5. **Spotify Integration** - Added Spotify image fields
6. **PageRank Algorithm** - Personalized PageRank function
7. **Consolidation** - All merged into single schema (current)

## 🆘 Getting Help

- **Issues:** Create an issue in the GitHub repository
- **Documentation:** See project README and code comments
- **Supabase Support:** https://supabase.com/support

---

**Last Updated:** October 11, 2025
**Schema Version:** 1.0
