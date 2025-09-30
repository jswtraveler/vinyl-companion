# Supabase Edge Function Setup Summary

## What We Built

Created a **server-side progressive collection system** using Supabase Edge Functions to replace the client-side IndexedDB approach.

### Key Components

1. **Edge Function** (`supabase/functions/progressive-collection/index.ts`)
   - Fetches Last.fm metadata for all users' collections
   - Runs nightly at 2 AM UTC
   - Stores data in global Supabase caches
   - Processing time: ~30-40 minutes for 100 users with 1000 artists

2. **Database Migration** (`database/migrations/update_similarity_cache_structure.sql`)
   - Restructured `artist_similarity_cache`: Changed from JSONB array to one row per relationship
   - Simplified `artist_metadata_cache`: Consolidated columns into single `metadata` JSONB field
   - Added RLS policies for authenticated user writes
   - Created indexes for performance

3. **Cron Trigger** (`supabase/functions/progressive-collection/cron.sql`)
   - Scheduled daily execution using pg_cron
   - Runs at 2 AM UTC every day
   - Uses service role for authentication

4. **Documentation** (`supabase/functions/progressive-collection/README.md`)
   - Deployment instructions
   - Testing procedures
   - Monitoring queries
   - Troubleshooting guide

## How It Works

### Server-Side Flow

```
Cron trigger (2 AM UTC)
  ↓
Edge Function starts
  ↓
Query all users with albums (from user_owned_artists)
  ↓
For each user:
  For each owned artist:
    - Check similarity cache (30-day TTL)
    - If expired: fetch from Last.fm → store in artist_similarity_cache
    - Check metadata cache (14-day TTL)
    - If expired: fetch from Last.fm → store in artist_metadata_cache
  ↓
Return summary: {usersProcessed, errors}
```

### Client Integration (TODO)

The client-side code needs updating to:
1. ✅ Read from Supabase tables (already implemented in `recommendationCacheService.js`)
2. ⏳ **Update to new table structure** (needs migration)
3. ⏳ Remove or deprecate IndexedDB progressive collection service

## Current Status

✅ **Completed:**
- Edge Function implementation
- Database schema migration
- Cron scheduling setup
- Documentation and README

⏳ **Remaining Tasks:**
1. Update `recommendationCacheService.js` to match new table structure
2. Test migration on production database
3. Deploy Edge Function to Supabase
4. Set up cron trigger
5. Monitor first nightly run
6. Optionally: Deprecate client-side `ProgressiveCollectionService`

## Next Steps

### 1. Run Database Migration

```bash
# Connect to your Supabase database
psql -h db.YOUR_PROJECT_REF.supabase.co -U postgres

# Or use Supabase Dashboard → SQL Editor
```

Paste and run: `database/migrations/update_similarity_cache_structure.sql`

### 2. Deploy Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set environment variables in Supabase Dashboard
# Settings → Edge Functions → Secrets:
# - LASTFM_API_KEY: your_api_key

# Deploy function
supabase functions deploy progressive-collection
```

### 3. Set Up Cron Trigger

In Supabase Dashboard → SQL Editor, run:

```sql
SELECT cron.schedule(
    'progressive-collection-nightly',
    '0 2 * * *',
    $$
    SELECT net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/progressive-collection',
        headers:=jsonb_build_object(
            'Content-Type','application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    );
    $$
);
```

### 4. Test Manually

```bash
# Via CLI
supabase functions invoke progressive-collection

# Via HTTP
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/progressive-collection \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### 5. Monitor Results

```sql
-- Check cache growth
SELECT COUNT(*), DATE(cached_at)
FROM artist_similarity_cache
GROUP BY DATE(cached_at)
ORDER BY DATE(cached_at) DESC;

-- Check cron job status
SELECT * FROM cron.job_run_details
WHERE jobname = 'progressive-collection-nightly'
ORDER BY start_time DESC
LIMIT 10;
```

## Benefits

### Before (Client-Side IndexedDB)
- ❌ Only works when browser is open
- ❌ Different data per device
- ❌ Uses device battery/CPU
- ❌ Slower recommendations on first load
- ❌ Doesn't persist across devices

### After (Server-Side Supabase)
- ✅ Works 24/7 regardless of browser state
- ✅ Consistent data across all devices
- ✅ Zero client battery usage
- ✅ Instant recommendations (pre-cached)
- ✅ Cross-device synchronization
- ✅ Centralized monitoring and error handling

## Cost Estimate

- **Edge Function**: ~30 min/day × $0.005/min = **~$4.50/month**
- **Database storage**: <100 MB for 10K relationships = **~$0.10/month**
- **Last.fm API**: Free (within rate limits)

**Total: ~$5/month** for fully automated server-side collection

## Troubleshooting

### Edge Function Not Running

1. Check logs: `supabase functions logs progressive-collection`
2. Verify cron job: `SELECT * FROM cron.job`
3. Check service role key in function secrets

### No Data Being Cached

1. Verify RLS policies allow writes
2. Check Last.fm API key is set
3. Review function logs for API errors

### Client Still Using IndexedDB

1. Update `recommendationCacheService.js` to new schema
2. Clear browser IndexedDB cache
3. Force refresh recommendations

## Files Modified

```
vinyl-companion/
├── supabase/
│   ├── config.toml                              # New: Supabase config
│   └── functions/
│       └── progressive-collection/
│           ├── index.ts                         # New: Edge Function code
│           ├── cron.sql                         # New: Cron setup
│           └── README.md                        # New: Documentation
├── database/
│   └── migrations/
│       └── update_similarity_cache_structure.sql # New: Schema migration
└── EDGE_FUNCTION_SETUP.md                       # This file
```

## Questions?

- Edge Function docs: https://supabase.com/docs/guides/functions
- Cron jobs: https://supabase.com/docs/guides/database/extensions/pg_cron
- Last.fm API: https://www.last.fm/api
