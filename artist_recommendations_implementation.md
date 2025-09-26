# Artist Recommendations Implementation Roadmap (Updated with Improvements)

## 1. Core Concept

Implement **“Check These Artists Out”**: surface artists you don’t own, ranked by connection strength to your collection.

**Scoring Formula (with novelty and normalization):**
```
ArtistScore(a_c) = α * log(1 + Σ Conn(a_o, a_c)) / sqrt(|OwnedArtists|)
                 + β * |{a_o : Conn(a_o, a_c) ≥ τ}|
                 + γ * pop(a_c)
                 + δ * novelty(a_c)
```

- **α (0.6)** = total connection strength (normalized for collection size)
- **β (0.3)** = breadth of connections (strong edges count)
- **γ (0.1)** = popularity prior
- **δ (0.05)** = novelty (underrepresented genres, user-tunable slider)
- **τ = 0.5** similarity threshold
- Cap per-owned-artist contribution (top-K similar per artist only).

---

## 2. Roadmap

### **MVP (Persisted, Normalized, Week 1–2)**

**Goals:**
- Persist Last.fm similarity & metadata globally (not per-user).
- Use per-user link tables for owned artists and recommendation cache.
- Compute scores in SQL (joins + aggregations) for speed.
- Cache recommendation results for 24h (not 6h).
- Add diversity control (no >3 recs from same tag/decade).

**Database schema (minimal, global + user link):**
- `artist_similarity_cache` (global, 30d TTL)
- `artist_metadata_cache` (global, 14d TTL for listeners/tags)
- `user_owned_artists`
- `user_artist_recs_cache` (24h TTL)

**Service layer:**
- `LastFmDataService` (global fetch/persist)
- `ArtistScoringEngine` (with normalization + diversity filter)
- `RecommendationService` (per-user query + cache)

**UI:**
- Simple list of artist cards with score, tags, and connected artists.
- Explicit coverage/confidence indicator if <30% of library collected.

---

### **Intermediate (Graph Algorithms, Progressive Collector, Novelty, Week 3–5)**

**Goals:**
- **Graph-based recommendation scoring** using random walk with restart algorithm.
- Progressive collection service to fill gaps daily (server-side cron).
- Novelty scoring with user-tunable slider (δ factor).
- Confidence scores based on data coverage & edge diversity.
- Exponential backoff on API failures.
- Bulk upserts for efficiency.

**Enhanced Scoring Formula (with graph algorithms):**
```
ArtistScore(a_c) = α * GraphWalkScore(a_c, UserArtists) / sqrt(|OwnedArtists|)
                 + β * |{a_o : Conn(a_o, a_c) ≥ τ}|
                 + γ * pop(a_c)
                 + δ * novelty(a_c)

where GraphWalkScore = Σ (restart_prob^depth * path_similarity)
```

**Database schema (extended with graph support):**
- `collection_progress` (status, attempts, priority, staleness decay)
- `collection_stats` (daily API usage, error counts)
- `artist_similarity_graph` (materialized view for fast graph queries)
- Extend `user_artist_recs_cache` with explanation + confidence + graph_paths.

**Graph Algorithm Implementation:**

```sql
-- PostgreSQL recursive CTE for random walk scoring
WITH RECURSIVE artist_walk AS (
  -- Base case: user's owned artists (restart points)
  SELECT
    s.target_artist,
    s.similarity_score * 0.85 as walk_score,  -- restart probability
    1 as depth,
    u.artist_id as origin_artist
  FROM user_owned_artists u
  JOIN artist_similarity_cache s ON u.artist_id = s.source_artist
  WHERE s.similarity_score >= 0.3  -- minimum edge weight

  UNION ALL

  -- Recursive case: continue walk through similarity graph
  SELECT
    s.target_artist,
    w.walk_score * s.similarity_score * 0.85^w.depth as walk_score,
    w.depth + 1,
    w.origin_artist
  FROM artist_walk w
  JOIN artist_similarity_cache s ON w.target_artist = s.source_artist
  WHERE w.depth < 3  -- limit walk depth for performance
    AND s.similarity_score >= 0.3
)
SELECT
  target_artist,
  SUM(walk_score) as graph_score,
  COUNT(DISTINCT origin_artist) as connection_breadth,
  ARRAY_AGG(DISTINCT origin_artist) as connected_to
FROM artist_walk
WHERE target_artist NOT IN (SELECT artist_id FROM user_owned_artists)
GROUP BY target_artist
ORDER BY graph_score DESC
LIMIT 50;
```

**Services:**
- `GraphRecommendationEngine` (PostgreSQL graph traversal + scoring)
- `ProgressiveDataCollector` (server-side scheduling, budget-aware)
- `BudgetManager` (daily/hourly API limits)
- `SimilarityGraphBuilder` (builds coverage map + materialized views)
- `GraphPathExplainer` (generates "because you own X→Y→Z" explanations)

**Frontend Graph Processing (fallback/enhancement):**
```javascript
// Optional: client-side graph algorithms for real-time tuning
import { Graph } from 'graphology';
import { randomWalkScoring } from 'graphology-algorithms';

const enhanceRecommendations = async (baseRecs, userPreferences) => {
  // Build similarity graph from cached data
  const graph = await buildSimilarityGraph();

  // Apply user-specific graph parameters
  const enhanced = randomWalkScoring(graph, {
    restartProbability: userPreferences.explorationLevel,
    maxDepth: userPreferences.discoveryRange,
    edgeThreshold: userPreferences.similarityThreshold
  });

  return enhanced;
};
```

**UI Enhancements:**
- Progress indicator (X/Y artists collected, completeness %).
- **Graph visualization** for recommendation paths (optional, via cytoscape.js).
- Expandable artist cards with **connection paths**: "Via: Your Artist → Similar Artist → Recommendation".
- **Discovery controls**: sliders for walk depth, restart probability, edge threshold.
- Refresh button with retry on failure.
- Novelty slider in preferences.

---

### **Full System (Production-Grade, Week 6–8)**

**Goals:**
- End-to-end production-grade persistence & background workers.
- MMR-based diversity constraint for balanced lists.
- Observability dashboards for API usage, cache hit rates, latency, coverage.
- Feedback-based learning loop (bounded, rate-limited).

**Database (full schema + security):**
- All caches & progress tables with RLS for user-owned data.
- Global artist caches remain shared.
- Indexes for `similar_artist`, `tags (GIN)`, `source_artist`.

**Service Layer:**
- `CollectionScheduler`: background worker with staleness-aware queue.
- `DataIntegrityService`: cleanup, deduplication, backoff retries.
- `FeedbackLearningService`: online weight updates with counterfactual logging.

**UI/UX:**
- Collapsible cards with “Because you own X and Y” explanations.
- Confidence display with tooltip: based on coverage & data freshness.
- States for “warming up” when coverage is sparse.
- Failure UI with retry option.

**Performance:**
- <2s recommendation generation for 100+ albums.
- >85% cache hit rate.
- Progressive enhancement: usable results day 1, improving daily.

**Success Metrics:**
- API call success rate >90%
- Cache efficiency >85%
- Coverage growth 20+ artists/day within budget
- 70%+ “makes sense” approval feedback
- No single genre >40% of recs

---

## 3. Evolution Summary

- **MVP** → Global caches + normalized scoring + persisted recs (fast, simple, avoids re-fetching).  
- **Intermediate** → Progressive data collection (server-side), novelty slider, confidence scoring, retry/backoff, richer UI.  
- **Full** → Production-grade with MMR diversity, feedback learning, observability, and robust RLS-secured schema.

