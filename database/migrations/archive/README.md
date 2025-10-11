# Archived Database Migrations

This directory contains historical database migration files that have been **consolidated into the main schema**.

## ⚠️ Important Notice

**These files are for historical reference only.** They have all been merged into:
- `database/schema.sql` - The single source of truth

**Do NOT run these files on a new database.** Instead, use:
- `database/schema.sql` - Complete schema
- `database/setup.sql` - User-friendly setup script

## 📜 Migration History

These files show the evolution of the database schema:

### Phase 1: Foundation (August 2024)
- **`database-schema.sql`** - Initial schema
  - Created `albums` and `tracks` tables
  - Set up RLS policies
  - Added basic indexes

### Phase 2: Recommendation Engine (September 2024)
- **`database-recommendations-migration.sql`** - Added recommendation fields
  - Extended `albums` with fingerprints, tags, normalized fields
  - Created `recs_feedback`, `recs_cache`, `user_weights` tables
  - Added fingerprint auto-update triggers

### Phase 3: Caching Layer (September 2024)
- **`recommendation_caching_schema.sql`** - Global caching infrastructure
  - Created `artist_similarity_cache` (original JSONB structure)
  - Created `artist_metadata_cache` (original complex structure)
  - Created `user_owned_artists` for fast lookups
  - Created `user_artist_recs_cache` for 24-hour caching
  - Added cache invalidation triggers

### Phase 4: Cache Optimization (September 2024)
- **`update_similarity_cache_structure.sql`** - Restructured caches
  - Changed `artist_similarity_cache` to one-row-per-relationship
  - Simplified `artist_metadata_cache` to JSONB metadata
  - Improved query performance

### Phase 5: Spotify Integration (October 2024)
- **`add_spotify_images_to_artist_cache.sql`** - Added Spotify fields
  - Added `spotify_image_url`, `spotify_id`, `spotify_url`
  - Enhanced artist metadata display

### Phase 6: PageRank Algorithm (October 2024)
- **`personalized_pagerank_function.sql`** - Advanced recommendations
  - Implemented Personalized PageRank algorithm
  - Replaced random walk algorithm
  - Added degree normalization for diversity

- **`add_get_similarity_scores_function.sql`** - Helper function
  - Case-insensitive similarity lookups
  - UI support for showing connections

- **`cleanup_random_walk.sql`** - Removed deprecated code
  - Dropped old `graph_artist_recommendations()` function
  - Cleaned up old indexes

- **`fix_global_cache_rls_policies.sql`** - Security improvements
  - Updated RLS policies for global caches
  - Enabled user contributions to shared caches

### Phase 7: Consolidation (October 2024)
- **All migrations merged** into `database/schema.sql`
- Single source of truth established
- Historical files archived here

## 🔍 Why Consolidate?

The migration files were consolidated because:

1. **Complexity** - 9+ files to understand the schema
2. **Confusion** - Unclear what the current state is
3. **Setup difficulty** - Hard to set up fresh databases
4. **Maintenance burden** - Changes scattered across files
5. **Onboarding** - New developers had to read many files

## 📚 Using These Files

### For Historical Reference
These files are useful for:
- Understanding schema evolution
- Reviewing design decisions
- Learning from past approaches
- Debugging migration issues

### NOT for New Databases
**Do not use these files to set up a new database.**

Instead:
```bash
# Use the consolidated schema
psql -d your_db < database/schema.sql
```

Or use the Supabase SQL Editor with `database/schema.sql`.

## 🗂️ File Mapping

| Old File | Purpose | Now In Schema.sql |
|----------|---------|------------------|
| `database-schema.sql` | Base tables | ✅ Lines 10-90 |
| `database-recommendations-migration.sql` | Recommendation fields | ✅ Lines 90-180 |
| `recommendation_caching_schema.sql` | Cache tables | ✅ Lines 180-350 |
| `update_similarity_cache_structure.sql` | Cache structure | ✅ Integrated throughout |
| `add_spotify_images_to_artist_cache.sql` | Spotify fields | ✅ Lines 250-260 |
| `personalized_pagerank_function.sql` | PageRank function | ✅ Lines 700-900 |
| `add_get_similarity_scores_function.sql` | Helper function | ✅ Lines 900-920 |
| `cleanup_random_walk.sql` | Cleanup | ✅ Not needed (never included deprecated code) |
| `fix_global_cache_rls_policies.sql` | RLS policies | ✅ Lines 350-450 |

## ⚠️ Deprecation Notice

**These files are officially deprecated as of October 11, 2025.**

They are kept for:
- Historical reference
- Design documentation
- Git history

All active development uses `database/schema.sql`.

---

**Archive Created:** October 11, 2025
**Consolidated Schema Version:** 1.0
