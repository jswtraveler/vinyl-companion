-- Add Spotify image URL columns to artist_metadata_cache table
-- This allows persistent storage of Spotify artist images

-- Add spotify_image_url column to store the high-resolution artist image from Spotify
ALTER TABLE artist_metadata_cache
ADD COLUMN IF NOT EXISTS spotify_image_url TEXT;

-- Add spotify_id column to store the Spotify artist ID for future API calls
ALTER TABLE artist_metadata_cache
ADD COLUMN IF NOT EXISTS spotify_id TEXT;

-- Add spotify_url column to store the Spotify artist profile URL
ALTER TABLE artist_metadata_cache
ADD COLUMN IF NOT EXISTS spotify_url TEXT;

-- Add index on spotify_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_artist_metadata_cache_spotify_id
ON artist_metadata_cache(spotify_id);

-- Add comment to document the columns
COMMENT ON COLUMN artist_metadata_cache.spotify_image_url IS 'High-resolution artist image URL from Spotify API';
COMMENT ON COLUMN artist_metadata_cache.spotify_id IS 'Spotify artist ID for API lookups';
COMMENT ON COLUMN artist_metadata_cache.spotify_url IS 'Spotify artist profile URL (external_urls.spotify)';
