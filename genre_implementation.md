# Genre Enhancement Implementation Plan

## Problem Statement

**Current State:**
- Album genres are too generic ("Rock" instead of "Progressive Rock", "Hard Rock", "Indie Rock")
- Genre data comes from Discogs search results, which often provides minimal tags
- No way to filter recommendations by genre
- Missing opportunity to discover new artists within specific genres user already enjoys

**Desired State:**
- Rich, detailed genre tags from Last.fm or MusicBrainz
- Genre-filtered recommendations (e.g., "Show me Folk recommendations based on my Folk collection")
- Automatic genre enrichment for existing and new albums
- Genre-based discovery workflows

---

## Data Source Comparison

### Last.fm Tags (Recommended)

**Pros:**
- ✅ Rich, community-driven tags with popularity scores
- ✅ Multiple tags per artist/album (15-20 tags typical)
- ✅ Includes subgenres, moods, eras (e.g., "progressive rock", "70s", "atmospheric")
- ✅ Already integrated in our system via `artist.getinfo` API
- ✅ Tags have weight/count for sorting by relevance

**Cons:**
- ❌ Some tags are non-genre (e.g., "favorite", "seen live")
- ❌ Requires filtering to genre-relevant tags only

**Example Tags for Pink Floyd:**
```json
{
  "tags": {
    "tag": [
      { "name": "Progressive rock", "count": 100 },
      { "name": "psychedelic", "count": 88 },
      { "name": "classic rock", "count": 75 },
      { "name": "70s", "count": 65 },
      { "name": "art rock", "count": 52 }
    ]
  }
}
```

### MusicBrainz Genres

**Pros:**
- ✅ Curated, canonical genre taxonomy
- ✅ More structured/consistent
- ✅ No "junk" tags

**Cons:**
- ❌ Limited genre data (many artists have 0-2 genres)
- ❌ Less granular than Last.fm
- ❌ Requires separate API calls

**Recommendation:** **Use Last.fm tags** for richness, filter to top 5 genre-like tags per album.

---

## Architecture Overview

### Phase 1: Album Genre Enrichment (Week 1)

**Goal:** Add rich genre tags to all albums in collection

#### 1.1 Database Schema Updates

**Extend `albums` table:**
```sql
ALTER TABLE albums ADD COLUMN IF NOT EXISTS genre_tags JSONB;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS primary_genre TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS genre_enriched_at TIMESTAMPTZ;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS genre_source TEXT DEFAULT 'discogs'; -- 'discogs', 'lastfm', 'musicbrainz'

-- Index for genre filtering
CREATE INDEX IF NOT EXISTS idx_albums_primary_genre ON albums(primary_genre);
CREATE INDEX IF NOT EXISTS idx_albums_genre_tags ON albums USING GIN(genre_tags);
```

**New structure:**
```javascript
{
  id: "uuid",
  title: "Dark Side of the Moon",
  artist: "Pink Floyd",

  // Old field (keep for backwards compatibility)
  genre: ["Rock"],

  // NEW: Rich genre data from Last.fm
  genre_tags: [
    { name: "Progressive Rock", weight: 100, source: "lastfm" },
    { name: "Psychedelic Rock", weight: 88, source: "lastfm" },
    { name: "Classic Rock", weight: 75, source: "lastfm" },
    { name: "Art Rock", weight: 52, source: "lastfm" }
  ],
  primary_genre: "Progressive Rock", // Highest weighted genre
  genre_enriched_at: "2024-09-30T12:00:00Z",
  genre_source: "lastfm"
}
```

#### 1.2 Last.fm Genre Fetching Service

**New Service:** `src/services/genreEnrichmentService.js`

```javascript
export class GenreEnrichmentService {
  constructor(lastfmClient, supabase) {
    this.lastfm = lastfmClient;
    this.supabase = supabase;
    this.genreKeywords = [
      'rock', 'pop', 'jazz', 'folk', 'metal', 'electronic',
      'indie', 'alternative', 'punk', 'soul', 'blues', 'country',
      'hip-hop', 'rap', 'r&b', 'reggae', 'classical', 'ambient',
      'experimental', 'progressive', 'psychedelic', 'hard', 'soft'
      // ... comprehensive genre keyword list
    ];
  }

  /**
   * Fetch genre tags from Last.fm for an album
   * Falls back to artist tags if album tags unavailable
   */
  async fetchGenreTags(artist, albumTitle) {
    // Try album.getinfo first
    let tags = await this.fetchAlbumTags(artist, albumTitle);

    // Fallback to artist.getinfo if album has no tags
    if (!tags || tags.length === 0) {
      tags = await this.fetchArtistTags(artist);
    }

    return this.filterGenreTags(tags);
  }

  /**
   * Filter tags to only genre-relevant ones
   */
  filterGenreTags(tags) {
    return tags
      .filter(tag => this.isGenreTag(tag.name))
      .sort((a, b) => b.count - a.count) // Sort by popularity
      .slice(0, 5) // Top 5 genres
      .map(tag => ({
        name: this.normalizeGenreName(tag.name),
        weight: parseInt(tag.count),
        source: 'lastfm'
      }));
  }

  /**
   * Check if a tag is genre-related (not mood/era/other)
   */
  isGenreTag(tagName) {
    const lower = tagName.toLowerCase();

    // Exclude non-genre tags
    const excludePatterns = [
      /^\d{2,4}s?$/,        // Years: "70s", "1970", "2000s"
      /favorite/i,
      /love/i,
      /seen live/i,
      /best/i,
      /top/i,
      /british/i,
      /american/i,
      /male/i,
      /female/i
    ];

    for (const pattern of excludePatterns) {
      if (pattern.test(lower)) return false;
    }

    // Include if contains genre keyword
    return this.genreKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Normalize genre names (title case, consistent naming)
   */
  normalizeGenreName(name) {
    // "progressive rock" → "Progressive Rock"
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Enrich a single album with genre data
   */
  async enrichAlbum(albumId, artist, title) {
    const genreTags = await this.fetchGenreTags(artist, title);

    if (genreTags.length === 0) {
      console.warn(`No genre tags found for ${artist} - ${title}`);
      return null;
    }

    const primaryGenre = genreTags[0].name; // Highest weighted

    // Update album in database
    const { error } = await this.supabase
      .from('albums')
      .update({
        genre_tags: genreTags,
        primary_genre: primaryGenre,
        genre_enriched_at: new Date().toISOString(),
        genre_source: 'lastfm'
      })
      .eq('id', albumId);

    if (error) {
      console.error('Failed to enrich album:', error);
      return null;
    }

    return { genreTags, primaryGenre };
  }

  /**
   * Bulk enrich all albums in collection (background job)
   */
  async enrichAllAlbums(albums, onProgress = null) {
    let processed = 0;
    const total = albums.length;

    for (const album of albums) {
      // Skip if already enriched recently (within 30 days)
      if (album.genre_enriched_at) {
        const age = Date.now() - new Date(album.genre_enriched_at).getTime();
        if (age < 30 * 24 * 60 * 60 * 1000) {
          processed++;
          continue;
        }
      }

      await this.enrichAlbum(album.id, album.artist, album.title);
      processed++;

      if (onProgress) {
        onProgress(processed, total);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { processed, total };
  }
}
```

#### 1.3 Integration Points

**When to Enrich Genres:**

1. **On Album Add (Real-time)**
   - When user adds album via search or manual entry
   - Fetch genre tags immediately after album creation
   - Show loading state while enriching

2. **Background Enrichment (Existing Albums)**
   - New component: `GenreEnrichmentStatus` (similar to `ProgressiveCollectionStatus`)
   - Shows progress: "Enriching genres... 45/120 albums"
   - Runs in idle time using `requestIdleCallback`
   - Persists progress in localStorage

3. **Server-side Enrichment (Future)**
   - Add to Edge Function: fetch genres alongside similarity data
   - Pre-populate genre_tags for all user albums nightly

---

### Phase 2: Genre-Filtered Recommendations (Week 2)

**Goal:** Generate recommendations filtered by specific genre

#### 2.1 UI/UX Design

**Collection Page Genre Filter Enhancement:**

Current:
```
[All Genres] [Rock] [Jazz] [Folk]
```

Enhanced:
```
[All Genres] [Rock (45)] [Jazz (12)] [Folk (8)]
                         ↓ (click)
              [Generate Folk Recommendations 🎵]
```

**Recommendation Section Genre Filter:**

Add genre selector above recommendations:
```
┌─────────────────────────────────────────┐
│ 🎸 Artist Recommendations               │
│                                         │
│ Genre: [All Genres ▼] [🔄 Refresh]     │
│        ├─ All Genres                    │
│        ├─ Progressive Rock (based on 8) │
│        ├─ Folk (based on 12)            │
│        └─ Jazz (based on 5)             │
└─────────────────────────────────────────┘
```

#### 2.2 Genre-Filtered Recommendation Algorithm

**New Function:** `generateGenreFilteredRecommendations(genreFilter)`

```javascript
/**
 * Generate recommendations based on albums matching specific genre
 *
 * @param {string} genreFilter - Genre to filter by (e.g., "Progressive Rock")
 * @param {Object} options - { useGraphAlgorithm, maxRecommendations }
 * @returns {Promise<Array>} Filtered recommendations
 */
async function generateGenreFilteredRecommendations(genreFilter, options = {}) {
  // Step 1: Get user's albums that match the genre
  const { data: genreAlbums } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', userId)
    .contains('genre_tags', [{ name: genreFilter }]);

  // Or use primary_genre for exact match:
  // .eq('primary_genre', genreFilter);

  console.log(`Found ${genreAlbums.length} ${genreFilter} albums`);

  // Step 2: Extract artists from genre-filtered albums
  const genreArtists = [...new Set(genreAlbums.map(a => a.artist))];

  // Step 3: Fetch similar artists for ONLY these artists
  const similarArtists = await fetchSimilarArtistsForList(genreArtists);

  // Step 4: Score and filter candidates
  const recommendations = await scoreRecommendations(similarArtists, {
    sourceArtists: genreArtists,
    ...options
  });

  // Step 5: ADDITIONAL FILTER: Only recommend artists with matching genre
  const genreFilteredRecs = await filterRecommendationsByGenre(
    recommendations,
    genreFilter
  );

  return genreFilteredRecs;
}

/**
 * Filter recommendations to only include artists with matching genre
 */
async function filterRecommendationsByGenre(recommendations, genreFilter) {
  const filtered = [];

  for (const rec of recommendations) {
    // Fetch artist metadata from cache
    const { data: artistMeta } = await supabase
      .from('artist_metadata_cache')
      .select('metadata')
      .eq('artist_name', rec.artist)
      .single();

    if (!artistMeta) {
      // No metadata yet - include by default, will be filtered later
      filtered.push(rec);
      continue;
    }

    // Check if artist has matching genre tag
    const artistTags = artistMeta.metadata?.tags || [];
    const hasGenre = artistTags.some(tag =>
      tag.name.toLowerCase().includes(genreFilter.toLowerCase()) ||
      genreFilter.toLowerCase().includes(tag.name.toLowerCase())
    );

    if (hasGenre) {
      filtered.push({
        ...rec,
        genreMatch: true,
        matchingTags: artistTags.filter(t =>
          t.name.toLowerCase().includes(genreFilter.toLowerCase())
        )
      });
    }
  }

  return filtered;
}
```

#### 2.3 UI Components

**New Component:** `GenreFilterSelector.jsx`

```javascript
const GenreFilterSelector = ({ albums, onGenreSelect, selectedGenre }) => {
  // Extract genres with album counts
  const genresWithCounts = useMemo(() => {
    const counts = {};
    albums.forEach(album => {
      const genre = album.primary_genre || album.genre?.[0];
      if (genre) {
        counts[genre] = (counts[genre] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);
  }, [albums]);

  return (
    <div className="mb-4">
      <label className="text-sm text-gray-400 mb-2 block">
        Filter Recommendations by Genre:
      </label>
      <select
        value={selectedGenre || 'all'}
        onChange={(e) => onGenreSelect(e.target.value === 'all' ? null : e.target.value)}
        className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg"
      >
        <option value="all">All Genres</option>
        {genresWithCounts.map(({ genre, count }) => (
          <option key={genre} value={genre}>
            {genre} ({count} albums)
          </option>
        ))}
      </select>
    </div>
  );
};
```

**Update `ArtistRecommendationSection.jsx`:**

```javascript
const [genreFilter, setGenreFilter] = useState(null);

// Fetch recommendations with genre filter
const recommendations = genreFilter
  ? await generateGenreFilteredRecommendations(genreFilter)
  : await generateRecommendations();

// Show genre context in recommendations
{genreFilter && (
  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
    <p className="text-sm text-purple-300">
      🎵 Showing recommendations based on your <strong>{genreFilter}</strong> collection
      ({genreAlbumCount} albums)
    </p>
  </div>
)}
```

---

## Implementation Phases

### ✅ Phase 1: Genre Enrichment (Week 1)

**Day 1-2: Database & Service**
- [ ] Run database migration (add genre_tags, primary_genre columns)
- [ ] Implement `GenreEnrichmentService`
- [ ] Add genre keyword filter list
- [ ] Test with sample albums

**Day 3-4: Auto-enrichment**
- [ ] Add genre enrichment to album add workflow
- [ ] Create `GenreEnrichmentStatus` component
- [ ] Implement background enrichment with progress tracking
- [ ] Add to ProgressiveCollectionService or create separate service

**Day 5: Collection Page Updates**
- [ ] Update genre filter to use `primary_genre` or `genre_tags`
- [ ] Show genre counts in filter buttons
- [ ] Display enriched genres in album cards (tooltip/detail view)

### ✅ Phase 2: Genre-Filtered Recommendations (Week 2)

**Day 1-2: Algorithm**
- [ ] Implement `generateGenreFilteredRecommendations()`
- [ ] Add genre matching logic to filter candidates
- [ ] Test with various genres (Rock, Folk, Jazz, etc.)

**Day 3-4: UI Components**
- [ ] Create `GenreFilterSelector` component
- [ ] Add to `ArtistRecommendationSection`
- [ ] Add genre context banner when filtered
- [ ] Update recommendation cards to show genre match badges

**Day 5: Polish**
- [ ] Add loading states for genre-filtered generation
- [ ] Add "No recommendations" state for rare genres
- [ ] Add analytics to track most used genre filters
- [ ] Documentation

---

## Edge Cases & Considerations

### Genre Tag Quality

**Problem:** Last.fm tags include non-genres ("favorite", "british", "70s")

**Solution:** Maintain comprehensive genre keyword whitelist + exclude patterns

**Fallbacks:**
1. Last.fm album tags → Last.fm artist tags → Discogs genre → Manual entry

### Albums with No Genre Data

**Options:**
1. Show as "Unknown" in genre filter
2. Exclude from genre-filtered recommendations
3. Allow manual genre assignment

### Genre Naming Inconsistencies

**Problem:** "Progressive Rock" vs "Prog Rock" vs "progressive"

**Solution:**
- Normalize all genre names to title case
- Create genre alias mapping (e.g., "Prog Rock" → "Progressive Rock")
- Use fuzzy matching for genre filters

### Performance

**Database Queries:**
- Index on `primary_genre` for fast filtering
- GIN index on `genre_tags` JSONB for advanced queries
- Cache genre counts in memory

**API Rate Limiting:**
- Respect Last.fm 1 req/sec limit
- Use existing `artist_metadata_cache` for artist tags
- Batch album enrichment with delays

---

## Success Metrics

### Genre Enrichment
- [ ] 95%+ of albums have `genre_tags` populated
- [ ] Average 3-5 genre tags per album
- [ ] Genre tags match user's subjective genre classification

### Genre-Filtered Recommendations
- [ ] Users can filter recommendations by top 10 genres
- [ ] Genre-filtered recommendations have 80%+ genre accuracy
- [ ] "Folk recommendations" actually recommend Folk artists

### User Experience
- [ ] Genre filter shows meaningful subgenres (not just "Rock")
- [ ] Genre counts help users discover collection composition
- [ ] Recommendations feel more personalized/relevant

---

## Future Enhancements

### Advanced Genre Features

1. **Genre-based Statistics**
   - Collection breakdown pie chart by genre
   - "You have 45% Rock, 20% Jazz, 15% Folk..."
   - Genre listening trends over time

2. **Multi-Genre Filtering**
   - "Progressive Rock + Psychedelic" combined filter
   - Boolean operators (AND/OR/NOT)

3. **Genre Discovery Mode**
   - "Show me genres I don't own yet but might like"
   - Cross-genre recommendations

4. **Genre Similarity Graph**
   - Visual graph of genre relationships
   - Navigate from "Folk" → "Folk Rock" → "Country Rock"

5. **Smart Genre Suggestions**
   - AI-based genre classification
   - User can correct/refine genre tags
   - Crowd-sourced genre improvements

---

## Files to Create/Modify

### New Files
- `src/services/genreEnrichmentService.js` - Genre fetching and filtering
- `src/components/GenreEnrichmentStatus.jsx` - Background enrichment UI
- `src/components/GenreFilterSelector.jsx` - Genre dropdown for recommendations
- `database/migrations/add_genre_enrichment.sql` - Schema changes

### Modified Files
- `src/pages/CollectionPage.jsx` - Use enriched genres in filter
- `src/components/ArtistRecommendationSection.jsx` - Add genre filter selector
- `src/services/recommendationService.js` - Add genre-filtered algorithm
- `src/models/Album.js` - Add genre_tags, primary_genre fields

---

## Questions to Resolve

1. **Should we keep old `genre` field for backwards compatibility?**
   - Recommendation: Yes, use as fallback if `genre_tags` is empty

2. **How to handle albums with multiple primary genres?**
   - Option A: Use highest weighted tag as primary_genre
   - Option B: Allow multiple primary genres (array)
   - Recommendation: Single primary_genre for simplicity

3. **Should genre enrichment block album add workflow?**
   - Option A: Async enrichment (add album → enrich in background)
   - Option B: Sync enrichment (wait for genres before showing album)
   - Recommendation: Async for better UX

4. **Cache strategy for genre-filtered recommendations?**
   - Cache key: `user_id + genre + collection_hash`
   - TTL: 24 hours (same as regular recommendations)
   - Invalidate on: Collection changes, manual refresh

---

## Summary

This implementation will:
1. ✅ Replace generic "Rock" with specific "Progressive Rock", "Hard Rock", etc.
2. ✅ Use Last.fm's rich tag data filtered to genre-relevant tags
3. ✅ Auto-enrich all existing albums in background
4. ✅ Enable genre-filtered recommendations ("Folk recommendations")
5. ✅ Maintain backwards compatibility with existing genre field

**Estimated Effort:** 2 weeks (1 week enrichment, 1 week filtered recs)

**Dependencies:**
- Last.fm API (already integrated)
- `artist_metadata_cache` table (already exists)
- Genre keyword filter list (to be created)
