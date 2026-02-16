# Next Session Brief - Vinyl Companion

**Last Updated:** February 16, 2026

## Project Status

The app uses React 19, Vite 7, Tailwind CSS v4, Supabase, and IndexedDB with a unified database provider pattern. Major refactoring complete. Recent work: thumbs up/down, AI mood analysis, carousel UX fix, markdown cleanup.

All changes committed and pushed. Supabase migrations applied.

---

## Completed

- **Dead code cleanup** — ~3,500 lines removed (Feb 15)
- **Album Thumbs Up/Down** — toggle on AlbumCard, filter on CollectionPage, optimistic updates (Feb 16)
- **AI Mood Analysis wired up** — button in stats panel, Gemini API with batch processing (Feb 16)
- **Auto-center expanded artist card** in Discover carousel (Feb 16)
- **Markdown cleanup** — 16 stale docs moved to `old_markdown/` (gitignored), 3 remain in root (Feb 16)
- **Supabase migrations applied** — `add_thumb_column.sql` and `fix_function_search_paths.sql` (Feb 16)
- **Supabase keep-alive** — GitHub Actions workflow pings every 5 days
- **Import paths** — all updated to canonical paths

---

## Next Up

### 1. "Keep It Going" (Similar Owned Albums)

When viewing a selected album, show similar albums from the user's own collection. Pure client-side, no API calls.

**Matching strategy:**
- Genre overlap (Jaccard similarity)
- Mood overlap (AI-generated or genre-based fallback)
- Era proximity (same decade bonus)
- Thumbs integration (boost thumbs-up, demote thumbs-down)

**Implementation:**
1. Scoring utility: `src/utils/collectionSimilarity.js`
2. UI component: `KeepItGoingPanel.jsx`
3. Wire into album detail view
4. No database changes needed

---

### 2. Large Component Refactoring

**ArtistRecommendationSection.jsx (854 lines):**
- Extract `useRecommendations` hook
- Extract modal components (metadata refresh, Spotify backfill)
- Extract genre/diversity filter logic

**AlbumForm.jsx (640 lines):**
- Extract form field groups into sub-components
- Move validation logic into separate utility

---

### 3. Testing

No unit tests exist for core logic. Vitest is installed and configured.

**Priority targets:**
- `recommendations/algorithms/Scorer.js`
- `recommendations/algorithms/GraphRecommender.js`
- `recommendations/data/CacheManager.js`
- `src/hooks/useAlbumCollection.js`
- `src/services/database/` providers

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
| `VITE_LISTENBRAINZ_TOKEN` | ListenBrainz integration (optional) | `.env` + Netlify |
