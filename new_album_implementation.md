# new_album_implementation.md

## Vinyl Album Suggestion Engine — Implementation Plan

### 1. Data You Already Have
Leverage your existing fields (`artist`, `title`, `year`, `genre[]`, `label`, `country`, `moods[]`, `musicbrainzId`, `discogsId`, `spotifyId`) as the foundation for matching, scoring, and de-duplication.

**Schema additions:**
- `artist_mbids` (string[]): canonical MusicBrainz IDs  
- `tags` (string[]): normalized tags/genres  
- `fingerprint` (string): normalized `artist::title` key  
- `recs_feedback`: user ratings of suggestions  
- `recs_cache`: cached candidate albums and scores

---

### 2. External Signal (Last.fm)
Use the Last.fm API to gather:
- Similar artists  
- Top albums by tag  
- Artist/album tags and playcounts  
- (Optional) Similar albums  

Cache all responses with daily TTL to avoid rate limits.

---

### 3. Multi-Attribute Matching Graph
Candidates are nodes connected to your collection with weighted edges.

**Feature weights:**
- Artist proximity (0.35)  
- Tag/genre similarity (0.30)  
- Era/time-period fit (0.15)  
- Label/scene/country (0.08)  
- Mood fit (0.07)  
- Popularity prior (0.05)  

Total score = weighted sum, normalized to [0,1].

---

### 4. Candidate Generation
1. **Per-artist expansion**: similar artists + their top albums.  
2. **Per-tag expansion**: top tags from your collection, pull albums.  
3. **Per-era expansion**: densest year clusters, fetch albums by tag/era.  
4. Union all, drop already-owned albums.

---

### 5. Curated Lists
Create explainable, human-readable categories:
- Top 10 For You  
- Because you own [Artist]  
- More [Tag/Genre] you love  
- More Folk from the Early ’70s  
- From the [Label Y] family  
- Dreamy & Nostalgic Picks (based on `moods[]`)

---

### 6. Learning From Feedback
- Store thumbs up/down in `recs_feedback`.  
- Online weight adjustment: increase weights that correlate with likes, decrease for dislikes.

---

### 7. UI/UX Surfaces
- **Home:** Top 10 + 3 curated lists  
- **Explainability:** show “Because you own X and like Y”  
- **Controls:** crate-digging mode, obscurity cap, era focus  
- **Actions:** wishlist, hide, feedback

---

### 8. System Design
**Flow:**
1. Build user profile  
2. Fetch external data  
3. Assemble & score candidates  
4. Store in `recs_cache`  
5. Serve to client as lists  
6. Update with feedback  

**Storage:** Supabase tables `recs_cache`, `recs_feedback`, `user_weights`.

---

### 9. Normalization Utilities
- `fingerprint = artist.toLowerCase()::title.toLowerCase()`  
- Cosine similarity for tag vectors

---

### 10. Scoring Pseudocode
```ts
function score(c, w={A:.35,G:.30,T:.15,L:.08,M:.07,P:.05}) {
  const S = w.A*(c.artistSim||0) + w.G*(c.tagSim||0) + w.T*(c.eraFit||0) +
            w.L*(c.labelFit||0)  + w.M*(c.moodFit||0)+ w.P*(c.popularity||0);
  const reasons = [];
  if ((c.artistSim||0) > .5) reasons.push("close to artists you own");
  if ((c.tagSim||0) > .6) reasons.push("strong genre/tag match");
  return { S: Math.min(1, Math.max(0, S)), reasons: reasons.slice(0,2) };
}
```

---

### 11. Curated List Builders
- **Because you own [Artist X]**: `artistSim ≥ 0.6`  
- **More [Tag Y]**: `tagSim ≥ 0.6`  
- **More Folk from Early ’70s**: tag = “folk”, year 1968–76  
- **From [Label Z] family**: `labelFit ≥ 0.7`

---

### 12. De-Dupe Logic
- Exclude if fingerprint matches collection.  
- Exclude if any external ID (`mbid`, `discogsId`, `spotifyId`) matches.

---

### 13. Performance & Freshness
- Recompute profile on collection changes.  
- Refresh candidate cache nightly or on demand.  
- Show cached Top 10 instantly, update in background.

---

### 14. Testing & Evaluation
- Hide 10% of owned albums, check if they appear in Top-K.  
- Compare feedback rates for different weight sets.  
- Monitor artist dominance drift.

---

### 15. Privacy & Safety
- Send minimal info to Last.fm (artist/tag names only).  
- Cache and respect API limits.  
- Never expose purchase info or personal metadata.

---

### 16. Roadmap
**Week 1 (MVP):** profile build, Last.fm fetchers, scoring engine, Top 10.  
**Week 2 (UX):** curated lists, explanations, feedback buttons.  
**Week 3 (Learning):** adaptive weights, advanced controls, backtests.

---

### 17. Integration With Your App
- **Serverless functions (Netlify):** `/profile`, `/fetch`, `/score`, `/lists`, `/feedback`.  
- **Supabase tables:** extend existing `albums`, add `recs_cache`, `recs_feedback`, `user_weights`.


  Step 3: Advanced Scoring - Implement sophisticated similarity algorithms
  Step 4: Smart Candidates - Add more data sources and filtering
  Step 5: Curated Lists - Create themed recommendations and discovery features