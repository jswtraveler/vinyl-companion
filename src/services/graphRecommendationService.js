/**
 * Graph-based Recommendation Service
 * Implements random walk with restart algorithm for multi-hop artist discovery
 * Uses PostgreSQL recursive CTEs for efficient graph traversal
 */

import { supabase } from './supabase.js';

export class GraphRecommendationService {
  constructor(options = {}) {
    this.supabase = options.supabaseClient || supabase;
    this.config = {
      maxWalkDepth: options.maxWalkDepth || 3,
      restartProbability: options.restartProbability || 0.15,
      minSimilarityThreshold: options.minSimilarityThreshold || 0.3,
      maxRecommendations: options.maxRecommendations || 50,
      enableLogging: options.enableLogging !== false
    };
  }

  /**
   * Generate artist recommendations using graph traversal
   * @param {string} userId - User ID
   * @param {Array} userAlbums - User's album collection
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Graph-based recommendations
   */
  async generateGraphRecommendations(userId, userAlbums, options = {}) {
    const startTime = Date.now();

    try {
      this.log('🕸️ Starting graph-based artist discovery...');

      // Extract user artists for graph seed points
      const userArtists = this.extractUserArtists(userAlbums);

      if (userArtists.length === 0) {
        return {
          success: false,
          error: 'No user artists found for graph traversal'
        };
      }

      this.log(`📍 Graph seed points: ${userArtists.length} artists`);

      // Execute random walk algorithm via PostgreSQL
      const graphResults = await this.executeRandomWalk(userId, userArtists, options);

      if (!graphResults.success) {
        return graphResults;
      }

      // Process and score graph traversal results
      const recommendations = await this.processGraphResults(
        graphResults.data,
        userArtists,
        options
      );

      const duration = Date.now() - startTime;
      this.log(`✅ Graph recommendations generated in ${duration}ms`);

      return {
        success: true,
        recommendations: recommendations.artists,
        metadata: {
          algorithm: 'random_walk_with_restart',
          duration,
          seedArtists: userArtists.length,
          totalCandidates: recommendations.totalCandidates,
          walkDepth: this.config.maxWalkDepth,
          restartProbability: this.config.restartProbability,
          ...recommendations.metadata
        }
      };

    } catch (error) {
      console.error('❌ Graph recommendation generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute random walk with restart algorithm using PostgreSQL recursive CTE
   * @param {string} userId - User ID
   * @param {Array} userArtists - User's artists as seed points
   * @param {Object} options - Walk parameters
   * @returns {Promise<Object>} Raw graph traversal results
   */
  async executeRandomWalk(userId, userArtists, options = {}) {
    try {
      const walkDepth = options.maxWalkDepth || this.config.maxWalkDepth;
      const restartProb = options.restartProbability || this.config.restartProbability;
      const minSimilarity = options.minSimilarityThreshold || this.config.minSimilarityThreshold;

      // Build user artists filter for SQL
      const userArtistNames = userArtists.map(a => a.toLowerCase());

      this.log(`🚶 Executing random walk: depth=${walkDepth}, restart=${restartProb}, threshold=${minSimilarity}`);

      // Execute the recursive CTE query
      const { data, error } = await this.supabase.rpc('graph_artist_recommendations', {
        p_user_id: userId,
        p_user_artists: userArtistNames,
        p_max_depth: walkDepth,
        p_restart_probability: restartProb,
        p_min_similarity: minSimilarity,
        p_max_results: this.config.maxRecommendations
      });

      if (error) {
        console.error('Graph traversal SQL error:', error);
        // Fallback to JavaScript-based graph algorithm
        return await this.fallbackGraphTraversal(userArtists, options);
      }

      this.log(`📊 Graph traversal found ${data?.length || 0} candidates`);

      return {
        success: true,
        data: data || [],
        method: 'postgresql_cte'
      };

    } catch (error) {
      console.error('Random walk execution failed:', error);
      // Fallback to JavaScript implementation
      return await this.fallbackGraphTraversal(userArtists, options);
    }
  }

  /**
   * Fallback JavaScript implementation of graph traversal
   * Used when PostgreSQL function is not available
   */
  async fallbackGraphTraversal(userArtists, options = {}) {
    this.log('🔄 Using JavaScript fallback for graph traversal...');

    try {
      // Get similarity data for user artists
      const similarityData = await this.fetchSimilarityGraph(userArtists);

      if (!similarityData.length) {
        return {
          success: false,
          error: 'No similarity data available for graph traversal'
        };
      }

      // Build adjacency list representation
      const graph = this.buildAdjacencyList(similarityData);

      // Execute random walk algorithm in JavaScript
      const walkResults = this.performRandomWalk(graph, userArtists, options);

      return {
        success: true,
        data: walkResults,
        method: 'javascript_fallback'
      };

    } catch (error) {
      console.error('Fallback graph traversal failed:', error);
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
    const artistNames = userArtists.map(a => a.toLowerCase());

    const { data, error } = await this.supabase
      .from('artist_similarity_cache')
      .select(`
        source_artist,
        target_artist,
        similarity_score,
        data_source
      `)
      .in('source_artist', artistNames)
      .eq('data_source', 'lastfm');

    if (error) {
      console.warn('Failed to fetch similarity graph:', error);
      return [];
    }

    return data || [];
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
   * Perform random walk with restart algorithm
   */
  performRandomWalk(graph, userArtists, options = {}) {
    const walkDepth = options.maxWalkDepth || this.config.maxWalkDepth;
    const restartProb = options.restartProbability || this.config.restartProbability;
    const userArtistSet = new Set(userArtists.map(a => a.toLowerCase()));

    // Track artist scores from random walks
    const artistScores = new Map();
    const walkPaths = new Map();

    // Perform multiple random walks from each user artist
    const walksPerArtist = 10; // Number of walks to perform from each seed

    userArtists.forEach(seedArtist => {
      const normalizedSeed = seedArtist.toLowerCase();

      for (let walkNum = 0; walkNum < walksPerArtist; walkNum++) {
        this.performSingleWalk(
          graph,
          normalizedSeed,
          userArtistSet,
          walkDepth,
          restartProb,
          artistScores,
          walkPaths
        );
      }
    });

    // Convert to result format
    const results = [];
    artistScores.forEach((score, artist) => {
      const paths = walkPaths.get(artist) || [];
      results.push({
        target_artist: artist,
        graph_score: score,
        connection_breadth: paths.length,
        connected_to: [...new Set(paths.map(p => p.sourceArtist))],
        walk_paths: paths.slice(0, 3) // Keep top 3 paths for explanation
      });
    });

    return results.sort((a, b) => b.graph_score - a.graph_score);
  }

  /**
   * Perform a single random walk
   */
  performSingleWalk(graph, startArtist, userArtistSet, maxDepth, restartProb, artistScores, walkPaths) {
    let currentArtist = startArtist;
    const path = [startArtist];

    for (let depth = 0; depth < maxDepth; depth++) {
      // Random restart check
      if (Math.random() < restartProb && depth > 0) {
        break;
      }

      // Get neighbors of current artist
      const neighbors = graph.get(currentArtist) || [];
      if (neighbors.length === 0) {
        break;
      }

      // Weighted random selection of next artist
      const totalWeight = neighbors.reduce((sum, n) => sum + n.weight, 0);
      const random = Math.random() * totalWeight;
      let cumulativeWeight = 0;

      let nextArtist = null;
      for (const neighbor of neighbors) {
        cumulativeWeight += neighbor.weight;
        if (random <= cumulativeWeight) {
          nextArtist = neighbor;
          break;
        }
      }

      if (!nextArtist) {
        break;
      }

      currentArtist = nextArtist.artist;
      path.push(currentArtist);

      // Score non-user artists encountered in walk
      if (!userArtistSet.has(currentArtist)) {
        const walkWeight = Math.pow(restartProb, depth); // Decay with distance
        artistScores.set(
          currentArtist,
          (artistScores.get(currentArtist) || 0) + walkWeight
        );

        // Track path for explanation
        if (!walkPaths.has(currentArtist)) {
          walkPaths.set(currentArtist, []);
        }
        walkPaths.get(currentArtist).push({
          sourceArtist: startArtist,
          path: [...path],
          weight: walkWeight,
          depth: depth + 1
        });
      }
    }
  }

  /**
   * Process graph traversal results into final recommendations
   */
  async processGraphResults(graphData, userArtists, options = {}) {
    const userArtistSet = new Set(userArtists.map(a => a.toLowerCase()));

    // Filter out user's existing artists and process scores
    const candidates = graphData
      .filter(result => !userArtistSet.has(result.target_artist?.toLowerCase()))
      .map(result => ({
        artist: this.capitalizeArtistName(result.target_artist),
        score: Math.round((result.graph_score || 0) * 100),
        connectionCount: result.connection_breadth || 1,
        connections: (result.connected_to || []).map(artist => ({
          sourceArtist: this.capitalizeArtistName(artist),
          paths: result.walk_paths || []
        })),
        walkPaths: result.walk_paths || [],
        reason: this.generateGraphReason(result)
      }))
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
        graphCoverage: Math.min(1, graphData.length / (userArtists.length * 10)) // Rough coverage estimate
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