# Feature: Mood Playlists ("Vibes")

An implementation plan for adding **mood-based playlist suggestions** to the Vinyl Companion PWA.
Playlists are generated entirely from albums the user already owns. Each "mood" (e.g. _Lazy
Sunday_, _Dance Party_) resolves to a curated, ordered list of records from the collection.

> **Audience:** This document is written to be handed to Claude Sonnet for implementation. It
> assumes the existing codebase (see `## Existing infrastructure`). Follow the phases in order.
> Prompts to give Sonnet at each phase are in the `> PROMPT` callouts.

---

## 1. Product overview

### The idea
The user opens a new **Vibes** tab, sees a scrollable shelf of mood cards ("Lazy Sunday", "Dance
Party", "Late Night Drive", …). Tapping a card generates a playlist — an ordered set of records
drawn from their own collection that fit that mood — which they can then browse, shuffle, tweak,
save, and pull off the shelf to actually play.

Because this app tracks _physical vinyl_ (there is no audio playback), a "playlist" here is a
**listening queue / side-planner**: an ordered stack of records to spin, sized to fit a session
(e.g. "~90 minutes", "5 records"). This is the key reframing that makes the feature fit a vinyl
app rather than a streaming app.

### Why it fits this app
- Albums already carry a `moods: string[]` array, populated by the existing Gemini AI analysis
  flow, with a genre-based fallback in `moodUtils.js`. **The hard part (tagging) is already done.**
- `moodUtils.js` already exposes `filterAlbumsByMood`, `getRecommendedAlbumsForMood`, and
  `getMoodStatistics`. This feature is largely a **new UI layer + a smarter playlist builder** on
  top of primitives that exist.
- The app is offline-first (IndexedDB), so playlists must be generated **client-side with no
  network dependency**. Everything here is local computation.

### User stories
1. As a collector, I want to pick a mood and get a ready-to-spin stack of my own records, so I
   don't have to decide what to play.
2. As a collector, I want the playlist sized to my session ("a couple records" vs "all afternoon"),
   so it matches how long I want to listen.
3. As a collector, I want to reshuffle or swap out a record I'm not feeling, so the list stays mine.
4. As a collector, I want to save a playlist I liked and come back to it later.
5. As a collector, I want to see _why_ a record was picked (which mood tags it matched), so the
   suggestions feel trustworthy.

### Non-goals (explicitly out of scope for v1)
- No audio playback / streaming integration.
- No cross-device sync of saved playlists beyond what the existing DB layer already gives us
  (saved playlists ride on the same IndexedDB/Supabase provider).
- No social sharing / export of playlists (can be a v2).
- No new AI calls at playlist-generation time — generation is deterministic + local. (AI is only
  used, as today, to _tag_ albums with moods ahead of time.)

---

## 2. Existing infrastructure (read before coding)

| Thing | Location | Notes |
|---|---|---|
| Album model | `src/models/Album.js` | Albums have `genre[]`, `moods[]` (added at runtime), `tracks[]`, `year`, `coverImage`, `thumb`. |
| Mood utilities | `src/utils/moodUtils.js` | `MOOD_CATEGORIES`, `getMoodsForAlbum`, `filterAlbumsByMood`, `getRecommendedAlbumsForMood`, `getMoodStatistics`. |
| AI mood tagging | `src/services/api/ai/GeminiClient.js` + `src/components/AIAnalysisModal.jsx` | Writes `album.moods`. Reachable today from the Collection page via `onOpenAIAnalysis`. |
| Orphaned prototype | `src/components/SuggestionsSection.jsx` | An early, unwired version of this idea using **old Tailwind v3 classes**. **Do not extend it** — it does not match the current design system. Use it only as reference for the filter-chip interaction, then delete it in the final phase. |
| Navigation | `src/components/navigation/BottomTabBar.jsx`, `src/App.jsx` (`currentTab` state, `renderPage()`) | Tabs are kept mounted and toggled via `display`. |
| Pages | `src/pages/CollectionPage.jsx`, `DiscoverPage.jsx`, `AddAlbumPage.jsx` | Use **CSS-variable inline styles**, not Tailwind classes. |
| DB layer | `src/services/database/` (`DatabaseInterface`, `IndexedDBProvider`, `SupabaseProvider`, `MockProvider`) | Provider pattern. Add playlist persistence here. |
| Album updates | `src/App.jsx` `handleUpdateAlbum`, `useAlbumCollection` hook | Use for writing `moods` back if needed. |

### ⚠️ Design system rules (must follow — see `CLAUDE.md`)
- **Tailwind is v4.** The newer pages **do not use Tailwind utility classes at all** — they use
  inline `style={{}}` objects referencing CSS custom properties. **Match this.** Do NOT write
  `className="bg-gray-800 rounded-lg"` like the orphaned `SuggestionsSection`.
- Theme tokens (from `src/index.css`): `--color-bg #111010`, `--color-surface #1a1917`,
  `--color-surface2`, `--color-surface3`, `--color-border`, `--color-border2`,
  `--color-text #f0ece4`, `--color-text-muted`, `--color-text-dim`, and the accent
  `--color-amber #e8a040` (+ `--color-amber-dim`, `--color-amber-glow`, `--color-groove`).
- Fonts: `var(--font-display)` for headings.
- Reusable classes that already exist: `.btn-outline`, `.sort-dropdown`, `.sort-option`,
  `.wordmark`, `.bottom-nav`. Prefer these where they fit.
- Border radius in this app is small (2–4px), not the rounded-`lg` look of the prototype.

---

## 3. Data model additions

### 3.1 Mood definitions (`src/data/moodPlaylists.js` — NEW)
The existing `MOOD_CATEGORIES` in `moodUtils.js` has 12 short mood IDs used by the AI tagger. This
feature needs **richer playlist definitions** layered on top: a display name, subtitle, emoji/icon,
accent color, and a **rule** describing which albums qualify and how to order them.

A playlist definition maps to one or more of the underlying mood IDs (and optionally genres / year
ranges / energy), so we reuse the AI tags rather than inventing a parallel tagging system.

```js
// src/data/moodPlaylists.js

/**
 * A MoodPlaylist is a curated "vibe" the user can generate from their own collection.
 * It resolves to albums via `match`, then orders them via `order`.
 *
 * match: {
 *   moods?:   string[]   // any of these underlying mood IDs (from moodUtils MOOD_CATEGORIES) qualifies
 *   genres?:  string[]   // any of these genres qualifies (case-insensitive substring match)
 *   yearMax?: number     // album.year <= yearMax
 *   yearMin?: number     // album.year >= yearMin
 *   requireAll?: boolean // if true, album must match moods AND genres (default: OR across all clauses)
 * }
 * order: 'energy-asc' | 'energy-desc' | 'shuffle' | 'newest' | 'oldest' | 'chronological'
 * targetMinutes / targetCount handled by the builder, not here.
 */
export const MOOD_PLAYLISTS = [
  {
    id: 'lazy-sunday',
    name: 'Lazy Sunday',
    subtitle: 'Slow, warm, unhurried',
    emoji: '☕',
    color: '#c8863a',
    match: { moods: ['sunday_morning', 'chill', 'comfort'], genres: ['Jazz', 'Folk', 'Soul'] },
    order: 'energy-asc'
  },
  // ... (full list of 20+ in §7)
];

export const getMoodPlaylistById = (id) => MOOD_PLAYLISTS.find(p => p.id === id) || null;
```

### 3.2 Energy score helper
Ordering ("build up energy", "wind down") needs a per-album **energy score** (0–1). Derive it
locally — no network — from moods + genre. Add to `moodUtils.js` (see §4.2).

### 3.3 Saved playlists (persisted)
A saved playlist the user snapshotted:

```js
// shape stored in DB
{
  id: 'playlist_<ts>_<rand>',
  name: 'Lazy Sunday',
  moodId: 'lazy-sunday',   // source mood, or null for a fully custom one
  albumIds: ['album_...','album_...'],  // ordered
  createdAt: '2026-07-31T...Z',
  note: ''                 // optional user note
}
```

Persisted through the existing DB provider pattern (see §5).

---

## 4. Core logic: the playlist builder

### 4.1 New service `src/services/playlists/playlistBuilder.js`
Pure functions, fully unit-testable, **no React, no network**.

```js
import { getMoodsForAlbum } from '../../utils/moodUtils.js';
import { getAlbumEnergy, estimateAlbumMinutes } from '../../utils/moodUtils.js';

/**
 * Return true if an album satisfies a mood playlist's match rule.
 */
export function albumMatchesRule(album, match) {
  if (!album || !match) return false;
  const albumMoods = getMoodsForAlbum(album);                       // reuse existing logic
  const albumGenres = (album.genre || []).map(g => g.toLowerCase());

  const moodHit = match.moods?.length
    ? match.moods.some(m => albumMoods.includes(m))
    : null;
  const genreHit = match.genres?.length
    ? match.genres.some(g => albumGenres.some(ag => ag.includes(g.toLowerCase())))
    : null;
  const yearHit =
    (match.yearMax == null || (album.year && album.year <= match.yearMax)) &&
    (match.yearMin == null || (album.year && album.year >= match.yearMin));

  if (!yearHit) return false;

  const clauses = [moodHit, genreHit].filter(v => v !== null);
  if (clauses.length === 0) return true;                            // only a year filter → matches
  return match.requireAll ? clauses.every(Boolean) : clauses.some(Boolean);
}

/**
 * Score how well an album fits — used for ranking before we trim to size.
 * More matched mood tags = stronger fit; AI-tagged albums (album.moods present) get a small boost.
 */
export function scoreAlbumForRule(album, match) {
  const albumMoods = getMoodsForAlbum(album);
  const moodMatches = (match.moods || []).filter(m => albumMoods.includes(m)).length;
  const aiBoost = Array.isArray(album.moods) && album.moods.length > 0 ? 0.5 : 0;
  return moodMatches + aiBoost;
}

/**
 * Order a list of albums per the playlist's `order` strategy.
 * `seed` makes shuffle deterministic per session so re-renders don't reshuffle.
 */
export function orderAlbums(albums, order, seed = 1) {
  const withEnergy = albums.map(a => ({ a, e: getAlbumEnergy(a) }));
  switch (order) {
    case 'energy-asc':   return withEnergy.sort((x, y) => x.e - y.e).map(x => x.a);
    case 'energy-desc':  return withEnergy.sort((x, y) => y.e - x.e).map(x => x.a);
    case 'newest':       return [...albums].sort((x, y) => (y.year || 0) - (x.year || 0));
    case 'oldest':       return [...albums].sort((x, y) => (x.year || 9999) - (y.year || 9999));
    case 'chronological':return [...albums].sort((x, y) => (x.year || 0) - (y.year || 0));
    case 'shuffle':
    default:             return seededShuffle(albums, seed);
  }
}

/** Mulberry32-seeded Fisher–Yates so the same seed → same order. */
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * MAIN ENTRY. Build a playlist from the collection for a given mood definition.
 * @param {Object[]} albums
 * @param {Object}   playlistDef  one of MOOD_PLAYLISTS
 * @param {Object}   opts { targetMinutes?, targetCount?, seed? }
 * @returns {{ albums, totalMinutes, moodId, reason }}
 */
export function buildPlaylist(albums, playlistDef, opts = {}) {
  const { targetMinutes = null, targetCount = 6, seed = 1 } = opts;

  const candidates = (albums || [])
    .filter(a => albumMatchesRule(a, playlistDef.match))
    .map(a => ({ album: a, score: scoreAlbumForRule(a, playlistDef.match) }))
    .sort((x, y) => y.score - x.score)
    .map(x => x.album);

  // Trim to target BEFORE ordering so ordering applies to the chosen set.
  let chosen;
  if (targetMinutes) {
    chosen = [];
    let mins = 0;
    for (const alb of candidates) {
      if (mins >= targetMinutes && chosen.length >= 2) break;
      chosen.push(alb);
      mins += estimateAlbumMinutes(alb);
    }
  } else {
    chosen = candidates.slice(0, targetCount);
  }

  const ordered = orderAlbums(chosen, playlistDef.order, seed);
  const totalMinutes = ordered.reduce((sum, a) => sum + estimateAlbumMinutes(a), 0);

  return {
    moodId: playlistDef.id,
    albums: ordered,
    totalMinutes,
    reason: buildReason(playlistDef, candidates.length)
  };
}

function buildReason(def, count) {
  if (count === 0) return `No records in your collection match “${def.name}” yet.`;
  return `${count} record${count === 1 ? '' : 's'} in your collection fit ${def.name}.`;
}
```

### 4.2 Additions to `src/utils/moodUtils.js`
Add two exported helpers (keep everything else intact):

```js
// Energy weighting per mood id (0 = calm, 1 = high energy).
const MOOD_ENERGY = {
  chill: 0.15, sunday_morning: 0.2, comfort: 0.3, dreamy: 0.25, melancholic: 0.3,
  bluesy: 0.35, nostalgic: 0.45, late_night: 0.4, epic: 0.5, road_trip: 0.6,
  upbeat: 0.75, raw: 0.7, energetic: 0.9, party: 0.95
};

/** 0–1 energy estimate for an album from its (AI or genre-derived) moods. */
export const getAlbumEnergy = (album) => {
  const moods = getMoodsForAlbum(album);
  if (!moods.length) return 0.5; // neutral default
  const vals = moods.map(m => MOOD_ENERGY[m]).filter(v => v != null);
  if (!vals.length) return 0.5;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
};

/** Estimate an album's runtime in minutes. Uses track durations if present, else a 40-min LP default. */
export const estimateAlbumMinutes = (album) => {
  const tracks = album?.tracks || [];
  const summed = tracks.reduce((sum, t) => {
    if (!t?.duration) return sum;
    const [m, s] = String(t.duration).split(':').map(Number);
    if (Number.isFinite(m)) return sum + m + (Number.isFinite(s) ? s / 60 : 0);
    return sum;
  }, 0);
  if (summed > 0) return Math.round(summed);
  // Fallback by format
  if (album?.format === 'Single') return 8;
  if (album?.format === 'EP') return 20;
  return 40; // typical LP
};
```

> Rationale: reusing `getMoodsForAlbum` means energy + matching automatically benefit from both AI
> tags and the genre fallback, with zero new tagging work.

### 4.3 Session-size presets
```js
// src/data/sessionSizes.js
export const SESSION_SIZES = [
  { id: 'quick',     label: 'A couple records', targetCount: 3, targetMinutes: null },
  { id: 'session',   label: 'A listening session', targetCount: null, targetMinutes: 90 },
  { id: 'afternoon', label: 'All afternoon',     targetCount: null, targetMinutes: 180 },
  { id: 'everything',label: 'Everything that fits', targetCount: 999, targetMinutes: null }
];
```

---

## 5. Persistence: saved playlists

Extend the DB provider pattern rather than touching IndexedDB directly in components.

### 5.1 `DatabaseInterface.js`
Add abstract methods: `getPlaylists()`, `savePlaylist(playlist)`, `deletePlaylist(id)`.

### 5.2 `IndexedDBProvider.js`
- Bump the DB version and add an object store `playlists` (keyPath `id`) in the `upgrade` callback.
  **Follow the existing versioning/upgrade pattern already in this file — read it first and mirror
  it. Do not drop existing stores.**
- Implement the three methods with the same idb usage style as the `albums` store.

### 5.3 `SupabaseProvider.js`
- Add a `playlists` table (SQL migration in `supabase/`). Columns: `id text pk`, `user_id`,
  `name`, `mood_id`, `album_ids jsonb`, `note`, `created_at`. Mirror the existing albums RLS
  policies (user owns their rows).
- Implement the three methods analogously to the album methods.

### 5.4 `MockProvider.js`
- In-memory array; implement the three methods for tests/local dev.

### 5.5 Hook `src/hooks/usePlaylists.js` (NEW)
Mirror the shape of `useAlbumCollection`: expose `playlists`, `loading`, `savePlaylist`,
`deletePlaylist`, `loadPlaylists`. Uses `Database` from `src/services/database/index.js` so it
transparently follows local-vs-cloud selection.

> **Keep v1 shippable without persistence if needed:** the Vibes tab works fully with generated
> (unsaved) playlists. Saving is additive. If time-boxed, implement §4 + §6 first, then §5.

---

## 6. UI

### 6.1 New tab wiring (`src/App.jsx` + `BottomTabBar.jsx`)
1. Add a `vibes` tab to the `tabs` array in `BottomTabBar.jsx` between `discover` and `add`. Icon:
   a simple headphones or waveform SVG (stroke style matching the others, `strokeWidth 1.75`).
2. In `App.jsx` `renderPage()`, add a `<div style={{ display: currentTab === 'vibes' ? 'block' : 'none' }}>`
   wrapping `<VibesPage albums={albums} user={user} useCloudDatabase={useCloudDatabase} />`.
3. Import the new page.

### 6.2 `src/pages/VibesPage.jsx` (NEW)
Follows `DiscoverPage.jsx` conventions exactly (inline styles, CSS vars, `paddingBottom: 80` for
the nav, `var(--font-display)` header).

Structure:
- **Header**: "Vibes" + subtitle "Playlists built from records you own."
- **Empty state** (when `albums.length < 5`): mirror DiscoverPage's empty card ("Add a few more
  records and we'll build playlists from your collection.").
- **Mood shelf**: horizontally scrollable row of `MoodCard`s (one per `MOOD_PLAYLISTS` entry). Show
  a small count badge = number of matching records (compute with `albumMatchesRule`). Grey out /
  de-emphasize cards with 0 matches but keep them visible.
- **Session-size selector**: a segmented control (chips) bound to `SESSION_SIZES`, default
  `session` (90 min). Reuse the filter-chip visual from the existing `.btn-outline`/active-chip
  pattern.
- On mood card tap → open `PlaylistView` (in-page panel or modal) for that mood.
- **Saved playlists** section below the shelf (if `usePlaylists` is implemented): list of saved
  playlist rows, tap to reopen.

### 6.3 `src/components/vibes/MoodCard.jsx` (NEW)
A card ~150×150–170px: emoji/icon top-left, `name` in `var(--font-display)`, `subtitle` in
`--color-text-muted`, and a footer "N records". Background `--color-surface2`, `1px solid
--color-border`, radius 4. On the mood's accent color, apply a subtle left border or glow using
the def's `color`. Hover: border → `--color-amber-dim`.

### 6.4 `src/components/vibes/PlaylistView.jsx` (NEW)
The generated playlist. Given `{ mood, albums, sessionSize }`:
- Call `buildPlaylist(albums, mood, { ...sizeOpts, seed })`. Keep `seed` in state so re-renders are
  stable; **Reshuffle** button increments the seed.
- Header: mood name, total runtime ("~92 min · 6 records"), and controls: **Reshuffle**,
  **Save** (if persistence in), **Close**.
- Ordered list of records as `PlaylistRow`s: index number ("1", "2", …), thumb (`album.thumb ||
  album.coverImage`), title, artist, est. minutes, and a small **⋯** menu with **Remove** and
  **Swap** (swap = replace this slot with the next-best unused candidate for the mood).
- Reordering: v1 can skip drag-and-drop; provide up/down arrows on each row (cheap, mobile-safe).
- "Why these?" affordance: tapping a row shows the matched mood tags for that album
  (`getMoodsForAlbum` ∩ `mood.match.moods`).
- Tapping a row's cover opens the existing `AlbumDetailModal` (reuse — pass the album through).

### 6.5 Empty / thin-collection handling
- If a mood yields **0** records: show the mood's `reason` string plus a nudge: "Tag more albums to
  unlock this — run **AI Mood Analysis** from your Collection." Link that to the existing
  `onOpenAIAnalysis` path (thread a callback down, or route the user to the Collection tab).
- If a mood yields **1–2** records: still show them; note "Only a couple fit right now."

### 6.6 Cleanup
Delete the orphaned `src/components/SuggestionsSection.jsx` (superseded). Grep for imports first
(there are none in the wired app, but confirm).

---

## 7. The mood/playlist catalog (22 ideas — tuned to this collection)

Fill `MOOD_PLAYLISTS` in `src/data/moodPlaylists.js` with these. `match.moods` values must be IDs
from `MOOD_CATEGORIES` in `moodUtils.js` (`nostalgic, energetic, chill, upbeat, melancholic,
road_trip, late_night, sunday_morning, dreamy, raw, comfort, party, epic, bluesy`). Genres are
matched case-insensitively as substrings, so `'Rock'` also catches `'Classic Rock'`, `'Hard Rock'`,
`'Blues Rock'`, etc.

> **This catalog is tuned to the owner's actual collection** (~69 records, analyzed from
> `albums_rows.csv`): ~70% classic/prog/hard rock centered on the **1970s** (median year 1976),
> with a jazz/blues/soul side (~19 records) and small folk/psychedelic pockets. Genres like disco,
> house, hip-hop, and pop are essentially absent, so the earlier draft's dance/electronic playlists
> were removed or re-scoped. **Every playlist below resolves to real records in this collection.**
> Two aspirational-but-thin ones are marked ⚠ — they work now but stay small until the collection
> grows.

| # | id | Name | Emoji | Matches (moods / genres / years) | Order |
|---|---|---|---|---|---|
| 1 | `lazy-sunday` | Lazy Sunday | ☕ | moods: sunday_morning, chill, comfort · genres: Jazz, Folk, Soul, Blues | energy-asc |
| 2 | `prog-journey` | Prog Journey | 🌌 | moods: epic, dreamy · genres: Progressive Rock, Psychedelic Rock | shuffle |
| 3 | `full-volume` | Full Volume | 🔊 | moods: energetic, raw · genres: Hard Rock, Heavy Metal, Metal | energy-desc |
| 4 | `open-road` | Open Road | 🛣️ | moods: road_trip · genres: Rock, Classic Rock, Blues Rock | energy-desc |
| 5 | `smoky-blues` | Smoky Blues | 🥃 | moods: bluesy, melancholic · genres: Blues, Blues Rock, Soul | shuffle |
| 6 | `70s-time-machine` | '70s Time Machine | 📼 | moods: nostalgic · yearMin: 1970, yearMax: 1979 | chronological |
| 7 | `late-night-spin` | Late Night Spin | 🌃 | moods: late_night, dreamy | energy-asc |
| 8 | `classic-rock-radio` | Classic Rock Radio | 📻 | genres: Classic Rock, Rock · moods: nostalgic, upbeat | shuffle |
| 9 | `psychedelic-trip` | Psychedelic Trip | 🍄 | moods: dreamy, epic · genres: Psychedelic Rock, Psychedelic | shuffle |
| 10 | `sunday-jazz` | Sunday Jazz | 🎷 | genres: Jazz · moods: chill, sunday_morning | shuffle |
| 11 | `raw-power` | Raw Power | ⚡ | moods: raw, energetic · genres: Hard Rock, Blues Rock, Punk | energy-desc |
| 12 | `rainy-day` | Rainy Day | 🌧️ | moods: melancholic, dreamy, comfort | energy-asc |
| 13 | `heartbreak` | Heartbreak Hour | 💔 | moods: melancholic · genres: Blues, Soul | shuffle |
| 14 | `feel-good` | Feel Good | ☀️ | moods: upbeat, comfort · genres: Soul, Oldies, Pop | shuffle |
| 15 | `deep-cuts` | Deep Cuts | 🕯️ | moods: late_night, raw · genres: Progressive Rock, Blues, Jazz | shuffle |
| 16 | `dance-party` | Dance Party | 🪩 | moods: party, upbeat, energetic · genres: Funk, Soul, Pop | energy-desc |
| 17 | `comfort-worn` | Comfort & Worn Grooves | 🧡 | moods: comfort, nostalgic | shuffle |
| 18 | `epic-side-a` | Epic Side A | 💿 | moods: epic · genres: Progressive Rock, Rock | energy-desc |
| 19 | `blue-eyed-soul` | After Hours Soul | 🍸 | moods: bluesy, late_night · genres: Soul, R&B, Blues | energy-asc |
| 20 | `60s-roots` | '60s & Early Roots | 🎸 | moods: nostalgic · yearMin: 1960, yearMax: 1972 ⚠ | chronological |
| 21 | `high-energy-rock` | Wake Up Loud | 📢 | moods: energetic · genres: Rock, Hard Rock | energy-desc |
| 22 | `folk-fireside` | Folk & Fireside | 🔥 | moods: comfort, nostalgic · genres: Folk, Folk Rock | shuffle |

**Coverage notes for Sonnet (from the collection analysis):**
- Strongest moods (most owned records): `energetic` (33), `late_night` (23), `nostalgic` (21),
  `upbeat` (19), `road_trip` (18), `raw` (17), `dreamy` (16). Playlists built on these will be full.
- `party` (7) and `sunday_morning` (3) are the thinnest existing tags → **#16 Dance Party** and any
  Sunday-morning-only rule will be small. #16 is kept (user named it) but broadened to
  `party OR upbeat OR energetic` + funk/soul so it isn't empty. Mark #16 and #14 (`feel-good`) as ⚠
  in the UI if they resolve to < 3 records.
- `epic` and `bluesy` are **new** moods (added in this tuning pass) — they'll only populate for
  records that get re-tagged by the AI, but the genre fallback (`Progressive Rock`→epic,
  `Blues`/`Soul`→bluesy) means #2, #5, #9, #18, #19 still resolve immediately via genre.

> Keep the two names the user asked for: **Lazy Sunday** (#1) and **Dance Party** (#16). Sonnet may
> rename/trim the rest, but do not re-introduce disco/house/hip-hop-only playlists — they resolve to
> nothing in this collection.

---

## 8. Tests

Add under `src/test/` (Vitest is already configured — see existing tests):
- `playlistBuilder.test.js`:
  - `albumMatchesRule` — mood-only, genre-only, year filter, `requireAll` true/false, empty rule.
  - `buildPlaylist` — respects `targetCount`; respects `targetMinutes` (stops near budget, min 2);
    orders by energy asc/desc correctly; `seed` makes shuffle deterministic (same seed → same
    order, different seed → different).
  - `scoreAlbumForRule` — AI-tagged album outranks a genre-only match on equal mood hits.
- `moodEnergy.test.js`:
  - `getAlbumEnergy` — party-tagged album > chill-tagged album; no-mood album returns 0.5.
  - `estimateAlbumMinutes` — sums track durations; falls back by format.

Build a small fixtures array of ~8 albums covering several moods/genres/years.

---

## 9. Build order (hand these to Sonnet as sequential tasks)

Each step is independently verifiable. Run `npm run build` and the test suite after each.

1. **Data + logic (no UI).** Create `src/data/moodPlaylists.js` (all 24), `src/data/sessionSizes.js`,
   add `getAlbumEnergy` + `estimateAlbumMinutes` to `moodUtils.js`, create
   `src/services/playlists/playlistBuilder.js`. Write + pass the §8 tests.
2. **Vibes tab shell.** Add the `vibes` tab to `BottomTabBar.jsx`, wire `VibesPage` into `App.jsx`,
   render the mood shelf (`MoodCard`) with live match counts and the session-size selector. No
   playlist view yet — tapping a card can just `console.log`.
3. **Playlist view.** Build `PlaylistView` + `PlaylistRow`: generate via `buildPlaylist`, show
   runtime, reshuffle (seed bump), remove/swap/reorder, "why these?", and open `AlbumDetailModal`
   on cover tap.
4. **Persistence (optional / additive).** Extend `DatabaseInterface`, `IndexedDBProvider`,
   `SupabaseProvider`, `MockProvider` with playlist CRUD; add `usePlaylists`; wire Save + a Saved
   Playlists list into `VibesPage`. Add the Supabase SQL migration.
5. **Polish + cleanup.** Empty/thin states, the "run AI Mood Analysis" nudge, delete
   `SuggestionsSection.jsx`, verify offline (DevTools → offline → generate a playlist).

### Prompts for each step

> **Step 1 PROMPT**
> "In `vinyl-companion/`, implement the data + logic layer for the Mood Playlists feature per
> `docs/MOOD_PLAYLISTS_PLAN.md` §3, §4, §7. Create `src/data/moodPlaylists.js` (all 24 playlists
> from §7), `src/data/sessionSizes.js`, add `getAlbumEnergy` and `estimateAlbumMinutes` to
> `src/utils/moodUtils.js` (do not change existing exports), and create
> `src/services/playlists/playlistBuilder.js`. Reuse `getMoodsForAlbum` from `moodUtils.js` for all
> mood resolution. Then write and pass the Vitest tests in §8. Run `npm run build` and the tests. No
> UI in this step."

> **Step 2 PROMPT**
> "Add the Vibes tab. Per `docs/MOOD_PLAYLISTS_PLAN.md` §6.1–6.3: add a `vibes` tab to
> `src/components/navigation/BottomTabBar.jsx`, wire a new `src/pages/VibesPage.jsx` into
> `src/App.jsx`'s `renderPage()` and `currentTab` handling, and build the mood shelf with
> `src/components/vibes/MoodCard.jsx`. **Match the inline-CSS-variable styling of
> `src/pages/DiscoverPage.jsx` — do NOT use Tailwind utility classes.** Show a live match count per
> card using `albumMatchesRule` from the builder, and a session-size segmented control from
> `SESSION_SIZES`. Tapping a card can console.log for now. Run `npm run build`."

> **Step 3 PROMPT**
> "Implement the playlist view per `docs/MOOD_PLAYLISTS_PLAN.md` §6.4–6.5. Create
> `src/components/vibes/PlaylistView.jsx` and `PlaylistRow.jsx`, generate the list with
> `buildPlaylist`, and support reshuffle (seed bump), remove, swap-in-next-candidate, up/down
> reorder, a 'why these?' tag reveal, and opening the existing `AlbumDetailModal` on cover tap. Keep
> the DiscoverPage inline-style conventions. Handle 0- and 1–2-match moods per §6.5. Run
> `npm run build`."

> **Step 4 PROMPT**
> "Add saved-playlist persistence per `docs/MOOD_PLAYLISTS_PLAN.md` §5. Extend `DatabaseInterface`,
> `IndexedDBProvider` (new `playlists` object store — mirror the existing version-upgrade pattern,
> don't drop stores), `SupabaseProvider` (new table + RLS + SQL migration under `supabase/`), and
> `MockProvider`. Add `src/hooks/usePlaylists.js` mirroring `useAlbumCollection`. Wire a Save button
> in `PlaylistView` and a Saved Playlists list in `VibesPage`. Run `npm run build` and tests."

> **Step 5 PROMPT**
> "Finish the Mood Playlists feature per `docs/MOOD_PLAYLISTS_PLAN.md` §6.6 and §9 step 5: polish
> empty/thin-collection states, add the 'run AI Mood Analysis' nudge for 0-match moods (reuse the
> existing `onOpenAIAnalysis` flow), delete the orphaned `src/components/SuggestionsSection.jsx`
> after confirming it has no importers, and manually verify a playlist generates while offline
> (DevTools offline mode). Run `npm run build`."

---

## 10. Acceptance criteria
- A **Vibes** tab exists; it shows ≥20 mood cards, each with a live count of matching owned records.
- Selecting **Lazy Sunday** or **Dance Party** produces an ordered playlist drawn only from the
  user's collection, sized to the chosen session length, with a visible total runtime.
- Reshuffle changes the order; remove/swap/reorder edit the list; cover tap opens the album detail.
- Everything works offline with no network calls at generation time.
- (If step 4 done) A playlist can be saved and reopened, persisting across reloads via the active
  DB provider.
- `npm run build` passes and new unit tests are green.
