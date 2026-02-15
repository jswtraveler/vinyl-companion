/**
 * Recommendation Service - Backward Compatibility Layer
 *
 * This file maintains backward compatibility by re-exporting from the new
 * recommendations module structure. All new code should import from
 * './recommendations/index.js' instead.
 *
 * @deprecated Use './recommendations/index.js' instead
 */

import RecommendationEngine from './recommendations/RecommendationEngine.js';

// Named export for: import { RecommendationService } from './recommendationService.js'
export { RecommendationEngine as RecommendationService };

// Default export for: import RecommendationService from './recommendationService.js'
export default RecommendationEngine;
