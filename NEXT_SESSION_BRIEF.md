# Next Session Brief - Vinyl Companion

**Last Updated:** April 5, 2026

## Project Status

The app uses React 19, Vite 7, Tailwind CSS v4, Supabase, and IndexedDB with a unified database provider pattern. Major refactoring complete.

All changes committed and pushed. Supabase migrations applied.

---

## Recently Completed

- **AlbumForm refactor** — 668 → 295 lines; metadata search to `useMetadataSearch` hook, suggestions UI to `MetadataSuggestionsPanel` component (Apr 5)
- **ArtistRecommendationSection refactor** — 854 → 84 lines; pure functions to `basicRecommendations.js`, all logic to `useRecommendations` hook (Apr 5)
- **Genre filter scrolling pill bar** — replaced flex-wrap with horizontal scroll + expand/collapse toggle + fade gradient (Apr 4)
- **Genre system consolidation** — single pipeline through MusicBrainz whitelist (Apr 4)
  - `capitalizeGenre` extracted to shared `genreUtils.js`
  - `DiscogsClient` now uses `isValidGenre()` + passes `release.style` through filter; up to 5 genres
  - `validateAlbum()` no longer rejects non-MUSIC_GENRES genres
  - AlbumForm shows API-assigned genres as removable pills above the checkbox grid
- **Album Detail Modal** — whole-card click opens read-only modal (Feb 2026)
  - Cover image, title/artist/year, genre tags, mood tags, thumb status, Keep It Going panel
  - Edit button opens existing AlbumForm modal
  - "Keep it going" results open further detail modals (not edit form)
  - Click-outside to dismiss
- **Dead code cleanup** — ~3,500 lines removed (Feb 15)
- **Album Thumbs Up/Down** — toggle on AlbumCard, filter on CollectionPage, optimistic updates
- **AI Mood Analysis** — button in stats panel, Gemini API with batch processing
- **Auto-center expanded artist card** in Discover carousel
- **Supabase keep-alive** — GitHub Actions workflow pings every 5 days
- **"Keep It Going" feature** — similar album discovery from edit modal, scoring by genre/mood/era/thumbs

---

## Next Up

### 1. Album Detail Modal — Future Features

Base modal is complete. Planned enhancements:

- **Tracks** — display track listing (track number, title, duration) sourced from album data
- **Purchase info** — price, location, date added (collapsible section)
- **AI analysis summary** — show Gemini-generated description/reasoning if available
- **Swipe navigation** — swipe left/right to browse through collection from the detail modal
- **Listening stats** — play count, last listened date (if ListenBrainz integration is active)
- **Condition notes** — vinyl/sleeve condition with optional photos
- **Share** — generate a shareable image or link of the album details

---

### 2. Large Component Refactoring

#### Phase 1 — `ArtistRecommendationSection.jsx` (854 → 84 lines) ✅ COMPLETE (Apr 5)

- `applyDiversityToArtists` helper deduplicates the 3 copy-pasted diversity filter blocks
- Pure functions (`generateBasicRecommendations`, `buildArtistRecommendations`, `mergeMetadataIntoArtists`) extracted to `src/services/recommendations/basicRecommendations.js`
- All state, effects, and callbacks extracted to `src/hooks/useRecommendations.js`
- Component reduced to 84 lines: hook call + JSX render

#### Phase 2 — `AlbumForm.jsx` (668 → 295 lines) ✅ COMPLETE (Apr 5)

- Debounced search state and handlers extracted to `src/hooks/useMetadataSearch.js` — signature: `useMetadataSearch(formData, mode, onApply)`
- Suggestions UI extracted to `src/components/MetadataSuggestionsPanel.jsx` — props: `{ isLoadingSuggestions, suggestions, onSelect, onSkip }`
- Collapsible sections (Basic, Physical, Genres, Collection) left as-is — no simplification from extracting them

---

### 3. Testing

Vitest + jsdom + `@testing-library/jest-dom` are installed and configured (`vite.config.js > test`, setup file at `src/test/setup.js`). No test files exist yet.

#### What needs testing and why

The app has three distinct layers of logic, each with different risk profiles:

**Pure utility/algorithm logic** — highest value to test, zero setup cost, no mocks needed:
- `src/models/Album.js` — `validateAlbum`, `createNewAlbum`: the gatekeepers for data integrity across the whole app
- `src/utils/genreUtils.js` — `capitalizeGenre`, `getDistinctGenres`, `calculateGenreOverlap`: drives both the genre filter UI and genre-based recommendation carousels
- `src/utils/diversityFilter.js` — `applyDiversityFilter`, `getDiversityStats`: complex MMR algorithm, hard-constraint logic, and fallback name-based diversity; subtle edge cases around genre/decade thresholds
- `src/utils/albumNormalization.js` — `AlbumNormalizer.createFingerprint`, `normalizeString`, `calculateTagSimilarity`: feeds directly into Scorer and cache key generation
- `src/services/recommendations/algorithms/Scorer.js` — `scoreCandidate`, `calculateTagSimilarity`, `calculateEraFit`, `calculateArtistProximity`: the core recommendation quality gate; scoring bugs silently degrade UX

**Service logic with light mocking** — medium value, small mock surface:
- `src/services/recommendations/basicRecommendations.js` — `buildArtistRecommendations`, `mergeMetadataIntoArtists`: just extracted, pure functions, no I/O; only `buildArtistRecommendations` needs a fake `externalData` object
- `src/utils/genreUtils.js` — `getDistinctGenres` with realistic album fixtures (multi-genre albums, overlap edge cases)

**Hook logic** — lower priority, needs `renderHook` + act:
- `src/hooks/useMetadataSearch.js` — debounce timing, mode-switch reset, `onApply` callback: the debounce and mode-effect interactions are the only tricky parts

**Not worth testing now:**
- Database providers (`IndexedDBProvider`, `SupabaseProvider`) — require heavy mocking of external APIs; test value doesn't justify setup cost at this scale
- `useAlbumCollection.js` — tightly coupled to database layer; integration-level concern
- `GraphRecommender.js` — PPR algorithm is currently disabled; test when it's enabled

#### Implementation plan

All test files go in `src/test/` alongside the existing `setup.js`.

**Step 1 — `Album.test.js`** (start here: simplest, highest confidence)
- `validateAlbum`: missing title/artist, year out of range (1876, current+2), invalid format/speed/condition enum, edit mode requires id, valid album passes
- `createNewAlbum`: default fields present, overrides applied, id format matches pattern, dateAdded is ISO string

**Step 2 — `genreUtils.test.js`**
- `capitalizeGenre`: special cases (`r&b` → `R&B`, `hip-hop` → `Hip Hop`), empty string, normal title-case
- `extractGenres`: deduplicates, handles missing genre field, sorts result
- `countAlbumsByGenre`: counts multi-genre albums correctly
- `getDistinctGenres`: respects `minAlbums` threshold, rejects genres with overlap > `maxOverlap`, respects `maxGenres` cap

**Step 3 — `diversityFilter.test.js`**
- `applyDiversityFilter` with no metadata → falls back to name-based diversity, doesn't crash on empty array
- Hard constraints: >3 of same genre gets trimmed, >4 of same decade gets trimmed
- `getDiversityStats`: correct genre/decade distribution counts, `maxGenrePercentage` calculation

**Step 4 — `albumNormalization.test.js`**
- `createFingerprint`: removes "The " prefix, strips parentheticals, lowercases, throws on missing artist/title
- `normalizeString`: edge cases (all punctuation, extra whitespace, empty string)
- `calculateTagSimilarity` (if exported): Jaccard similarity with known sets

**Step 5 — `Scorer.test.js`**
Build one shared `userProfile` fixture and a `candidateAlbum` fixture, then test each sub-scorer in isolation:
- `calculateEraFit`: decade match scores higher than adjacent decade, no year data returns 0
- `calculateTagSimilarity`: full overlap = 1, no overlap = 0, partial overlap proportional
- `calculateArtistProximity`: known artist scores > unknown artist
- `scoreCandidate`: total score is capped at 1.0, `confidence` is 0 when all sub-scores are 0
- `scoreMultipleCandidates`: filters out results below `minimumScore`, returns sorted descending

**Step 6 — `basicRecommendations.test.js`**
- `mergeMetadataIntoArtists`: artist with matching metadata gets enriched fields, artist with no match gets empty metadata structure, Spotify image preferred over existing image
- `buildArtistRecommendations`: user's own artists are excluded, connection count drives breadth multiplier, result is sorted by score descending, capped at 50

**Step 7 — `useMetadataSearch.test.js`** (uses `renderHook` from `@testing-library/react`)
- Edit mode: `showSuggestions` is false, `searchAttempted` is true on mount
- `triggerSearch` debounces — fast consecutive calls only fire once (use `vi.useFakeTimers`)
- `handleSkipSuggestions` resets state to clean slate
- `onApply` callback is invoked with enriched data on suggestion select

#### Fixture strategy
Create `src/test/fixtures.js` with reusable objects:
```js
export const mockAlbum = { title: 'Rumours', artist: 'Fleetwood Mac', year: 1977, genre: ['Rock', 'Pop'], ... }
export const mockUserProfile = { artists: [...], tags: [...], eras: { decades: [...] }, preferences: { primaryGenres: [...] }, ... }
export const mockExternalData = { similarArtists: { 'Fleetwood Mac': { sourceArtist: 'Fleetwood Mac', similarArtists: [...] } } }
```

---

### 4. Security & Configuration (Supabase Dashboard)

- **Auth OTP Long Expiry** — reduce in Auth > Settings
- **Leaked Password Protection** — enable HaveIBeenPwned in Auth > Settings > Password Security
- **Postgres Version** — upgrade via Settings > General
- **API Key Rotation** — verify previously exposed keys were rotated

---

### 5. Build & Performance

- **Bundle analysis** — add `rollup-plugin-visualizer`, check lazy loading of heavy libs
- **PWA verification** — service worker, offline capabilities, cache versioning

---

## Environment Variables

| Variable | Purpose | Where |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | `.env` + Netlify |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | `.env` + Netlify |
| `VITE_GEMINI_API_KEY` | AI mood analysis (Google Gemini) | `.env` + Netlify |
| `VITE_LASTFM_API_KEY` | Last.fm tags + album info | `.env` + Netlify |
| `VITE_DISCOGS_TOKEN` | Discogs vinyl data | `.env` + Netlify |
| `VITE_LISTENBRAINZ_TOKEN` | ListenBrainz integration (optional) | `.env` + Netlify |
