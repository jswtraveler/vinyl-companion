/**
 * Graph-based Recommendation Service
 * Implements Personalized PageRank algorithm for multi-hop artist discovery
 * Uses PostgreSQL for efficient graph computation with degree normalization
 */

import { supabase } from '../../database/supabaseClient.js';

export class GraphRecommendationService {
  constructor(options = {}) {
    this.supabase = options.supabaseClient || supabase;
    this.config = {
      maxIterations: options.maxIterations || 20,
      dampingFactor: options.dampingFactor || 0.85,
      convergenceThreshold: options.convergenceThreshold || 0.0001,
      minSimilarityThreshold: options.minSimilarityThreshold || 0.3,
      maxRecommendations: options.maxRecommendations || 50,
      enableLogging: options.enableLogging !== false
    };
  }

  /**
   * Generate artist recommendations using Personalized PageRank
   * @param {string} userId - User ID
   * @param {Array} userAlbums - User's album collection
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} PPR-based recommendations
   */
  async generateGraphRecommendations(userId, userAlbums, options = {}) {
    const startTime = Date.now();

    try {
      this.log('🎯 Starting PPR-based artist discovery...');

      // Extract user artists for restart nodes
      const userArtists = this.extractUserArtists(userAlbums);

      if (userArtists.length === 0) {
        return {
          success: false,
          error: 'No user artists found for PPR'
        };
      }

      this.log(`📍 Restart nodes: ${userArtists.length} artists`);

      // Execute Personalized PageRank algorithm via PostgreSQL
      const pprResults = await this.executePersonalizedPageRank(userId, userArtists, options);

      if (!pprResults.success) {
        return pprResults;
      }

      // Process and score PPR results
      const recommendations = await this.processGraphResults(
        pprResults.data,
        userArtists,
        options
      );

      const duration = Date.now() - startTime;
      this.log(`✅ PPR recommendations generated in ${duration}ms`);

      return {
        success: true,
        recommendations: recommendations.artists,
        metadata: {
          algorithm: 'personalized_pagerank',
          duration,
          seedArtists: userArtists.length,
          totalCandidates: recommendations.totalCandidates,
          dampingFactor: options.dampingFactor || this.config.dampingFactor,
          maxIterations: options.maxIterations || this.config.maxIterations,
          ...recommendations.metadata
        }
      };

    } catch (error) {
      console.error('❌ PPR recommendation generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute Personalized PageRank algorithm using PostgreSQL
   * @param {string} userId - User ID
   * @param {Array} userArtists - User's artists as restart nodes
   * @param {Object} options - PPR parameters
   * @returns {Promise<Object>} Raw PPR results
   */
  async executePersonalizedPageRank(userId, userArtists, options = {}) {
    try {
      const maxIterations = options.maxIterations || this.config.maxIterations;
      const dampingFactor = options.dampingFactor || this.config.dampingFactor;
      const minSimilarity = options.minSimilarityThreshold || this.config.minSimilarityThreshold;
      const convergenceThreshold = options.convergenceThreshold || this.config.convergenceThreshold;

      // Build user artists filter for SQL
      const userArtistNames = userArtists.map(a => a.toLowerCase());

      this.log(`🎯 Executing PPR: iterations=${maxIterations}, α=${dampingFactor}, threshold=${minSimilarity}`);

      // Execute the PPR function
      const { data, error } = await this.supabase.rpc('personalized_pagerank_recommendations', {
        p_user_id: userId,
        p_user_artists: userArtistNames,
        p_max_iterations: maxIterations,
        p_damping_factor: dampingFactor,
        p_min_similarity: minSimilarity,
        p_convergence_threshold: convergenceThreshold,
        p_max_results: this.config.maxRecommendations
      });

      if (error) {
        console.error('❌ PPR SQL error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        this.log('⚠️ Falling back to JavaScript PPR implementation');
        // Fallback to JavaScript-based PPR algorithm
        return await this.fallbackPPRTraversal(userArtists, options);
      }

      this.log(`✅ PostgreSQL PPR succeeded - found ${data?.length || 0} candidates`);

      return {
        success: true,
        data: data || [],
        method: 'postgresql_ppr'
      };

    } catch (error) {
      console.error('PPR execution failed:', error);
      // Fallback to JavaScript implementation
      return await this.fallbackPPRTraversal(userArtists, options);
    }
  }

  /**
   * Fallback JavaScript implementation of PPR
   * Used when PostgreSQL function is not available
   */
  async fallbackPPRTraversal(userArtists, options = {}) {
    this.log('🔄 Using JavaScript fallback for PPR...');

    try {
      const maxDepth = 3; // Still fetch graph up to 3 hops for data

      // Build multi-hop graph by fetching similarity data iteratively
      const graph = new Map();
      const toFetch = new Set(userArtists.map(a => a.toLowerCase()));
      const fetched = new Set();

      // Fetch similarity data up to maxDepth levels
      for (let depth = 0; depth < maxDepth && toFetch.size > 0; depth++) {
        const currentBatch = Array.from(toFetch);
        toFetch.clear();

        this.log(`📊 Fetching depth ${depth + 1}: ${currentBatch.length} artists`);

        const similarityData = await this.fetchSimilarityGraph(currentBatch);

        // Build adjacency list from this batch
        similarityData.forEach(record => {
          const sourceArtist = record.source_artist.toLowerCase();
          const targetArtist = record.target_artist.toLowerCase();
          const similarity = parseFloat(record.similarity_score) || 0;

          if (!graph.has(sourceArtist)) {
            graph.set(sourceArtist, []);
          }

          if (similarity >= this.config.minSimilarityThreshold) {
            graph.get(sourceArtist).push({
              artist: targetArtist,
              weight: similarity,
              originalName: record.target_artist
            });

            // Queue target for next depth if not already fetched
            if (!fetched.has(targetArtist) && depth < maxDepth - 1) {
              toFetch.add(targetArtist);
            }
          }
        });

        currentBatch.forEach(a => fetched.add(a.toLowerCase()));
      }

      if (graph.size === 0) {
        return {
          success: false,
          error: 'No similarity data available for PPR'
        };
      }

      this.log(`🕸️ Built graph with ${graph.size} nodes`);

      // Execute PPR algorithm in JavaScript
      const pprResults = this.performPersonalizedPageRank(graph, userArtists, options);

      return {
        success: true,
        data: pprResults,
        method: 'javascript_ppr_fallback'
      };

    } catch (error) {
      console.error('Fallback PPR traversal failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch similarity graph data from cache
   */
  async fetchSimilarityGraph(userArtists) {
    try {
      // Build case-insensitive filter using .or() with ilike
      const orFilters = userArtists
        .map(artist => `source_artist.ilike.${artist}`)
        .join(',');

      const { data, error } = await this.supabase
        .from('artist_similarity_cache')
        .select(`
          source_artist,
          target_artist,
          similarity_score,
          data_source
        `)
        .eq('data_source', 'lastfm')
        .or(orFilters);

      if (error) {
        console.warn('Failed to fetch similarity graph:', error);
        return [];
      }

      this.log(`📊 Fetched ${(data || []).length} similarity relationships for ${userArtists.length} artists`);
      return data || [];

    } catch (error) {
      console.error('Failed to fetch similarity graph:', error);
      return [];
    }
  }

  /**
   * Build adjacency list representation of the similarity graph
   */
  buildAdjacencyList(similarityData) {
    const graph = new Map();

    // New schema: each record is one relationship (source -> target)
    similarityData.forEach(record => {
      const sourceArtist = record.source_artist.toLowerCase();
      const targetArtist = record.target_artist.toLowerCase();
      const similarity = parseFloat(record.similarity_score) || 0;

      if (!graph.has(sourceArtist)) {
        graph.set(sourceArtist, []);
      }

      if (similarity >= this.config.minSimilarityThreshold) {
        graph.get(sourceArtist).push({
          artist: targetArtist,
          weight: similarity,
          originalName: record.target_artist,
          mbid: record.target_mbid
        });
      }
    });

    return graph;
  }

  /**
   * Perform Personalized PageRank algorithm in JavaScript
   * @param {Map} graph - Adjacency list representation of similarity graph
   * @param {Array} userArtists - User's artists (restart nodes)
   * @param {Object} options - PPR parameters
   * @returns {Array} PPR results with scores
   */
  performPersonalizedPageRank(graph, userArtists, options = {}) {
    const maxIterations = options.maxIterations || this.config.maxIterations;
    const dampingFactor = options.dampingFactor || this.config.dampingFactor;
    const convergenceThreshold = options.convergenceThreshold || this.config.convergenceThreshold;
    const userArtistSet = new Set(userArtists.map(a => a.toLowerCase()));

    // Initialize scores and degrees
    const scores = new Map();
    const degrees = new Map();

    // Calculate initial scores and node degrees
    const initialScore = 1.0 / userArtists.length;
    const restartProb = (1.0 - dampingFactor) / userArtists.length;

    // Initialize all nodes in graph
    for (const [artist, neighbors] of graph.entries()) {
      scores.set(artist, userArtistSet.has(artist) ? initialScore : 0.0);
      degrees.set(artist, neighbors.length);
    }

    // Add neighbor artists not yet in scores
    for (const neighbors of graph.values()) {
      for (const neighbor of neighbors) {
        if (!scores.has(neighbor.artist)) {
          scores.set(neighbor.artist, 0.0);
          degrees.set(neighbor.artist, 0);
        }
      }
    }

    this.log(`🔄 PPR: ${scores.size} nodes, ${userArtists.length} restart nodes`);

    // PageRank iterations
    let iteration = 0;
    let maxChange = Infinity;

    while (iteration < maxIterations && maxChange > convergenceThreshold) {
      iteration++;
      const newScores = new Map();

      // Initialize with restart probability for user artists
      for (const artist of scores.keys()) {
        newScores.set(artist, userArtistSet.has(artist) ? restartProb : 0.0);
      }

      // Propagate scores along edges
      for (const [artist, neighbors] of graph.entries()) {
        const currentScore = scores.get(artist) || 0.0;
        if (currentScore === 0.0 || neighbors.length === 0) continue;

        // Calculate total outgoing similarity for normalization
        const totalSimilarity = neighbors.reduce((sum, n) => sum + n.weight, 0);

        // Distribute score to neighbors (weighted by edge similarity)
        for (const neighbor of neighbors) {
          const propagatedScore =
            currentScore * dampingFactor * (neighbor.weight / totalSimilarity);

          const currentNew = newScores.get(neighbor.artist) || 0.0;
          newScores.set(neighbor.artist, currentNew + propagatedScore);
        }
      }

      // Calculate convergence
      maxChange = 0;
      for (const [artist, score] of scores.entries()) {
        const newScore = newScores.get(artist) || 0.0;
        maxChange = Math.max(maxChange, Math.abs(newScore - score));
      }

      // Update scores
      for (const [artist, score] of newScores.entries()) {
        scores.set(artist, score);
      }

      this.log(`🔄 PPR iteration ${iteration}: max_change=${maxChange.toFixed(6)}`);
    }

    this.log(`✅ PPR converged in ${iteration} iterations`);

    // Apply degree normalization and format results
    const results = [];
    for (const [artist, score] of scores.entries()) {
      if (userArtistSet.has(artist)) continue; // Skip user's own artists
      if (score < 0.0001) continue; // Filter very low scores

      const degree = degrees.get(artist) || 1;
      const normalizedScore = score / Math.sqrt(degree);

      // Find connections to user artists
      const connectedTo = new Set();
      for (const userArtist of userArtists) {
        const neighbors = graph.get(userArtist.toLowerCase()) || [];
        if (neighbors.some(n => n.artist === artist)) {
          connectedTo.add(userArtist);
        }
      }

      results.push({
        target_artist: artist,
        ppr_score: parseFloat(score.toFixed(6)),
        normalized_score: parseFloat(normalizedScore.toFixed(6)),
        node_degree: degree,
        connected_to: Array.from(connectedTo),
        // For compatibility with existing code
        graph_score: parseFloat(normalizedScore.toFixed(6)),
        connection_breadth: connectedTo.size
      });
    }

    // Sort by normalized score
    return results.sort((a, b) => b.normalized_score - a.normalized_score);
  }

  /**
   * Process PPR results into final recommendations
   */
  async processGraphResults(graphData, userArtists, options = {}) {
    const userArtistSet = new Set(userArtists.map(a => a.toLowerCase()));

    // Fetch similarity scores for connections in parallel
    const enrichedData = await Promise.all(
      graphData.map(async (result) => {
        if (!result.connected_to || result.connected_to.length === 0) {
          return { ...result, connectionsWithScores: [] };
        }

        // Query similarity scores for this recommendation's connections
        try {
          const lowerTarget = result.target_artist.toLowerCase();
          const lowerSources = result.connected_to.map(a => a.toLowerCase());

          // Query with LOWER() to handle case mismatches in database
          // Note: Database stores artist names with original casing
          const { data, error } = await this.supabase
            .rpc('get_similarity_scores', {
              p_target: lowerTarget,
              p_sources: lowerSources
            });

          if (!error && data && data.length > 0) {
            this.log(`📊 Found ${data.length}/${lowerSources.length} similarity scores for ${result.target_artist}`);
            const connectionsWithScores = result.connected_to.map(artist => {
              const scoreData = data.find(d =>
                d.source_artist.toLowerCase() === artist.toLowerCase()
              );
              const similarity = scoreData ? parseFloat(scoreData.similarity_score) : 0.5;
              if (scoreData) {
                this.log(`  ✓ ${artist} → ${result.target_artist}: ${Math.round(similarity * 100)}%`);
              } else {
                this.log(`  ✗ ${artist} → ${result.target_artist}: not found in DB (using 50%)`);
              }
              return {
                sourceArtist: artist,
                similarity: similarity
              };
            });
            return { ...result, connectionsWithScores };
          }

          if (error) {
            console.warn('Similarity query error:', error);
          } else {
            this.log(`⚠️ No similarity data: searching for target="${lowerTarget}", sources=[${lowerSources.join(', ')}]`);
          }
        } catch (err) {
          console.warn('Failed to fetch connection scores:', err);
        }

        // Fallback: use default similarity
        return {
          ...result,
          connectionsWithScores: result.connected_to.map(artist => ({
            sourceArtist: artist,
            similarity: 0.5 // Default if query fails
          }))
        };
      })
    );

    // Filter out user's existing artists and process scores
    const candidates = enrichedData
      .filter(result => !userArtistSet.has(result.target_artist?.toLowerCase()))
      .map((result, index, array) => {
        // Calculate display score (scale up small PPR scores for better UX)
        let displayScore;

        // Debug logging
        if (index === 0) {
          this.log(`🔍 Score debugging - first result:`);
          this.log(`  normalized_score: ${result.normalized_score}`);
          this.log(`  ppr_score: ${result.ppr_score}`);
          this.log(`  graph_score: ${result.graph_score}`);
        }

        if (result.normalized_score !== null && result.normalized_score !== undefined) {
          // Get all normalized scores for scaling
          const allScores = array.map(r => r.normalized_score || 0).filter(s => s > 0);
          const maxScore = Math.max(...allScores);
          const minScore = Math.min(...allScores);

          if (index === 0) {
            this.log(`  Score range: ${minScore} - ${maxScore}`);
            this.log(`  Total candidates: ${allScores.length}`);
          }

          if (maxScore > 0 && maxScore !== minScore) {
            // Scale from min-max to 1-100 range
            displayScore = Math.round(((result.normalized_score - minScore) / (maxScore - minScore)) * 99 + 1);
          } else if (maxScore > 0) {
            // All same score
            displayScore = 50;
          } else {
            // All zero
            displayScore = 1;
          }
        } else if (result.graph_score) {
          displayScore = Math.round((result.graph_score || 0) * 100);
        } else {
          // Fallback: use ppr_score directly if normalized_score is null
          displayScore = 1;
        }

        if (index === 0) {
          this.log(`  Final display score: ${displayScore}%`);
        }

        return {
          artist: this.capitalizeArtistName(result.target_artist),
          score: displayScore,
          pprScore: result.ppr_score,
          normalizedScore: result.normalized_score,
          nodeDegree: result.node_degree,
          connectionCount: result.connected_to?.length || result.connection_breadth || 1,
          connections: (result.connectionsWithScores || []).map(conn => ({
            sourceArtist: this.capitalizeArtistName(conn.sourceArtist),
            similarity: conn.similarity
          })),
          reason: this.generateGraphReason(result)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxRecommendations);

    return {
      artists: candidates,
      totalCandidates: graphData.length,
      metadata: {
        averageConnections: candidates.length > 0
          ? Math.round(candidates.reduce((sum, a) => sum + a.connectionCount, 0) / candidates.length * 10) / 10
          : 0,
        maxScore: candidates[0]?.score || 0,
        averageDegree: candidates.length > 0
          ? Math.round(candidates.reduce((sum, a) => sum + (a.nodeDegree || 0), 0) / candidates.length)
          : 0,
        graphCoverage: Math.min(1, graphData.length / (userArtists.length * 10))
      }
    };
  }

  /**
   * Generate explanation for graph-based recommendation
   */
  generateGraphReason(result) {
    const connectionCount = result.connection_breadth || 1;
    const connectedArtists = result.connected_to || [];

    if (connectionCount === 1) {
      return `Discovered through ${this.capitalizeArtistName(connectedArtists[0] || 'similar artists')}`;
    } else if (connectionCount <= 3) {
      return `Connected to ${connectionCount} artists in your collection`;
    } else {
      return `Strongly connected to your music taste (${connectionCount} connections)`;
    }
  }

  /**
   * Extract unique artists from user's album collection
   */
  extractUserArtists(albums) {
    const artistSet = new Set();
    albums.forEach(album => {
      if (album.artist && album.artist.trim()) {
        artistSet.add(album.artist.trim());
      }
    });
    return Array.from(artistSet);
  }

  /**
   * Capitalize artist name for display
   */
  capitalizeArtistName(name) {
    if (!name || typeof name !== 'string') return name;
    return name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Logging helper
   */
  log(message) {
    if (this.config.enableLogging) {
      console.log(`[GraphRecommendations] ${message}`);
    }
  }
}

export default GraphRecommendationService;
