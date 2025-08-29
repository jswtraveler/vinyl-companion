import { openDB } from 'idb';

/**
 * Album Cover Caching Service
 * Downloads, caches and manages album cover images
 */
export class CoverCacheService {
  static DB_NAME = 'VinylCompanionCovers';
  static DB_VERSION = 1;
  static STORE_NAME = 'covers';
  static CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  static MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit

  static db = null;

  /**
   * Initialize the IndexedDB database for cover caching
   */
  static async initDB() {
    if (this.db) return this.db;

    try {
      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'url' });
            store.createIndex('timestamp', 'timestamp');
            store.createIndex('size', 'size');
          }
        },
      });
      return this.db;
    } catch (error) {
      console.error('Failed to initialize cover cache database:', error);
      return null;
    }
  }

  /**
   * Download and cache an album cover image
   * @param {string} url - Cover image URL
   * @param {string} albumId - Album ID for reference
   * @returns {Promise<string>} Cached image data URL or original URL
   */
  static async cacheAlbumCover(url, albumId = null) {
    if (!url || typeof url !== 'string') return null;

    try {
      // Check if already cached
      const cached = await this.getCachedCover(url);
      if (cached) {
        console.log('Using cached cover:', url);
        return cached.dataUrl;
      }

      // Download the image
      console.log('Downloading cover:', url);
      const imageData = await this.downloadImage(url);
      if (!imageData) return url; // Return original URL if download fails

      // Cache the image
      await this.storeCoverInCache(url, imageData, albumId);
      
      return imageData.dataUrl;

    } catch (error) {
      console.error('Error caching album cover:', error);
      return url; // Return original URL as fallback
    }
  }

  /**
   * Download an image and convert to data URL
   * @param {string} url - Image URL
   * @returns {Promise<Object>} Image data with dataUrl, size, type
   */
  static async downloadImage(url) {
    try {
      // Handle relative URLs and ensure HTTPS
      const imageUrl = url.startsWith('http') ? url : `https:${url}`;

      const response = await fetch(imageUrl, {
        headers: {
          'Accept': 'image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch image: ${response.status} ${response.statusText}`);
        return null;
      }

      const blob = await response.blob();
      
      // Check if it's actually an image
      if (!blob.type.startsWith('image/')) {
        console.warn('Downloaded content is not an image:', blob.type);
        return null;
      }

      // Limit image size (skip very large images)
      if (blob.size > 5 * 1024 * 1024) { // 5MB limit per image
        console.warn('Image too large, skipping cache:', blob.size);
        return null;
      }

      // Convert to data URL for caching
      const dataUrl = await this.blobToDataURL(blob);
      
      return {
        dataUrl,
        size: blob.size,
        type: blob.type,
        originalUrl: url
      };

    } catch (error) {
      console.error('Error downloading image:', error);
      return null;
    }
  }

  /**
   * Convert blob to data URL
   * @param {Blob} blob - Image blob
   * @returns {Promise<string>} Data URL
   */
  static blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Store cover image in IndexedDB cache
   * @param {string} url - Original image URL
   * @param {Object} imageData - Image data with dataUrl, size, type
   * @param {string} albumId - Optional album ID
   */
  static async storeCoverInCache(url, imageData, albumId = null) {
    const db = await this.initDB();
    if (!db) return;

    try {
      // Check cache size and cleanup if needed
      await this.cleanupCacheIfNeeded();

      const cacheEntry = {
        url,
        dataUrl: imageData.dataUrl,
        size: imageData.size,
        type: imageData.type,
        albumId,
        timestamp: Date.now()
      };

      await db.put(this.STORE_NAME, cacheEntry);
      console.log('Cached cover image:', url);

    } catch (error) {
      console.error('Error storing cover in cache:', error);
    }
  }

  /**
   * Get cached cover image
   * @param {string} url - Image URL
   * @returns {Promise<Object|null>} Cached image data or null
   */
  static async getCachedCover(url) {
    const db = await this.initDB();
    if (!db) return null;

    try {
      const cached = await db.get(this.STORE_NAME, url);
      
      if (!cached) return null;

      // Check if cache entry is still valid
      const age = Date.now() - cached.timestamp;
      if (age > this.CACHE_DURATION) {
        // Remove expired entry
        await db.delete(this.STORE_NAME, url);
        return null;
      }

      return cached;

    } catch (error) {
      console.error('Error retrieving cached cover:', error);
      return null;
    }
  }

  /**
   * Clean up cache if it exceeds size limit
   */
  static async cleanupCacheIfNeeded() {
    const db = await this.initDB();
    if (!db) return;

    try {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore;
      const allEntries = await store.getAll();
      
      // Calculate total cache size
      const totalSize = allEntries.reduce((sum, entry) => sum + (entry.size || 0), 0);
      
      if (totalSize <= this.MAX_CACHE_SIZE) {
        return; // Cache size is fine
      }

      console.log(`Cache cleanup needed. Current size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

      // Sort by timestamp (oldest first)
      allEntries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest entries until we're under the limit
      let remainingSize = totalSize;
      for (const entry of allEntries) {
        if (remainingSize <= this.MAX_CACHE_SIZE * 0.8) { // Leave some headroom
          break;
        }

        await store.delete(entry.url);
        remainingSize -= entry.size || 0;
        console.log('Removed cached cover:', entry.url);
      }

      await tx.complete;
      console.log(`Cache cleanup complete. New size: ${(remainingSize / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Clear all cached covers
   */
  static async clearCache() {
    const db = await this.initDB();
    if (!db) return;

    try {
      await db.clear(this.STORE_NAME);
      console.log('Cover cache cleared');
    } catch (error) {
      console.error('Error clearing cover cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  static async getCacheStats() {
    const db = await this.initDB();
    if (!db) return { count: 0, totalSize: 0 };

    try {
      const allEntries = await db.getAll(this.STORE_NAME);
      const totalSize = allEntries.reduce((sum, entry) => sum + (entry.size || 0), 0);
      const now = Date.now();
      
      const validEntries = allEntries.filter(entry => 
        (now - entry.timestamp) < this.CACHE_DURATION
      );

      return {
        count: allEntries.length,
        validCount: validEntries.length,
        totalSize,
        totalSizeMB: parseFloat((totalSize / 1024 / 1024).toFixed(2)),
        maxSizeMB: parseFloat((this.MAX_CACHE_SIZE / 1024 / 1024).toFixed(2))
      };

    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { count: 0, totalSize: 0, error: error.message };
    }
  }

  /**
   * Remove a specific cached cover
   * @param {string} url - Image URL to remove
   */
  static async removeCachedCover(url) {
    const db = await this.initDB();
    if (!db) return;

    try {
      await db.delete(this.STORE_NAME, url);
      console.log('Removed cached cover:', url);
    } catch (error) {
      console.error('Error removing cached cover:', error);
    }
  }

  /**
   * Preload and cache multiple album covers
   * @param {Array<string>} urls - Array of image URLs
   * @param {Array<string>} albumIds - Optional array of album IDs
   */
  static async preloadCovers(urls, albumIds = []) {
    const promises = urls.map((url, index) => 
      this.cacheAlbumCover(url, albumIds[index])
    );

    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      console.log(`Preloaded ${successful}/${urls.length} covers`);
      return results;
    } catch (error) {
      console.error('Error preloading covers:', error);
      return [];
    }
  }
}

/**
 * Utility function to get optimized cover URL for display
 * @param {string} originalUrl - Original cover URL
 * @param {string} albumId - Album ID
 * @param {boolean} cache - Whether to cache the image
 * @returns {Promise<string>} Optimized cover URL
 */
export async function getOptimizedCoverUrl(originalUrl, albumId = null, cache = true) {
  if (!originalUrl) return null;

  if (cache) {
    return await CoverCacheService.cacheAlbumCover(originalUrl, albumId);
  }

  return originalUrl;
}