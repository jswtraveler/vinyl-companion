/**
 * Data Layer Exports
 * Handles all external data fetching and caching operations
 */

export { RecommendationDataFetcher as DataFetcher } from './DataFetcher.js';
export { RecommendationCacheService as CacheManager } from './CacheManager.js';

// For backward compatibility
export { RecommendationDataFetcher } from './DataFetcher.js';
export { RecommendationCacheService } from './CacheManager.js';
