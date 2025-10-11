/**
 * Recommendation Service - Backward Compatibility Layer
 *
 * This file maintains backward compatibility by re-exporting from the new
 * recommendations module structure. All new code should import from
 * './recommendations/index.js' instead.
 *
 * @deprecated Use './recommendations/index.js' instead
 */

export { RecommendationEngine as RecommendationService, default } from './recommendations/index.js';
