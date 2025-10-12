/**
 * API Clients - Backward Compatibility Layer
 *
 * This file maintains backward compatibility by re-exporting from the new
 * api/ module structure. All new code should import from './api/[category]'
 * instead.
 *
 * @deprecated Use './api/music', './api/search', or './api/ai' instead
 */

// Music API clients
export { MusicBrainzClient } from './api/music/MusicBrainzClient.js';
export { DiscogsClient } from './api/music/DiscogsClient.js';
export { CoverArtClient } from './api/music/CoverArtClient.js';

// Search API clients
export { GoogleImageSearchClient } from './api/search/GoogleImageSearchClient.js';
