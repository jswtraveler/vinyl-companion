-- Vinyl Collection Database Schema for Supabase
-- This file contains the SQL to set up the albums table and related structures

-- Enable Row Level Security (RLS) for user isolation
-- This ensures users can only see their own albums

-- 1. Create the albums table
CREATE TABLE IF NOT EXISTS albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic album information
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  year INTEGER,
  genre TEXT[], -- Array of genres
  
  -- Vinyl-specific details
  label TEXT,
  catalog_number TEXT,
  format TEXT DEFAULT 'LP', -- LP, EP, Single, etc.
  speed TEXT DEFAULT '33 RPM', -- 33 RPM, 45 RPM, 78 RPM
  size TEXT DEFAULT '12"', -- 12", 10", 7"
  
  -- Condition and ownership
  condition TEXT DEFAULT 'Near Mint', -- Mint, Near Mint, Very Good+, etc.
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  purchase_location TEXT,
  
  -- Media and identification
  cover_image_url TEXT, -- URL to cover art image
  identification_method TEXT, -- 'reverse-image-search', 'ocr', 'manual', etc.
  identification_confidence DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Metadata from APIs
  musicbrainz_id TEXT,
  discogs_id TEXT,
  spotify_id TEXT,
  
  -- User notes and tracking
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  listening_count INTEGER DEFAULT 0,
  last_played DATE,
  
  -- System fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexing for performance
  CONSTRAINT unique_user_album UNIQUE (user_id, artist, title)
);

-- 2. Create tracks table (optional, for detailed track listings)
CREATE TABLE IF NOT EXISTS tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE NOT NULL,
  track_number INTEGER NOT NULL,
  side TEXT, -- 'A', 'B', '1', '2', etc.
  title TEXT NOT NULL,
  duration INTERVAL, -- Track length
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_album_track UNIQUE (album_id, track_number, side)
);

-- 3. Enable Row Level Security
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for albums table
-- Users can only see/modify their own albums
CREATE POLICY "Users can view their own albums" 
  ON albums FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own albums" 
  ON albums FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own albums" 
  ON albums FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own albums" 
  ON albums FOR DELETE 
  USING (auth.uid() = user_id);

-- 5. Create RLS Policies for tracks table
CREATE POLICY "Users can view tracks of their albums" 
  ON tracks FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM albums 
      WHERE albums.id = tracks.album_id 
      AND albums.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tracks to their albums" 
  ON tracks FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM albums 
      WHERE albums.id = tracks.album_id 
      AND albums.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tracks of their albums" 
  ON tracks FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM albums 
      WHERE albums.id = tracks.album_id 
      AND albums.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tracks of their albums" 
  ON tracks FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM albums 
      WHERE albums.id = tracks.album_id 
      AND albums.user_id = auth.uid()
    )
  );

-- 6. Create indexes for performance
CREATE INDEX idx_albums_user_id ON albums(user_id);
CREATE INDEX idx_albums_artist ON albums(artist);
CREATE INDEX idx_albums_title ON albums(title);
CREATE INDEX idx_albums_year ON albums(year);
CREATE INDEX idx_albums_created_at ON albums(created_at);
CREATE INDEX idx_tracks_album_id ON tracks(album_id);

-- 7. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create trigger for albums table
CREATE TRIGGER update_albums_updated_at 
  BEFORE UPDATE ON albums 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Create a view for album statistics
CREATE OR REPLACE VIEW user_collection_stats AS
SELECT 
  user_id,
  COUNT(*) as total_albums,
  COUNT(DISTINCT artist) as unique_artists,
  MIN(year) as oldest_album,
  MAX(year) as newest_album,
  AVG(rating) as average_rating,
  SUM(purchase_price) as total_spent
FROM albums 
GROUP BY user_id;

-- 10. Enable realtime for live updates (optional)
-- Uncomment if you want real-time subscriptions
-- ALTER PUBLICATION supabase_realtime ADD TABLE albums;
-- ALTER PUBLICATION supabase_realtime ADD TABLE tracks;