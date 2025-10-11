/**
 * Advanced Recommendation Scoring Engine
 * Implements sophisticated similarity algorithms for album recommendations
 */

import { AlbumNormalizer } from '../../../utils/albumNormalization.js';

export class RecommendationScoring {
  constructor(options = {}) {
    // Default feature weights from implementation plan
    this.weights = {
      artistProximity: 0.35,
      tagSimilarity: 0.30,
      eraFit: 0.15,
      labelScene: 0.08,
      moodFit: 0.07,
      external: 0.05, // Last.fm similarity scores
      ...options.weights
    };

    // Scoring thresholds
    this.thresholds = {
      minimumScore: 0.1,
      goodScore: 0.4,
      excellentScore: 0.7,
      ...options.thresholds
    };
  }

  /**
   * Score a candidate album against user profile and collection
   * @param {Object} candidate - Candidate album to score
   * @param {Object} userProfile - User's collection profile
   * @param {Object[]} userAlbums - User's existing albums
   * @param {Object} externalData - External recommendation data
   * @returns {Object} Scoring result with breakdown
   */
  scoreCandidate(candidate, userProfile, userAlbums, externalData = null) {
    const scores = {
      artistProximity: this.calculateArtistProximity(candidate, userProfile, userAlbums),
      tagSimilarity: this.calculateTagSimilarity(candidate, userProfile),
      eraFit: this.calculateEraFit(candidate, userProfile),
      labelScene: this.calculateLabelSceneFit(candidate, userProfile),
      moodFit: this.calculateMoodFit(candidate, userProfile),
      external: this.calculateExternalScore(candidate, externalData)
    };

    // Calculate weighted total score
    const totalScore = Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score * this.weights[key]);
    }, 0);

    // Generate explanation
    const explanation = this.generateExplanation(candidate, scores, totalScore);

    return {
      candidate,
      totalScore: Math.min(totalScore, 1.0), // Cap at 1.0
      scores,
      explanation,
      confidence: this.calculateConfidence(scores),
      reasons: this.extractTopReasons(scores, 3)
    };
  }

  /**
   * Calculate artist proximity score (0.35 weight)
   * Based on similar artists and artist network analysis
   */
  calculateArtistProximity(candidate, userProfile, userAlbums) {
    let score = 0;
    let factors = 0;

    // Direct artist match (user already has albums by this artist)
    const userArtists = userProfile.artists.map(a => a.artist.toLowerCase());
    if (userArtists.includes(candidate.artist.toLowerCase())) {
      score += 0.9; // Very high score for known artists
      factors++;
    }

    // Similar artist networks (if available from Last.fm)
    if (candidate.metadata?.sourceArtist) {
      const sourceArtist = candidate.metadata.sourceArtist.toLowerCase();
      if (userArtists.includes(sourceArtist)) {
        score += (candidate.similarity || 0.5); // Use Last.fm similarity
        factors++;
      }
    }

    // Artist frequency in user collection (prefer artists from favored artists)
    const topArtists = userProfile.artists.slice(0, 10).map(a => a.artist.toLowerCase());
    if (topArtists.includes(candidate.artist.toLowerCase())) {
      const artistRank = topArtists.indexOf(candidate.artist.toLowerCase());
      score += (1.0 - (artistRank / 10)) * 0.7; // Higher score for more frequent artists
      factors++;
    }

    // Genre-artist overlap (artists common to user's favorite genres)
    if (candidate.genre && userProfile.preferences.primaryGenres) {
      const genreOverlap = candidate.genre.some(g =>
        userProfile.preferences.primaryGenres.includes(g)
      );
      if (genreOverlap) {
        score += 0.3;
        factors++;
      }
    }

    return factors > 0 ? Math.min(score / factors, 1.0) : 0;
  }

  /**
   * Calculate tag/genre similarity score (0.30 weight)
   * Uses cosine similarity for tag vectors
   */
  calculateTagSimilarity(candidate, userProfile) {
    if (!candidate.genre && !candidate.moods) return 0;

    const candidateTags = AlbumNormalizer.normalizeTags(candidate.genre, candidate.moods);
    if (candidateTags.length === 0) return 0;

    const userTags = userProfile.tags.map(t => t.tag);
    if (userTags.length === 0) return 0;

    // Jaccard similarity (intersection / union)
    const candidateSet = new Set(candidateTags);
    const userSet = new Set(userTags);

    const intersection = new Set([...candidateSet].filter(x => userSet.has(x)));
    const union = new Set([...candidateSet, ...userSet]);

    const jaccardSimilarity = intersection.size / union.size;

    // Weight by tag importance in user's profile
    let weightedScore = 0;
    let totalWeight = 0;

    candidateTags.forEach(tag => {
      const userTag = userProfile.tags.find(t => t.tag === tag);
      if (userTag) {
        const weight = userTag.percentage / 100; // Convert percentage to weight
        weightedScore += weight;
        totalWeight += weight;
      }
    });

    const weightedSimilarity = totalWeight > 0 ? weightedScore / totalWeight : 0;

    // Combine Jaccard and weighted similarity
    return (jaccardSimilarity * 0.6) + (weightedSimilarity * 0.4);
  }

  /**
   * Calculate era/time-period fit score (0.15 weight)
   */
  calculateEraFit(candidate, userProfile) {
    if (!candidate.year || !userProfile.eras.decades.length) return 0;

    const candidateDecade = Math.floor(candidate.year / 10) * 10;

    // Find user's preference for this decade
    const userDecadePreference = userProfile.eras.decades.find(d => d.decade === candidateDecade);
    if (userDecadePreference) {
      // Score based on how much user likes this decade
      return Math.min(userDecadePreference.percentage / 100 * 2, 1.0);
    }

    // Check adjacent decades for partial match
    const adjacentDecades = [candidateDecade - 10, candidateDecade + 10];
    let adjacentScore = 0;

    adjacentDecades.forEach(decade => {
      const preference = userProfile.eras.decades.find(d => d.decade === decade);
      if (preference) {
        adjacentScore = Math.max(adjacentScore, preference.percentage / 100 * 0.5);
      }
    });

    return adjacentScore;
  }

  /**
   * Calculate label/scene/country fit score (0.08 weight)
   */
  calculateLabelSceneFit(candidate, userProfile) {
    let score = 0;
    let factors = 0;

    // Label matching
    if (candidate.label && userProfile.labels.length > 0) {
      const userLabels = userProfile.labels.map(l => l.label.toLowerCase());
      if (userLabels.includes(candidate.label.toLowerCase())) {
        const labelPreference = userProfile.labels.find(l =>
          l.label.toLowerCase() === candidate.label.toLowerCase()
        );
        score += (labelPreference.percentage / 100) * 2; // Double weight for label match
        factors++;
      }
    }

    // Country matching
    if (candidate.country && userProfile.countries.length > 0) {
      const userCountries = userProfile.countries.map(c => c.country.toLowerCase());
      if (userCountries.includes(candidate.country.toLowerCase())) {
        const countryPreference = userProfile.countries.find(c =>
          c.country.toLowerCase() === candidate.country.toLowerCase()
        );
        score += countryPreference.percentage / 100;
        factors++;
      }
    }

    return factors > 0 ? Math.min(score / factors, 1.0) : 0;
  }

  /**
   * Calculate mood fit score (0.07 weight)
   */
  calculateMoodFit(candidate, userProfile) {
    if (!candidate.moods || !userProfile.moods.length) return 0;

    const candidateMoods = candidate.moods.map(m => AlbumNormalizer.normalizeTagString(m));
    const userMoods = userProfile.moods.map(m => m.mood);

    return AlbumNormalizer.calculateTagSimilarity(candidateMoods, userMoods);
  }

  /**
   * Calculate external score from Last.fm data (0.05 weight)
   */
  calculateExternalScore(candidate, externalData) {
    if (!externalData || !candidate.metadata) return 0;

    let score = 0;
    let factors = 0;

    // Last.fm similarity score
    if (candidate.similarity && typeof candidate.similarity === 'number') {
      score += candidate.similarity;
      factors++;
    }

    // Last.fm popularity (playcount, rank)
    if (candidate.popularity && typeof candidate.popularity === 'number') {
      // Normalize playcount to 0-1 scale (log scale for very popular items)
      const normalizedPopularity = Math.min(Math.log10(candidate.popularity + 1) / 7, 1.0);
      score += normalizedPopularity * 0.3; // Lower weight for popularity
      factors++;
    }

    // Rank score (lower rank = higher score)
    if (candidate.rank && typeof candidate.rank === 'number') {
      const rankScore = Math.max(0, 1 - (candidate.rank / 100)); // Top 100 gets positive score
      score += rankScore * 0.2;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate confidence score based on feature availability
   */
  calculateConfidence(scores) {
    const availableFeatures = Object.values(scores).filter(score => score > 0).length;
    const totalFeatures = Object.keys(scores).length;

    // Base confidence on feature coverage
    const featureCoverage = availableFeatures / totalFeatures;

    // Boost confidence if multiple strong signals align
    const strongSignals = Object.values(scores).filter(score => score > 0.7).length;
    const confidenceBoost = Math.min(strongSignals * 0.1, 0.3);

    return Math.min(featureCoverage + confidenceBoost, 1.0);
  }

  /**
   * Extract top scoring reasons for explanation
   */
  extractTopReasons(scores, count = 3) {
    const reasonMap = {
      artistProximity: 'Similar to artists you love',
      tagSimilarity: 'Matches your favorite genres',
      eraFit: 'From your preferred time period',
      labelScene: 'From labels/regions you enjoy',
      moodFit: 'Matches your mood preferences',
      external: 'Highly recommended by music community'
    };

    return Object.entries(scores)
      .filter(([key, score]) => score > 0.1) // Only meaningful scores
      .sort(([,a], [,b]) => b - a) // Sort by score descending
      .slice(0, count)
      .map(([key, score]) => ({
        reason: reasonMap[key],
        strength: score,
        category: key
      }));
  }

  /**
   * Generate human-readable explanation for recommendation
   */
  generateExplanation(candidate, scores, totalScore) {
    const topReasons = this.extractTopReasons(scores, 2);

    if (topReasons.length === 0) {
      return "This album was suggested based on general compatibility with your collection.";
    }

    const primaryReason = topReasons[0];
    const secondaryReason = topReasons[1];

    let explanation = primaryReason.reason;

    if (secondaryReason && secondaryReason.strength > 0.3) {
      explanation += ` and ${secondaryReason.reason.toLowerCase()}`;
    }

    // Add confidence qualifier
    if (totalScore > this.thresholds.excellentScore) {
      explanation = "Strong match: " + explanation;
    } else if (totalScore > this.thresholds.goodScore) {
      explanation = "Good match: " + explanation;
    } else {
      explanation = "Potential match: " + explanation;
    }

    return explanation + ".";
  }

  /**
   * Score multiple candidates and return sorted results
   */
  scoreMultipleCandidates(candidates, userProfile, userAlbums, externalData = null) {
    const scoredCandidates = candidates.map(candidate =>
      this.scoreCandidate(candidate, userProfile, userAlbums, externalData)
    );

    // Sort by total score descending
    return scoredCandidates
      .filter(result => result.totalScore >= this.thresholds.minimumScore)
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Update scoring weights based on user feedback
   */
  updateWeights(feedbackData) {
    // Implementation for adaptive learning
    // This would analyze user feedback to adjust weights
    console.log('Adaptive weight learning not yet implemented');
  }

  /**
   * Get current scoring configuration
   */
  getConfiguration() {
    return {
      weights: { ...this.weights },
      thresholds: { ...this.thresholds }
    };
  }
}

export default RecommendationScoring;
