# Recommendation Services Refactoring Plan

**Date:** October 11, 2025
**Status:** In Progress
**Task:** Refactor recommendation services into organized modules

---

## Current State Analysis

### Files to Refactor

| File | Lines | Purpose | Dependencies |
|------|-------|---------|--------------|
| `recommendationService.js` | 907 | Main orchestrator | LastFm, ListenBrainz, Spotify, DataFetcher, Profiler, Scoring, Cache, Supabase |
| `recommendationDataFetcher.js` | 1033 | API data fetching | AlbumNormalizer |
| `recommendationCacheService.js` | 642 | Cache management | Supabase |
| `graphRecommendationService.js` | 602 | Graph algorithms | (needs analysis) |
| `recommendationScoring.js` | 366 | Scoring logic | AlbumNormalizer |
| **Total** | **3,550** | | |

### Current Consumers

Files that import recommendation services:
1. `src/components/ArtistRecommendationSection.jsx`
2. `src/components/RecommendationSection.jsx`

### Current Import Structure

```javascript
// recommendationService.js imports:
import LastFmClient from './lastfmClient.js';
import ListenBrainzClient from './listenBrainzClient.js';
import SpotifyClient from './spotifyClient.js';
import RecommendationDataFetcher from './recommendationDataFetcher.js';
import CollectionProfiler from './collectionProfiler.js';
import RecommendationScoring from './recommendationScoring.js';
import RecommendationCacheService from './recommendationCacheService.js';
import { supabase } from './supabase.js';
import { AlbumNormalizer } from '../utils/albumNormalization.js';
```

---

## Proposed Structure

```
src/services/recommendations/
├── index.js                          # Main export and convenience facade
├── RecommendationEngine.js           # Core orchestrator (from recommendationService.js)
│
├── data/
│   ├── index.js                      # Data layer exports
│   ├── DataFetcher.js               # API fetching (from recommendationDataFetcher.js)
│   └── CacheManager.js              # Caching (from recommendationCacheService.js)
│
├── algorithms/
│   ├── index.js                     # Algorithm exports
│   ├── Scorer.js                    # Scoring (from recommendationScoring.js)
│   └── GraphRecommender.js          # Graph-based (from graphRecommendationService.js)
│
├── utils/
│   ├── constants.js                 # Configuration constants
│   └── helpers.js                   # Shared utilities
│
└── README.md                         # Documentation
```

---

## Refactoring Steps

### Step 1: Create Directory Structure ✅
```bash
mkdir -p src/services/recommendations/data
mkdir -p src/services/recommendations/algorithms
mkdir -p src/services/recommendations/utils
```

### Step 2: Move and Refactor Data Layer
**Files to create:**
- `src/services/recommendations/data/DataFetcher.js` (from recommendationDataFetcher.js)
- `src/services/recommendations/data/CacheManager.js` (from recommendationCacheService.js)
- `src/services/recommendations/data/index.js`

**Changes:**
- Update imports to use new paths
- Keep functionality identical
- Export from data/index.js

### Step 3: Move and Refactor Algorithms Layer
**Files to create:**
- `src/services/recommendations/algorithms/Scorer.js` (from recommendationScoring.js)
- `src/services/recommendations/algorithms/GraphRecommender.js` (from graphRecommendationService.js)
- `src/services/recommendations/algorithms/index.js`

**Changes:**
- Update imports to use new paths
- Keep functionality identical
- Export from algorithms/index.js

### Step 4: Refactor Core Engine
**File to create:**
- `src/services/recommendations/RecommendationEngine.js` (from recommendationService.js)

**Changes:**
- Update imports to use new data/ and algorithms/ modules
- Simplify imports using new structure
- Keep public API identical

### Step 5: Create Main Index
**File to create:**
- `src/services/recommendations/index.js`

**Purpose:**
- Re-export RecommendationEngine as default
- Re-export commonly used classes
- Provide convenient imports for consumers

**Example:**
```javascript
export { default } from './RecommendationEngine.js';
export { default as RecommendationEngine } from './RecommendationEngine.js';
export { DataFetcher, CacheManager } from './data/index.js';
export { Scorer, GraphRecommender } from './algorithms/index.js';
```

### Step 6: Update Consumer Imports
**Files to update:**
- `src/components/ArtistRecommendationSection.jsx`
- `src/components/RecommendationSection.jsx`

**Old import:**
```javascript
import RecommendationService from '../services/recommendationService.js';
```

**New import:**
```javascript
import RecommendationService from '../services/recommendations/index.js';
// or
import { RecommendationEngine } from '../services/recommendations/index.js';
```

### Step 7: Create Documentation
**File to create:**
- `src/services/recommendations/README.md`

**Contents:**
- Architecture overview
- Module descriptions
- Usage examples
- Migration guide

### Step 8: Testing
- Test recommendation generation works
- Test caching works
- Test scoring works
- Test all consumers still work

---

## Migration Strategy

### Phase 1: Create New Structure (No Breaking Changes)
1. Create new directory structure
2. Copy files to new locations
3. Update imports within new structure
4. Test new structure works

### Phase 2: Update Consumers
1. Update import paths in components
2. Test components still work
3. Verify functionality unchanged

### Phase 3: Cleanup
1. Delete old files (after verification)
2. Update any remaining references
3. Final testing

---

## Import Path Changes

### Before Refactoring

```javascript
// Components
import RecommendationService from '../services/recommendationService.js';
import RecommendationDataFetcher from '../services/recommendationDataFetcher.js';
import RecommendationCacheService from '../services/recommendationCacheService.js';
import RecommendationScoring from '../services/recommendationScoring.js';
```

### After Refactoring

```javascript
// Components - Simple facade
import RecommendationService from '../services/recommendations/index.js';

// Or if you need specific modules
import {
  RecommendationEngine,
  DataFetcher,
  CacheManager,
  Scorer
} from '../services/recommendations/index.js';
```

---

## Benefits of New Structure

### 1. Clear Separation of Concerns
- **Data Layer**: Fetching and caching
- **Algorithms Layer**: Scoring and graph operations
- **Engine**: Orchestration only

### 2. Reduced File Sizes
- No single file over 600 lines
- Easier to understand and maintain
- Better for code reviews

### 3. Better Testability
- Each module can be tested independently
- Mock dependencies easily
- Isolated unit tests

### 4. Easier to Extend
- Add new data sources → data/ layer
- Add new algorithms → algorithms/ layer
- Clear where new code should live

### 5. Improved Import Clarity
- Single import for most use cases
- Clear module boundaries
- Tree-shaking friendly

---

## Files to Keep (Not Moving)

These files stay in `src/services/`:
- `collectionProfiler.js` - User profile building (shared utility)
- `lastfmClient.js` - Last.fm API client (API layer)
- `listenBrainzClient.js` - ListenBrainz API client (API layer)
- `spotifyClient.js` - Spotify API client (API layer)
- `supabase.js` - Supabase client (database layer)

**Reasoning:** These are general-purpose services used by recommendation system but also potentially by other features.

---

## Risk Assessment

### Low Risk ✅
- File structure changes only
- No functional logic changes
- All imports updated atomically
- Easy to rollback (git)

### Potential Issues
1. **Missed imports** - Solution: Search codebase for old imports
2. **Circular dependencies** - Solution: Review import graph
3. **Build errors** - Solution: Test build after each step

### Mitigation
- Test after each file move
- Keep old files until verification complete
- Update imports in small batches
- Run full build and test suite

---

## Success Criteria

- ✅ All recommendation files organized into clear structure
- ✅ No files over 600 lines
- ✅ Clear module boundaries
- ✅ All consumers updated
- ✅ All tests pass
- ✅ Build succeeds
- ✅ Functionality unchanged
- ✅ Documentation complete

---

## Timeline

**Estimated Time:** 4-6 hours

1. Create structure: 30 minutes
2. Move data layer: 1 hour
3. Move algorithms layer: 1 hour
4. Refactor engine: 1 hour
5. Update consumers: 30 minutes
6. Testing: 1 hour
7. Documentation: 30 minutes
8. Final verification: 30 minutes

---

**Ready to begin refactoring!**
