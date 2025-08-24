import { MusicBrainzClient, DiscogsClient, GoogleImageSearchClient } from './apiClients.js';
import { getCacheItem, setCacheItem } from './database.js';

export class AlbumIdentifier {
  static async identifyFromImage(imageData) {
    const cacheKey = `image-${this.generateImageHash(imageData)}`;
    
    // Check cache first
    const cached = await getCacheItem(cacheKey);
    if (cached) {
      return cached;
    }

    const results = [];

    try {
      // Step 1: Google reverse image search
      const imageUrl = await this.uploadImageToTempStorage(imageData);
      const googleResults = await GoogleImageSearchClient.searchByImage(imageUrl);
      results.push(...googleResults);

      // Step 2: If we have potential matches, search MusicBrainz for details
      for (const result of googleResults.slice(0, 3)) {
        const query = `${result.artist} ${result.title}`;
        const mbResults = await MusicBrainzClient.searchReleases(query);
        results.push(...mbResults);
      }

      // Step 3: Search Discogs for vinyl-specific information
      for (const result of googleResults.slice(0, 2)) {
        const query = `${result.artist} ${result.title}`;
        const discogsResults = await DiscogsClient.searchReleases(query);
        results.push(...discogsResults);
      }

      // Rank and deduplicate results
      const rankedResults = this.rankResults(results);
      
      // Cache results
      await setCacheItem(cacheKey, rankedResults);
      
      return rankedResults;
    } catch (error) {
      console.error('Album identification error:', error);
      return [];
    }
  }

  static async identifyFromText(title, artist) {
    const cacheKey = `text-${title}-${artist}`;
    
    // Check cache first
    const cached = await getCacheItem(cacheKey);
    if (cached) {
      return cached;
    }

    const results = [];
    const query = `${artist} ${title}`;

    try {
      // Search MusicBrainz
      const mbResults = await MusicBrainzClient.searchReleases(query);
      results.push(...mbResults);

      // Search Discogs
      const discogsResults = await DiscogsClient.searchReleases(query);
      results.push(...discogsResults);

      // Rank results
      const rankedResults = this.rankResults(results);
      
      // Cache results
      await setCacheItem(cacheKey, rankedResults);
      
      return rankedResults;
    } catch (error) {
      console.error('Text-based identification error:', error);
      return [];
    }
  }

  static rankResults(results) {
    // Remove duplicates and rank by confidence and completeness
    const uniqueResults = new Map();
    
    for (const result of results) {
      const key = `${result.artist}-${result.title}`.toLowerCase();
      
      if (!uniqueResults.has(key) || 
          uniqueResults.get(key).confidence < result.confidence) {
        uniqueResults.set(key, result);
      }
    }

    return Array.from(uniqueResults.values())
      .map(result => ({
        ...result,
        completeness: this.calculateCompleteness(result)
      }))
      .sort((a, b) => {
        // Sort by confidence * completeness score
        const scoreA = a.confidence * a.completeness;
        const scoreB = b.confidence * b.completeness;
        return scoreB - scoreA;
      })
      .slice(0, 10); // Return top 10 results
  }

  static calculateCompleteness(result) {
    const fields = ['title', 'artist', 'year', 'label', 'catalogNumber'];
    const completedFields = fields.filter(field => 
      result[field] && result[field] !== 'Unknown Artist'
    ).length;
    
    return completedFields / fields.length;
  }

  static generateImageHash(imageData) {
    // Simple hash generation for caching
    let hash = 0;
    for (let i = 0; i < imageData.length; i++) {
      const char = imageData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  static async uploadImageToTempStorage(imageData) {
    // For now, return the data URL directly
    // In production, you might want to upload to a temporary storage service
    return imageData;
  }

  static async getAlbumCover(result) {
    try {
      // Try to get cover from Cover Art Archive if we have MusicBrainz ID
      if (result.source === 'musicbrainz' && result.id) {
        const { CoverArtClient } = await import('./apiClients.js');
        const coverUrl = await CoverArtClient.getCoverArt(result.id);
        if (coverUrl) return coverUrl;
      }

      // Use Discogs cover image if available
      if (result.coverImage) {
        return result.coverImage;
      }

      return null;
    } catch (error) {
      console.error('Error fetching album cover:', error);
      return null;
    }
  }

  static async enrichAlbumData(result) {
    try {
      const enrichedData = { ...result };

      // Get cover art
      const coverUrl = await this.getAlbumCover(result);
      if (coverUrl) {
        enrichedData.coverImage = coverUrl;
      }

      // If this is a Google result, try to get more details from MusicBrainz
      if (result.source === 'google-image') {
        const query = `${result.artist} ${result.title}`;
        const mbResults = await MusicBrainzClient.searchReleases(query);
        if (mbResults.length > 0) {
          const mbData = mbResults[0];
          enrichedData.year = mbData.year || enrichedData.year;
          enrichedData.label = mbData.label || enrichedData.label;
          enrichedData.catalogNumber = mbData.catalogNumber || enrichedData.catalogNumber;
          enrichedData.metadata = {
            ...enrichedData.metadata,
            musicbrainzId: mbData.id
          };
        }
      }

      return enrichedData;
    } catch (error) {
      console.error('Error enriching album data:', error);
      return result;
    }
  }
}