/**
 * Progressive Collection Service
 *
 * Gradually improves metadata cache coverage by fetching similar artists
 * for recommended candidates in the background during user idle time.
 *
 * Features:
 * - Idle detection (starts after 30s inactivity)
 * - Priority-based queue (fetch high-value artists first)
 * - Rate limiting (respects API limits)
 * - Pause/resume on user activity
 * - Progress persistence across sessions
 */

export class ProgressiveCollectionService {
  constructor(dataFetcher, cacheService, options = {}) {
    this.dataFetcher = dataFetcher;
    this.cacheService = cacheService;

    // Collection state
    this.isRunning = false;
    this.isPaused = false;
    this.priorityQueue = [];
    this.completedArtists = new Set();
    this.failedArtists = new Map(); // artist -> { attempts, lastAttempt }
    this.fetchedCount = 0;

    // Configuration
    this.options = {
      idleThreshold: 30000,        // 30 seconds of inactivity
      requestDelay: 1000,          // 1 second between requests
      maxQueueSize: 100,           // Maximum artists to queue
      maxRetries: 3,               // Max retry attempts for failed fetches
      retryBackoff: 60000,         // 1 minute before retry
      storageKey: 'progressive_collection_state',
      ...options
    };

    // Idle detection
    this.idleTimer = null;
    this.isUserIdle = false;
    this.activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Bind methods
    this.handleUserActivity = this.handleUserActivity.bind(this);

    console.log('📦 ProgressiveCollectionService initialized');
  }

  /**
   * Start idle detection - begins monitoring user activity
   */
  startIdleDetection() {
    if (this.idleTimer) {
      console.log('⚠️ Idle detection already running');
      return;
    }

    console.log('👁️ Starting idle detection...');

    // Attach activity listeners
    this.activityEvents.forEach(event => {
      window.addEventListener(event, this.handleUserActivity, { passive: true });
    });

    // Start idle timer
    this.resetIdleTimer();
  }

  /**
   * Stop idle detection and cleanup
   */
  stopIdleDetection() {
    console.log('🛑 Stopping idle detection');

    // Remove activity listeners
    this.activityEvents.forEach(event => {
      window.removeEventListener(event, this.handleUserActivity);
    });

    // Clear timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.isUserIdle = false;
  }

  /**
   * Handle user activity - resets idle timer and pauses collection if running
   */
  handleUserActivity() {
    // If we were idle and collection is running, pause it
    if (this.isUserIdle && this.isRunning && !this.isPaused) {
      console.log('⏸️ User active - pausing collection');
      this.pauseCollection();
    }

    this.isUserIdle = false;
    this.resetIdleTimer();
  }

  /**
   * Reset the idle timer
   */
  resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      console.log('💤 User idle - starting collection');
      this.isUserIdle = true;

      // Auto-start collection if we have a queue and aren't already running
      if (this.priorityQueue.length > 0 && !this.isRunning) {
        this.startCollection();
      } else if (this.isPaused) {
        this.resumeCollection();
      }
    }, this.options.idleThreshold);
  }

  /**
   * Build priority queue from candidate artists
   * @param {Array} candidates - Artist candidates to potentially fetch
   * @param {Array} ownedArtists - User's owned artists (to exclude)
   */
  async buildPriorityQueue(candidates, ownedArtists = []) {
    console.log('🎯 Building priority queue from', candidates.length, 'candidates');

    const ownedSet = new Set(ownedArtists.map(a =>
      (a.artist || a).toLowerCase()
    ));

    // Filter and score candidates
    const scoredCandidates = [];

    for (const candidate of candidates) {
      const artistName = candidate.artist;
      const normalizedName = artistName.toLowerCase();

      // Skip if owned
      if (ownedSet.has(normalizedName)) continue;

      // Skip if already completed
      if (this.completedArtists.has(normalizedName)) continue;

      // Skip if recently failed
      if (this.shouldSkipDueToFailure(normalizedName)) continue;

      // Check if already in cache
      if (this.cacheService) {
        const cached = await this.cacheService.getArtistMetadataCache(artistName, 'lastfm');
        if (cached) {
          this.completedArtists.add(normalizedName);
          continue;
        }
      }

      // Calculate priority score
      const priorityScore = this.calculatePriority(candidate);

      scoredCandidates.push({
        name: artistName,
        mbid: candidate.mbid || null,
        score: priorityScore,
        connectionCount: candidate.connectionCount || 0,
        recommendationScore: candidate.score || 0
      });
    }

    // Sort by priority (highest first) - no queue size limit
    this.priorityQueue = scoredCandidates
      .sort((a, b) => b.score - a.score);

    console.log(`✅ Priority queue built: ${this.priorityQueue.length} artists`);
    console.log('📊 Top 5:', this.priorityQueue.slice(0, 5).map(a => a.name));

    // Save progress
    this.saveProgress();

    return this.priorityQueue.length;
  }

  /**
   * Calculate priority score for an artist
   */
  calculatePriority(artist) {
    const recommendationScore = (artist.score || 0) / 100; // Normalize
    const connectionCount = Math.min((artist.connectionCount || 0) / 10, 1); // Cap at 10
    const frequency = (artist.recommendationFrequency || 0) / 10; // How often seen
    const popularity = Math.min((artist.listeners || 0) / 1000000, 1); // Cap at 1M

    return (
      recommendationScore * 0.4 +
      connectionCount * 0.3 +
      frequency * 0.2 +
      popularity * 0.1
    );
  }

  /**
   * Check if artist should be skipped due to previous failures
   */
  shouldSkipDueToFailure(artistName) {
    const failure = this.failedArtists.get(artistName);
    if (!failure) return false;

    // Skip if max retries exceeded
    if (failure.attempts >= this.options.maxRetries) {
      return true;
    }

    // Skip if not enough time passed since last attempt
    const timeSinceLastAttempt = Date.now() - failure.lastAttempt;
    const backoffDelay = this.options.retryBackoff * Math.pow(2, failure.attempts - 1);

    return timeSinceLastAttempt < backoffDelay;
  }

  /**
   * Get next artist from queue
   */
  getNextArtist() {
    while (this.priorityQueue.length > 0) {
      const artist = this.priorityQueue.shift();
      const normalizedName = artist.name.toLowerCase();

      // Double-check it's not completed or should be skipped
      if (!this.completedArtists.has(normalizedName) &&
          !this.shouldSkipDueToFailure(normalizedName)) {
        return artist;
      }
    }

    return null;
  }

  /**
   * Start the collection process
   */
  async startCollection() {
    if (this.isRunning) {
      console.log('⚠️ Collection already running');
      return;
    }

    if (this.priorityQueue.length === 0) {
      console.log('⚠️ No artists in queue');
      return;
    }

    console.log('🚀 Starting progressive collection');
    this.isRunning = true;
    this.isPaused = false;

    await this.runCollectionLoop();
  }

  /**
   * Main collection loop
   */
  async runCollectionLoop() {
    while (this.isRunning && !this.isPaused) {
      // Check if user is no longer idle
      if (!this.isUserIdle) {
        console.log('⏸️ User no longer idle - pausing collection');
        this.pauseCollection();
        break;
      }

      // Get next artist
      const artist = this.getNextArtist();

      if (!artist) {
        console.log('✅ Collection complete - no more artists in queue');
        this.stopCollection();
        break;
      }

      // Fetch metadata for this artist
      await this.fetchArtistMetadata(artist);

      // Wait before next request (rate limiting)
      await this.delay(this.options.requestDelay);

      // Save progress periodically
      if (this.fetchedCount % 10 === 0) {
        this.saveProgress();
      }
    }
  }

  /**
   * Fetch metadata for a single artist
   */
  async fetchArtistMetadata(artist) {
    const normalizedName = artist.name.toLowerCase();

    console.log(`🔄 Fetching metadata: ${artist.name} (${this.fetchedCount + 1}/${this.fetchedCount + this.priorityQueue.length + 1})`);

    try {
      // Use the dataFetcher to fetch metadata
      const metadata = await this.dataFetcher.fetchMetadataForArtists([artist], {
        maxConcurrent: 1
      });

      if (metadata && Object.keys(metadata).length > 0) {
        this.completedArtists.add(normalizedName);
        this.fetchedCount++;

        // Remove from failed artists if it was there
        this.failedArtists.delete(normalizedName);

        console.log(`✅ Fetched: ${artist.name} (${this.fetchedCount} total)`);
      } else {
        // Mark as failed
        this.recordFailure(normalizedName);
        console.log(`⚠️ No metadata returned for ${artist.name}`);
      }

    } catch (error) {
      console.error(`❌ Failed to fetch ${artist.name}:`, error);
      this.recordFailure(normalizedName);
    }
  }

  /**
   * Record a failure for retry logic
   */
  recordFailure(artistName) {
    const existing = this.failedArtists.get(artistName) || { attempts: 0 };
    this.failedArtists.set(artistName, {
      attempts: existing.attempts + 1,
      lastAttempt: Date.now()
    });
  }

  /**
   * Pause the collection process
   */
  pauseCollection() {
    if (!this.isRunning || this.isPaused) return;

    console.log('⏸️ Pausing collection');
    this.isPaused = true;
    this.saveProgress();
  }

  /**
   * Resume the collection process
   */
  resumeCollection() {
    if (!this.isRunning || !this.isPaused) return;

    console.log('▶️ Resuming collection');
    this.isPaused = false;
    this.runCollectionLoop();
  }

  /**
   * Stop the collection process
   */
  stopCollection() {
    console.log('🛑 Stopping collection');
    this.isRunning = false;
    this.isPaused = false;
    this.saveProgress();
  }

  /**
   * Get current progress
   */
  getProgress() {
    const total = this.fetchedCount + this.priorityQueue.length;
    const percentage = total > 0 ? (this.fetchedCount / total) * 100 : 0;

    return {
      fetched: this.fetchedCount,
      remaining: this.priorityQueue.length,
      total: total,
      percentage: Math.round(percentage),
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isIdle: this.isUserIdle,
      completedArtists: Array.from(this.completedArtists),
      failedCount: this.failedArtists.size
    };
  }

  /**
   * Save progress to localStorage
   */
  saveProgress() {
    try {
      const state = {
        priorityQueue: this.priorityQueue,
        completedArtists: Array.from(this.completedArtists),
        failedArtists: Array.from(this.failedArtists.entries()),
        fetchedCount: this.fetchedCount,
        lastSaved: Date.now()
      };

      localStorage.setItem(this.options.storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }

  /**
   * Load progress from localStorage
   */
  loadProgress() {
    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (!saved) return false;

      const state = JSON.parse(saved);

      // Check if saved state is recent (< 24 hours old)
      const age = Date.now() - (state.lastSaved || 0);
      if (age > 24 * 60 * 60 * 1000) {
        console.log('📦 Saved progress is stale (>24h), ignoring');
        return false;
      }

      this.priorityQueue = state.priorityQueue || [];
      this.completedArtists = new Set(state.completedArtists || []);
      this.failedArtists = new Map(state.failedArtists || []);
      this.fetchedCount = state.fetchedCount || 0;

      console.log('📦 Loaded progress:', this.getProgress());
      return true;

    } catch (error) {
      console.error('Failed to load progress:', error);
      return false;
    }
  }

  /**
   * Clear all progress and reset
   */
  clearProgress() {
    console.log('🗑️ Clearing progress');

    this.stopCollection();
    this.priorityQueue = [];
    this.completedArtists.clear();
    this.failedArtists.clear();
    this.fetchedCount = 0;

    localStorage.removeItem(this.options.storageKey);
  }

  /**
   * Utility: delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup - call when component unmounts
   */
  destroy() {
    console.log('💥 Destroying ProgressiveCollectionService');
    this.stopIdleDetection();
    this.stopCollection();
    this.saveProgress();
  }
}

export default ProgressiveCollectionService;