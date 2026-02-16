# Next Session Brief - Vinyl Companion

**Last Updated:** February 15, 2026

## Project Status

The major codebase refactoring (7/7 tasks) is complete. The app uses React 19, Vite 7, Tailwind CSS v4, Supabase, and IndexedDB with a unified database provider pattern. Recent feature work added ListenBrainz top albums integration and artist recommendation cards.

All previous unstaged changes have been committed and pushed.

---

## ~~1. Dead Code & Stale File Cleanup~~ - DONE

All dead code removed (~3,500 lines deleted across 3 commits, Feb 15, 2026):
- Deleted 4 old recommendation service duplicates (~2,600 lines)
- Deleted 3 old database files (~800 lines), migrated AuthModal import
- Deleted 2 backward-compat shims, updated all 6 importing files (static + dynamic)
- Deleted `nul` artifact, committed SimpleCameraCapture deletion

---

## 2. Large Component Refactoring

### ArtistRecommendationSection.jsx (854 lines)

The largest component in the codebase. Handles recommendations, modals, genre filtering, diversity filtering, Spotify backfill, and metadata refresh all in one file.

**Suggested approach:**
- Extract a `useRecommendations` hook for recommendation state and fetching logic
- Extract modal components (metadata refresh, Spotify backfill) into separate files
- Extract genre/diversity filter logic into a utility or hook

### AlbumForm.jsx (640 lines)

Complex form with many fields. Could benefit from:
- Extracting form field groups into sub-components
- Moving validation logic into a separate utility

---

## 3. Testing

### No Unit Tests Exist for Core Logic

The `tests/unit/` directory has placeholder subdirectories but essentially no coverage of the refactored modules. The refactoring docs call out a "Comprehensive Test Suite" as task #8.

**Priority test targets:**
- `recommendations/algorithms/Scorer.js` - scoring correctness
- `recommendations/algorithms/GraphRecommender.js` - PageRank convergence
- `recommendations/data/CacheManager.js` - cache hit/miss/TTL
- `src/hooks/useAlbumCollection.js` - CRUD operations
- `src/services/database/` providers - provider switching, field mapping

**Infrastructure:** Vitest is already installed and configured. `npm test` runs. Test helpers and fixtures directories exist.

---

## 4. Infrastructure

### ~~Supabase Keep-Alive~~ - DONE

Added `.github/workflows/supabase-keepalive.yml` - pings Supabase every 5 days via GitHub Actions. Requires repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` to be set in GitHub repo settings.

---

## 5. Security & Configuration

### Supabase Security Warnings (from Supabase Console Linter)

~~**Function Search Path Mutable (8 functions)**~~ - **DONE.** `database/schema.sql` updated and migration script created at `database/migrations/fix_function_search_paths.sql`. **Run the migration script in Supabase SQL Editor** to apply to live database.

**Auth OTP Long Expiry** - OTP expiry is set to more than 1 hour. Reduce it in Supabase Dashboard > Auth > Settings.

**Leaked Password Protection Disabled** - Enable HaveIBeenPwned check in Supabase Dashboard > Auth > Settings > Password Security.

**Postgres Version Outdated** - Current version (17.4.1.074) has security patches available. Upgrade via Supabase Dashboard > Settings > General.

### API Key Exposure History

The `security_scan.md` (Jan 2025) flagged API keys previously committed to:
- `vite_supabase.txt`
- `netlify.toml`
- `.claude/settings.local.json`

These files are now gitignored. **Verify** that the exposed keys were rotated. If they were ever in public git history, consider rotating them if not already done.

### Environment Variable Validation

Ensure consistent behavior in `src/services/database/supabaseClient.js`: the app should gracefully fall back to IndexedDB when Supabase config is missing, not throw or silently fail.

---

## 6. Code Quality & Consistency

### ~~Import Path Inconsistencies~~ - DONE

All imports updated to canonical paths as part of dead code cleanup (Feb 15, 2026).

### Markdown Cleanup

19 markdown files in the project root. Several are outdated or one-time-use docs:
- `progress.md` (22KB) - historical progress log
- `todo_mvp_guide.md` (12KB) - original MVP planning
- `update_ui.md` (13KB) - old UI update notes
- `suggestions_genre_fixes.md` (9.6KB) - completed genre fix notes
- `RECOMMENDATION_REFACTOR_PLAN.md` (8.8KB) - completed refactor plan

**Action:** Consider moving these to an `old_markdown/` directory (already gitignored) or archiving them to reduce root clutter.

### code_refactor.md Internal Inconsistency

The bottom section of `code_refactor.md` (Priority Summary, Recommended Implementation Order, Phase 2/3 checklists) still shows tasks #2-7 as incomplete/in-progress, contradicting the top section which marks everything complete. This should be cleaned up so the document is internally consistent.

---

## 7. Build & Performance

### Bundle Analysis

No bundle analysis tooling is configured. For a PWA that should work on mobile:
- Consider adding `rollup-plugin-visualizer` to understand what's in the production bundle
- Check if the old duplicate service files are being tree-shaken or bloating the bundle
- OpenCV.js and Tesseract.js (listed in CLAUDE.md dependencies) may significantly increase bundle size if bundled rather than loaded on demand

### Service Worker / PWA

The CLAUDE.md describes PWA with service worker caching, but verify:
- Is the service worker actually configured and working?
- Are offline capabilities tested?
- Is cache versioning handled for updates?

---

## ~~8. Unstaged Changes to Review~~ - DONE

All changes committed and pushed in focused commits (Feb 15, 2026).

---

## 9. New Feature: Album Thumbs Up/Down

### Overview

Add a simple thumbs up / thumbs down toggle on each album card for quick "love it / not feeling it" feedback. Separate from the existing 1-5 star rating — the two systems coexist.

### Data Model

Add a `thumb` field to the album record:
- `null` (default) - no opinion
- `'up'` - thumbs up
- `'down'` - thumbs down

**Schema change:** Add `thumb TEXT CHECK (thumb IN ('up', 'down'))` column to the `albums` table in both Supabase and IndexedDB.

### UI

- **Album card:** Small thumbs-up and thumbs-down icons below or beside the album art. Tapping toggles on/off (tap active thumb again to clear). Active state should be visually distinct (filled icon, color change).
- **Thumbs Up list:** A filterable view showing all albums with `thumb = 'up'`. Accessible from a tab, filter button, or section on the collection page.
- **Thumbs Down list:** Same for `thumb = 'down'`.

### Implementation

1. **Database migration:** Add `thumb` column to `albums` table (Supabase ALTER + schema.sql update + IndexedDB version bump)
2. **Database provider:** Add `updateAlbumThumb(albumId, thumb)` method or use existing `updateAlbum`
3. **UI component:** Thumb toggle icons on AlbumCard (or wherever albums are displayed)
4. **Filtering:** Add thumb filter options to the collection page (All / Thumbs Up / Thumbs Down)
5. **Offline support:** Works with IndexedDB the same as Supabase

### Notes

- Keep it lightweight — no separate table needed, just a column on albums
- The existing `recs_feedback` table is for recommendation feedback on *unowned* albums; this is for *owned* albums in the collection
- Consider using the thumbs data to influence "Keep it going" results (boost thumbs-up albums in similarity ranking)

---

## 10. New Feature: "Keep It Going" (Similar Owned Albums)

### Overview

When viewing a selected album, show a "Keep it going" button that displays a list of albums from the user's own collection that are similar. For when you're listening to something and want more of the same vibe from records you already own.

### Matching Strategy: Genre + Mood

Uses only local album data (no API calls needed):
- **Genre overlap:** Score based on shared genres between the selected album and other owned albums
- **Mood overlap:** Score based on shared mood tags (from AI analysis or genre-based fallback)
- **Era proximity:** Bonus for albums from a similar year/decade
- Combined weighted score, sorted descending

### UI

- **Trigger:** "Keep it going" button on the album detail view / expanded album card
- **Display:** A slide-up panel, modal, or inline section showing top ~5-10 similar owned albums
- **Each result:** Album art, title, artist, and a brief reason (e.g., "Same genre: Indie Rock" or "Similar mood: Dreamy, Melancholic")
- **Tap a result:** Navigate to that album (or start a chain — "Keep it going" from the new album)

### Implementation

1. **Scoring utility:** Create `src/utils/collectionSimilarity.js` with a function like `findSimilarOwned(targetAlbum, allAlbums, options)` that:
   - Compares genre arrays (Jaccard similarity or overlap count)
   - Compares mood arrays (same approach)
   - Factors in year proximity (e.g., within same decade = bonus)
   - Returns sorted list with scores and match reasons
   - Excludes the target album itself
2. **UI component:** `KeepItGoingPanel.jsx` or similar, triggered from album detail view
3. **Integration:** Wire button into existing album card / detail view
4. **No database changes needed** — this is pure client-side filtering of existing album data

### Notes

- This is entirely offline-capable since it only uses data already in the local collection
- Performance should be instant for ~100 albums (no async needed)
- **Thumbs integration:** Thumbs-up albums get a score boost in "Keep it going" results, thumbs-down albums get demoted (pushed to bottom or hidden). Encourages a feedback loop where thumbing albums improves future recommendations.
- If genre/mood data is sparse on some albums, fall back to artist-name matching as a last resort

---

## 11. Fix: Auto-Center Expanded Artist Card in Discover Carousel

### Problem

When clicking "Show Top Albums" on an artist card in the Discover tab, the card expands from `w-48` to `w-80` but stays at its current scroll position. This means the expanded content can be partially off-screen or awkwardly positioned, requiring manual scrolling.

### Solution

After an artist card expands, scroll it horizontally into the center of the carousel viewport using `scrollIntoView` with smooth behavior.

### Implementation

**File:** `src/components/ArtistCarousel.jsx`

1. Add a `ref` on each `ArtistCard`'s root `<div>`
2. After toggling `expanded` to `true`, use a short `setTimeout` (to let the width transition complete) then call `cardRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })`
3. This centers the expanded card horizontally within the overflow-x carousel container without affecting vertical scroll
