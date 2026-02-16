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
- **"Keep It Going" feature** — similar album discovery from edit modal, scoring by genre/mood/era/thumbs (Feb 16)
- **Fix album edit click** — CollectionPage was passing `onClick` instead of `onEdit` to AlbumCard (Feb 16)

---

## Next Up

### 1. Album Detail Modal (Whole-Card Click)

Currently clicking an album card only triggers the edit pencil button. Add a whole-card click that opens a **read-only detail modal** — separate from the edit form.

**Modal contents:**
- Album cover image (large, prominent)
- Title, artist, year
- Genre tags, mood tags (if available)
- Thumbs up/down status
- "Keep it going" panel (reuse `KeepItGoingPanel.jsx`)
- Edit button → opens the existing edit form modal
- Close button / click-outside to dismiss

**Implementation:**
1. New component: `src/components/AlbumDetailModal.jsx`
2. Wire into `CollectionPage` — whole `<AlbumCard>` is clickable (not just the edit pencil)
3. AlbumCard gets an `onClick` prop for the whole card, `onEdit` stays for the pencil icon
4. From the detail modal, "Edit" opens the existing `AlbumForm` modal
5. "Keep it going" results in the detail modal also open detail modals (not the edit form)

---

### 2. Album Detail Modal — Future Features

Planned enhancements for the album detail modal once the base is in place:

- **Tracks** — display track listing (track number, title, duration) sourced from album data
- **Listening stats** — play count, last listened date (if ListenBrainz integration is active)
- **Purchase info** — price, location, date added (collapsible section)
- **AI analysis summary** — show Gemini-generated description/reasoning if available
- **Share** — generate a shareable image or link of the album details
- **Swipe navigation** — swipe left/right to browse through collection from the detail modal
- **Condition notes** — vinyl/sleeve condition with optional photos

---

### 4. Large Component Refactoring

**ArtistRecommendationSection.jsx (854 lines):**
- Extract `useRecommendations` hook
- Extract modal components (metadata refresh, Spotify backfill)
- Extract genre/diversity filter logic

**AlbumForm.jsx (640 lines):**
- Extract form field groups into sub-components
- Move validation logic into separate utility

---

### 5. Testing

No unit tests exist for core logic. Vitest is installed and configured.

**Priority targets:**
- `recommendations/algorithms/Scorer.js`
- `recommendations/algorithms/GraphRecommender.js`
- `recommendations/data/CacheManager.js`
- `src/hooks/useAlbumCollection.js`
- `src/services/database/` providers

---

### 6. Security & Configuration (Supabase Dashboard)

- **Auth OTP Long Expiry** — reduce in Auth > Settings
- **Leaked Password Protection** — enable HaveIBeenPwned in Auth > Settings > Password Security
- **Postgres Version** — upgrade via Settings > General
- **API Key Rotation** — verify previously exposed keys were rotated

---

### 7. Build & Performance

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
