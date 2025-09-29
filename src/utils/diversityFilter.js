/**
 * Diversity Filter Utility
 * Implements Maximal Marginal Relevance (MMR) algorithm for balanced recommendations
 */

/**
 * Apply diversity constraints to recommendations
 * Ensures no single genre, decade, or artist dominates the results
 * @param {Array} recommendations - Array of recommendation objects
 * @param {Object} options - Diversity control options
 * @returns {Array} Filtered and reordered recommendations
 */
export function applyDiversityFilter(recommendations, options = {}) {
  const config = {
    maxSameGenre: 3,        // Max artists from same genre
    maxSameDecade: 4,       // Max artists from same decade
    maxSameLabel: 2,        // Max artists from same label
    diversityWeight: 0.3,   // How much to prioritize diversity vs relevance (0-1)
    genreDistributionTarget: 0.4, // No genre should exceed 40% of results
    ...options
  };

  if (!recommendations || recommendations.length === 0) {
    return recommendations;
  }

  console.log(`🎯 Applying diversity filter to ${recommendations.length} recommendations`);

  // Apply MMR (Maximal Marginal Relevance) algorithm
  const diverseRecommendations = maximalMarginalRelevance(
    recommendations,
    config.diversityWeight,
    config
  );

  // Apply hard constraints
  const constrainedRecommendations = applyHardConstraints(diverseRecommendations, config);

  console.log(`🎯 Diversity filter result: ${constrainedRecommendations.length} recommendations (${recommendations.length - constrainedRecommendations.length} filtered out)`);

  return constrainedRecommendations;
}

/**
 * Maximal Marginal Relevance algorithm implementation
 * Balances relevance score with diversity from already selected items
 * @param {Array} candidates - All candidate recommendations
 * @param {number} lambda - Balance between relevance (1) and diversity (0)
 * @param {Object} config - Diversity configuration
 * @returns {Array} Reordered recommendations optimizing relevance + diversity
 */
function maximalMarginalRelevance(candidates, lambda, config) {
  if (candidates.length <= 1) return candidates;

  const selected = [];
  const remaining = [...candidates];

  // Always select the highest scoring item first
  const firstItem = remaining.shift();
  selected.push(firstItem);

  // Iteratively select items that maximize MMR score
  while (remaining.length > 0 && selected.length < 20) {
    let bestScore = -Infinity;
    let bestIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Relevance score (normalized 0-1)
      const relevanceScore = normalizeScore(candidate.score || candidate.graph_score || 0, candidates);

      // Diversity score (how different this is from already selected items)
      const diversityScore = calculateDiversityScore(candidate, selected);

      // MMR formula: λ * Relevance - (1-λ) * max_similarity_to_selected
      const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityScore;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      selected.push(remaining.splice(bestIndex, 1)[0]);
    } else {
      break; // No valid candidates found
    }
  }

  // Add remaining items in original order if we haven't filled the quota
  return [...selected, ...remaining];
}

/**
 * Calculate diversity score for a candidate relative to already selected items
 * Higher score = more diverse (different genres, decades, etc.)
 * @param {Object} candidate - Candidate recommendation
 * @param {Array} selected - Already selected recommendations
 * @returns {number} Diversity score (0-1, higher is more diverse)
 */
function calculateDiversityScore(candidate, selected) {
  if (selected.length === 0) return 1.0;

  let diversityPoints = 0;
  let totalChecks = 0;

  // Extract candidate attributes
  const candidateGenres = extractGenres(candidate);
  const candidateDecade = extractDecade(candidate);
  const candidateLabel = extractLabel(candidate);

  for (const selectedItem of selected) {
    // Genre diversity
    const selectedGenres = extractGenres(selectedItem);
    const genreOverlap = calculateGenreOverlap(candidateGenres, selectedGenres);
    diversityPoints += (1 - genreOverlap); // Higher score for less overlap
    totalChecks++;

    // Decade diversity
    const selectedDecade = extractDecade(selectedItem);
    if (candidateDecade && selectedDecade) {
      const decadeDifference = Math.abs(candidateDecade - selectedDecade);
      diversityPoints += Math.min(decadeDifference / 40, 1); // Normalize to 0-1
      totalChecks++;
    }

    // Label diversity (if available)
    if (candidateLabel && extractLabel(selectedItem)) {
      diversityPoints += candidateLabel !== extractLabel(selectedItem) ? 1 : 0;
      totalChecks++;
    }
  }

  return totalChecks > 0 ? diversityPoints / totalChecks : 1.0;
}

/**
 * Apply hard constraints to recommendations
 * Remove excess items that violate diversity limits
 * @param {Array} recommendations - Ordered recommendations
 * @param {Object} config - Diversity constraints
 * @returns {Array} Constrained recommendations
 */
function applyHardConstraints(recommendations, config) {
  const genreCounts = new Map();
  const decadeCounts = new Map();
  const labelCounts = new Map();
  const filtered = [];

  for (const rec of recommendations) {
    let shouldInclude = true;

    // Check genre constraint
    const genres = extractGenres(rec);
    for (const genre of genres) {
      const currentCount = genreCounts.get(genre) || 0;
      if (currentCount >= config.maxSameGenre) {
        shouldInclude = false;
        break;
      }
    }

    // Check decade constraint
    if (shouldInclude) {
      const decade = extractDecade(rec);
      if (decade) {
        const currentCount = decadeCounts.get(decade) || 0;
        if (currentCount >= config.maxSameDecade) {
          shouldInclude = false;
        }
      }
    }

    // Check label constraint
    if (shouldInclude) {
      const label = extractLabel(rec);
      if (label) {
        const currentCount = labelCounts.get(label) || 0;
        if (currentCount >= config.maxSameLabel) {
          shouldInclude = false;
        }
      }
    }

    if (shouldInclude) {
      // Update counters
      for (const genre of genres) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
      const decade = extractDecade(rec);
      if (decade) {
        decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
      }
      const label = extractLabel(rec);
      if (label) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }

      filtered.push(rec);
    }
  }

  return filtered;
}

/**
 * Helper functions for attribute extraction
 */

function extractGenres(item) {
  // Try different possible genre field names for artist recommendations
  const genres = item.genres || item.primaryGenres || item.tags || item.metadata?.genres || [];

  // Handle artist recommendation format where genres might be in metadata
  if (item.metadata?.tags) {
    return item.metadata.tags.slice(0, 2);
  }

  if (Array.isArray(genres)) {
    return genres.slice(0, 2); // Limit to top 2 genres per artist
  }
  if (typeof genres === 'string') {
    return [genres];
  }

  // Fallback: try to infer from connections to user's collection
  // This can help with genre detection when direct genre info is missing
  if (item.connections && item.connections.length > 0) {
    // Could potentially look up genres from connected artists
    // For now, return empty array
  }

  return [];
}

function extractDecade(item) {
  // Extract decade from year or metadata for artist recommendations
  const year = item.year || item.formed_year || item.metadata?.year || item.metadata?.formed_year;

  // For artist recommendations, we might not have direct year info
  // Could potentially look at connections to user's collection for era inference
  if (year) {
    return Math.floor(year / 10) * 10; // Convert to decade (1990, 2000, etc.)
  }

  return null; // Return null if no year info available
}

function extractLabel(item) {
  // Artist recommendations might not have label info, which is fine
  return item.label || item.record_label || item.metadata?.label || null;
}

function calculateGenreOverlap(genres1, genres2) {
  if (genres1.length === 0 || genres2.length === 0) return 0;

  const set1 = new Set(genres1.map(g => g.toLowerCase()));
  const set2 = new Set(genres2.map(g => g.toLowerCase()));

  const intersection = new Set([...set1].filter(g => set2.has(g)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size; // Jaccard similarity
}

function normalizeScore(score, allCandidates) {
  const scores = allCandidates.map(c => c.score || c.graph_score || 0);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  if (maxScore === minScore) return 1.0;

  return (score - minScore) / (maxScore - minScore);
}

/**
 * Get diversity statistics for debugging
 * @param {Array} recommendations - Final recommendations
 * @returns {Object} Diversity statistics
 */
export function getDiversityStats(recommendations) {
  const genreDistribution = new Map();
  const decadeDistribution = new Map();
  const totalCount = recommendations.length;

  for (const rec of recommendations) {
    // Count genres
    const genres = extractGenres(rec);
    for (const genre of genres) {
      genreDistribution.set(genre, (genreDistribution.get(genre) || 0) + 1);
    }

    // Count decades
    const decade = extractDecade(rec);
    if (decade) {
      decadeDistribution.set(decade, (decadeDistribution.get(decade) || 0) + 1);
    }
  }

  return {
    totalRecommendations: totalCount,
    genreDistribution: Object.fromEntries(genreDistribution),
    decadeDistribution: Object.fromEntries(decadeDistribution),
    maxGenrePercentage: totalCount > 0 ? Math.max(...genreDistribution.values()) / totalCount : 0,
    diversityScore: calculateOverallDiversity(genreDistribution, decadeDistribution, totalCount)
  };
}

function calculateOverallDiversity(genreDistribution, decadeDistribution, totalCount) {
  if (totalCount === 0) return 0;

  // Calculate Shannon entropy for genre distribution
  const genreEntropy = calculateEntropy([...genreDistribution.values()], totalCount);

  // Calculate Shannon entropy for decade distribution
  const decadeEntropy = calculateEntropy([...decadeDistribution.values()], totalCount);

  // Combine entropies (higher = more diverse)
  return (genreEntropy + decadeEntropy) / 2;
}

function calculateEntropy(counts, total) {
  if (total === 0) return 0;

  let entropy = 0;
  for (const count of counts) {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  }

  return entropy;
}