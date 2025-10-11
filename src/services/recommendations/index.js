/**
 * Recommendations Module - Main Entry Point
 *
 * This module provides the complete recommendation system for the Vinyl Companion app.
 * It combines data fetching, caching, scoring algorithms, and graph-based recommendations
 * into a unified interface.
 *
 * Usage:
 *   import RecommendationService from './services/recommendations';
 *   // or
 *   import { RecommendationEngine, Scorer, GraphRecommender } from './services/recommendations';
 */

// Main engine (orchestrator)
export { RecommendationEngine, default as RecommendationService } from './RecommendationEngine.js';

// Data layer
export { DataFetcher, CacheManager } from './data/index.js';

// Algorithms layer
export { Scorer, GraphRecommender } from './algorithms/index.js';
