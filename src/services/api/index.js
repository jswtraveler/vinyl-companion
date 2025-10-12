/**
 * API Clients - Main Entry Point
 *
 * Organized API clients by purpose:
 * - music/: Music metadata and streaming services
 * - search/: Search and image recognition services
 * - ai/: AI and ML services
 *
 * Usage:
 *   import { LastFm, Spotify, MusicBrainz } from './services/api/music';
 *   import { SerpApi, GoogleImageSearch } from './services/api/search';
 *   import { geminiClient } from './services/api/ai';
 */

// Re-export all clients from subdirectories
export * from './music/index.js';
export * from './search/index.js';
export * from './ai/index.js';
