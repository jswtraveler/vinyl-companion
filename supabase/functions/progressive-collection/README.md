# Progressive Collection Edge Function

Server-side background processor for fetching Last.fm metadata for all users' vinyl collections.

## Purpose

This Edge Function runs nightly to:
1. Fetch similar artists data from Last.fm for all owned artists
2. Fetch metadata (tags, listeners, playcount) for all artists
3. Store results in global Supabase caches (`artist_similarity_cache`, `artist_metadata_cache`)
4. Enable instant recommendations across all devices

## Benefits Over Client-Side Collection

- **No browser required**: Runs independently of user sessions
- **Consistent data**: All devices get same metadata
- **No rate limiting per user**: Centralized API calls
- **Faster recommendations**: Pre-cached data ready when user opens app
- **Lower client battery usage**: No background processing on devices

## Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Link to Your Project

```bash
cd vinyl-companion
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Set Environment Variables

In Supabase Dashboard → Settings → Edge Functions → Secrets:

- `LASTFM_API_KEY`: Your Last.fm API key
- `SUPABASE_URL`: Your Supabase project URL (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (auto-set)

### 4. Deploy the Function

```bash
supabase functions deploy progressive-collection
```

### 5. Run Database Migration

Apply the schema update to restructure cache tables:

```bash
# Via Supabase Dashboard SQL Editor
psql -h db.YOUR_PROJECT_REF.supabase.co -U postgres -d postgres -f database/migrations/update_similarity_cache_structure.sql
```

Or manually run the SQL in Supabase Dashboard → SQL Editor

### 6. Set Up Scheduled Trigger

Run the cron.sql file in Supabase Dashboard → SQL Editor:

```sql
-- Update with your actual project URL
SELECT cron.schedule(
    'progressive-collection-nightly',
    '0 2 * * *',  -- 2 AM UTC daily
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

## Manual Testing

### Test via CLI

```bash
supabase functions invoke progressive-collection --no-verify-jwt
```

### Test via HTTP

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/progressive-collection \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Monitoring

### Check Function Logs

```bash
supabase functions logs progressive-collection
```

### Check Cron Jobs

```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Verify Cache Population

```sql
-- Check similarity cache growth
SELECT COUNT(*), data_source, DATE(cached_at)
FROM artist_similarity_cache
GROUP BY data_source, DATE(cached_at)
ORDER BY DATE(cached_at) DESC;

-- Check metadata cache growth
SELECT COUNT(*), DATE(cached_at)
FROM artist_metadata_cache
GROUP BY DATE(cached_at)
ORDER BY DATE(cached_at) DESC;
```

## Architecture

### Data Flow

```
1. Edge Function runs (scheduled or manual trigger)
   ↓
2. Query all users with albums (user_owned_artists)
   ↓
3. For each user's owned artists:
   a. Check if similar artists cached (< 30 days old)
   b. If not, fetch from Last.fm API
   c. Store in artist_similarity_cache (global)
   ↓
4. For each artist:
   a. Check if metadata cached (< 14 days old)
   b. If not, fetch from Last.fm API
   c. Store in artist_metadata_cache (global)
   ↓
5. Return summary: {usersProcessed, errors}
```

### Rate Limiting

- 1 second delay between API calls (Last.fm limit: 5 calls/sec)
- 1 second delay between users
- For 100 users with 10 artists each = 1000 artists
- Estimated runtime: ~30-40 minutes

### Cache TTLs

- **Similarity cache**: 30 days (artist relationships don't change often)
- **Metadata cache**: 14 days (tags/listeners update periodically)

## Client Integration

Update client code to prefer Supabase cache over IndexedDB:

```javascript
// Before: Client-side fetch
const metadata = await progressiveCollectionService.getMetadata(artistName);

// After: Server-cached fetch
const { data } = await supabase
  .from('artist_metadata_cache')
  .select('metadata')
  .eq('artist_name', artistName)
  .single();

if (data) {
  return data.metadata;
}
// Fallback to API if not cached
```

## Troubleshooting

### Function Not Running

1. Check Edge Function logs: `supabase functions logs progressive-collection`
2. Verify cron job is scheduled: `SELECT * FROM cron.job`
3. Check service role key is set in function secrets

### API Rate Limiting

If you hit Last.fm rate limits:
- Increase delay between calls (line 64: `setTimeout(resolve, 2000)`)
- Reduce number of similar artists fetched (line in Last.fm API call: `limit: '20'` → `limit: '10'`)

### No Data Being Cached

1. Verify RLS policies allow service role to write:
   ```sql
   SELECT * FROM artist_similarity_cache LIMIT 1;
   ```
2. Check for API errors in function logs
3. Verify Last.fm API key is valid

## Cost Estimation

- **Edge Function execution**: ~30 min/day × $0.005/min = $0.15/day = ~$4.50/month
- **Database storage**: Minimal (<100 MB for 10K artist relationships)
- **Last.fm API**: Free (within rate limits)

**Total**: ~$5/month for automated metadata collection

## Future Enhancements

- [ ] Prioritize active users (last login < 7 days)
- [ ] Batch process artists by popularity (popular artists first)
- [ ] Add retry logic for failed API calls
- [ ] Implement exponential backoff on errors
- [ ] Add Slack/email notifications for daily run summary
- [ ] Support for ListenBrainz as alternative data source
