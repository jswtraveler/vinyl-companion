import { serpApiClient } from './api/search/SerpApiClient.js';
import { MusicBrainzClient, DiscogsClient } from './api/music/index.js';
import Database from './database/index.js';
import { ImageProcessor } from '../utils/imageProcessing.js';
import { OCRService } from '../utils/ocrService.js';

export class AlbumIdentifier {
  static async identifyFromImage(imageData) {
    const cacheKey = `serpapi-image-${this.generateImageHash(imageData)}`;
    
    // Check cache first
    const cached = await Database.getCacheItem(cacheKey);
    if (cached) {
      console.log('AlbumIdentifier: Using cached result');
      return cached;
    }

    try {
      console.log('AlbumIdentifier: Starting image identification with SerpAPI');
      
      // Step 1: Process image for optimal API results
      console.log('AlbumIdentifier: Processing image for identification...');
      const processedImage = await ImageProcessor.processForIdentification(imageData);
      
      // Validate image size before sending to API
      const isValidSize = await ImageProcessor.validateImageSize(processedImage);
      if (!isValidSize) {
        console.warn('AlbumIdentifier: Image too large, compressing...');
        const compressedImage = await ImageProcessor.compressImage(processedImage, 0.7, 800);
        var finalImage = compressedImage;
      } else {
        var finalImage = processedImage;
      }
      
      // Step 2: Try to upload image to get a real URL for SerpAPI
      const imageUrl = await this.uploadImageToTempStorage(finalImage);
      
      // Check if upload was successful (should be an http URL, not data URL)
      const isRealUrl = imageUrl.startsWith('http');
      console.log('AlbumIdentifier: Image URL type:', isRealUrl ? 'Real URL (uploaded)' : 'Data URL (upload failed)');
      
      let serpResult;
      if (isRealUrl) {
        // Step 2a: Use SerpAPI with real URL
        console.log('AlbumIdentifier: Attempting SerpAPI with uploaded image...');
        serpResult = await serpApiClient.identifyAlbum(imageUrl);
      } else {
        // Step 2b: SerpAPI won't work with data URLs, skip to OCR
        console.log('AlbumIdentifier: Skipping SerpAPI (no uploaded URL), going to OCR fallback...');
        serpResult = { success: false, error: { message: 'No uploaded image URL available for SerpAPI' } };
      }
      
      if (!serpResult.success) {
        console.error('SerpAPI identification failed, trying OCR fallback...');
        
        // Step 2b: If SerpAPI fails, try OCR as fallback
        const ocrResult = await OCRService.identifyFromOCR(finalImage);
        if (ocrResult) {
          console.log('OCR fallback found text:', ocrResult.extractedText);
          
          // Use OCR extracted text for MusicBrainz search
          const query = `${ocrResult.artist || ''} ${ocrResult.title || ''}`.trim();
          if (query.length > 2) {
            const mbResults = await MusicBrainzClient.searchReleases(query);
            if (mbResults.length > 0) {
              const finalResult = {
                success: true,
                method: 'ocr-fallback',
                identificationId: Date.now().toString(),
                timestamp: new Date().toISOString(),
                imageUrl: imageUrl,
                processedImage: finalImage,
                candidates: mbResults.slice(0, 5),
                topResult: mbResults[0],
                metadata: {
                  ocrExtractedText: ocrResult.extractedText,
                  ocrAlbumInfo: ocrResult,
                  fallbackMethod: true,
                  candidateCount: mbResults.length,
                  imageProcessed: true,
                  imageCompressed: !isValidSize,
                  originalImageSize: await ImageProcessor.getImageDimensions(imageData),
                  processedImageSize: await ImageProcessor.getImageDimensions(finalImage)
                }
              };
              
              await Database.setCacheItem(cacheKey, finalResult, 24 * 60 * 60 * 1000);
              return finalResult;
            }
          }
        }
        
        return {
          success: false,
          error: serpResult.error,
          candidates: [],
          method: 'serpapi'
        };
      }

      const results = [];
      
      // Convert SerpAPI candidates to our format
      for (const candidate of serpResult.candidates) {
        results.push({
          title: candidate.title,
          artist: candidate.artist,
          year: candidate.year,
          confidence: candidate.confidence || candidate.qualityScore,
          source: 'serpapi-' + candidate.source,
          coverImage: candidate.thumbnail,
          metadata: {
            serpApiCandidate: candidate,
            identificationId: serpResult.identificationId
          }
        });
      }

      // Step 2: Enrich with Discogs vinyl-specific data first (prioritize vinyl database)
      for (const result of results.slice(0, 3)) {
        if (result.artist && result.title) {
          try {
            const query = `${result.artist} ${result.title}`;
            const discogsResults = await DiscogsClient?.searchReleases?.(query) || [];
            
            if (discogsResults.length > 0) {
              const discogsData = discogsResults[0];
              // Discogs data takes priority for vinyl records
              result.year = discogsData.year || result.year;
              result.label = discogsData.label;
              result.catalogNumber = discogsData.catalogNumber;
              result.format = discogsData.format;
              result.pressing = discogsData.pressing;
              result.genre = discogsData.genre;
              result.metadata.discogsId = discogsData.id;
              result.metadata.enrichedWithDiscogs = true;
            }
          } catch (discogsError) {
            console.warn('Discogs enrichment failed:', discogsError.message);
          }
        }
      }

      // Step 3: Fill gaps with MusicBrainz data (secondary enrichment)
      for (const result of results.slice(0, 2)) {
        if (result.artist && result.title) {
          try {
            const query = `${result.artist} ${result.title}`;
            const mbResults = await MusicBrainzClient?.searchReleases?.(query) || [];
            
            if (mbResults.length > 0) {
              const mbData = mbResults[0];
              // Only fill missing fields, don't override Discogs data
              result.year = result.year || mbData.year;
              result.label = result.label || mbData.label;
              result.catalogNumber = result.catalogNumber || mbData.catalogNumber;
              result.genre = result.genre || mbData.genre;
              result.metadata.musicbrainzId = mbData.id;
              result.metadata.enrichedWithMB = true;
            }
          } catch (mbError) {
            console.warn('MusicBrainz enrichment failed:', mbError.message);
          }
        }
      }

      // Final result structure
      const finalResult = {
        success: true,
        method: 'serpapi',
        identificationId: Date.now().toString(),
        timestamp: serpResult.timestamp,
        imageUrl: imageUrl,
        processedImage: finalImage,
        candidates: this.rankResults(results),
        topResult: results[0] || null,
        metadata: {
          serpApiMetadata: serpResult.searchMetadata,
          processingTimeMs: serpResult.searchMetadata?.processing_time * 1000 || 0,
          candidateCount: results.length,
          imageProcessed: true,
          imageCompressed: !isValidSize,
          originalImageSize: await ImageProcessor.getImageDimensions(imageData),
          processedImageSize: await ImageProcessor.getImageDimensions(finalImage)
        }
      };
      
      // Cache results for 24 hours
      await Database.setCacheItem(cacheKey, finalResult, 24 * 60 * 60 * 1000);

      console.log(`AlbumIdentifier: Found ${results.length} candidates`);
      return finalResult;
      
    } catch (error) {
      console.error('Album identification error:', error);
      return {
        success: false,
        method: 'serpapi',
        error: {
          message: error.message,
          type: error.type || 'UNKNOWN_ERROR'
        },
        candidates: [],
        topResult: null
      };
    }
  }

  static async identifyFromText(title, artist) {
    const cacheKey = `text-${title}-${artist}`;

    // Check cache first
    const cached = await Database.getCacheItem(cacheKey);
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
      await Database.setCacheItem(cacheKey, rankedResults);

      return rankedResults;
    } catch (error) {
      console.error('Text-based identification error:', error);
      return [];
    }
  }

  static async identifyFromOCR(imageData) {
    const cacheKey = `ocr-image-${this.generateImageHash(imageData)}`;

    // Check cache first
    const cached = await Database.getCacheItem(cacheKey);
    if (cached) {
      console.log('AlbumIdentifier: Using cached OCR result');
      return cached;
    }

    try {
      console.log('AlbumIdentifier: Starting OCR-based identification');
      
      // Step 1: Process image for optimal OCR results
      const processedImage = await ImageProcessor.processForIdentification(imageData);
      const ocrOptimizedImage = await OCRService.preprocessImageForOCR(processedImage);
      
      // Step 2: Extract text using OCR
      const ocrResult = await OCRService.identifyFromOCR(ocrOptimizedImage);
      
      if (!ocrResult || (!ocrResult.title && !ocrResult.artist)) {
        return {
          success: false,
          method: 'ocr',
          error: { message: 'No readable text found in image', type: 'OCR_NO_TEXT' },
          candidates: [],
          topResult: null
        };
      }

      // Step 3: Search databases with extracted text
      const results = [];
      const query = `${ocrResult.artist || ''} ${ocrResult.title || ''}`.trim();
      
      if (query.length > 2) {
        // Search MusicBrainz
        try {
          const mbResults = await MusicBrainzClient.searchReleases(query);
          results.push(...mbResults.map(result => ({
            ...result,
            confidence: result.confidence * 0.8, // OCR results are less reliable
            source: 'ocr-musicbrainz'
          })));
        } catch (error) {
          console.warn('MusicBrainz search failed:', error);
        }

        // Search Discogs if available
        try {
          const discogsResults = await DiscogsClient.searchReleases(query);
          results.push(...discogsResults.map(result => ({
            ...result,
            confidence: result.confidence * 0.8,
            source: 'ocr-discogs'
          })));
        } catch (error) {
          console.warn('Discogs search failed:', error);
        }
      }

      // Final result structure
      const finalResult = {
        success: results.length > 0,
        method: 'ocr',
        identificationId: Date.now().toString(),
        timestamp: new Date().toISOString(),
        processedImage: processedImage,
        ocrOptimizedImage: ocrOptimizedImage,
        candidates: this.rankResults(results),
        topResult: results.length > 0 ? results[0] : null,
        metadata: {
          ocrExtractedText: ocrResult.extractedText,
          ocrAlbumInfo: {
            artist: ocrResult.artist,
            title: ocrResult.title,
            year: ocrResult.year
          },
          searchQuery: query,
          candidateCount: results.length,
          imageProcessed: true,
          originalImageSize: await ImageProcessor.getImageDimensions(imageData),
          processedImageSize: await ImageProcessor.getImageDimensions(processedImage)
        }
      };
      
      // Cache results for 24 hours
      await Database.setCacheItem(cacheKey, finalResult, 24 * 60 * 60 * 1000);

      console.log(`AlbumIdentifier: OCR identification completed with ${results.length} candidates`);
      return finalResult;
      
    } catch (error) {
      console.error('OCR identification error:', error);
      return {
        success: false,
        method: 'ocr',
        error: {
          message: error.message,
          type: error.type || 'UNKNOWN_ERROR'
        },
        candidates: [],
        topResult: null
      };
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
    try {
      console.log('AlbumIdentifier: Uploading image to temporary storage...');
      
      // Convert base64 to blob for ImgBB upload
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' });

      // Upload to ImgBB with provided API key
      const formData = new FormData();
      formData.append('image', blob);
      formData.append('expiration', '3600'); // Auto-delete after 1 hour for privacy
      
      const response = await fetch('https://api.imgbb.com/1/upload?key=8a905a9698e8c7b923adb320ae329c47', {
        method: 'POST',
        body: formData
      });

      console.log('ImgBB upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ImgBB upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('ImgBB upload result success:', result.success);
      
      if (!result.success) {
        throw new Error('ImgBB upload failed: ' + JSON.stringify(result));
      }

      const imageUrl = result.data.url;
      console.log('AlbumIdentifier: Image uploaded successfully to ImgBB:', imageUrl);
      return imageUrl;

    } catch (error) {
      console.warn('AlbumIdentifier: ImgBB upload failed, falling back to data URL:', error.message);
      console.warn('AlbumIdentifier: This will skip SerpAPI and use OCR fallback');
      
      // Fallback to original behavior if upload fails
      return imageData;
    }
  }

  static async getAlbumCover(result) {
    try {
      // Try to get cover from Cover Art Archive if we have MusicBrainz ID
      if (result.source === 'musicbrainz' && result.id) {
        const { CoverArtClient } = await import('./api/music/index.js');
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