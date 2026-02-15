import { useState } from 'react';
import { ImageProcessor } from '../utils/imageProcessing';

/**
 * Custom hook for handling album identification from images
 *
 * @returns {Object} Identification state and methods
 */
export function useAlbumIdentification() {
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationStage, setIdentificationStage] = useState('searching');
  const [identificationProgress, setIdentificationProgress] = useState(0);
  const [identificationResults, setIdentificationResults] = useState(null);
  const [identifyingImage, setIdentifyingImage] = useState(null);
  const [showIdentificationResults, setShowIdentificationResults] = useState(false);

  const handleIdentifyAlbum = async (imageData) => {
    try {
      console.log('Starting album identification with mobile proxy support...');

      // Test environment variable first
      const apiKey = import.meta.env.VITE_SERPAPI_KEY;
      if (!apiKey) {
        console.error('SerpAPI key not found');
        return {
          success: false,
          error: 'SerpAPI key not configured',
          imageData
        };
      }

      // Show identification progress UI
      setIsIdentifying(true);
      setIdentificationStage('initializing');
      setIdentificationProgress(10);
      setIdentifyingImage(imageData);

      try {
        // Step 1: Initialize SerpAPI client with mobile proxy support
        setIdentificationStage('initializing');
        const { SerpApiClient } = await import('../services/api/search/SerpApiClient.js');
        const serpClient = new SerpApiClient(apiKey);

        const debugInfo = serpClient.getDebugInfo();
        console.log('SerpAPI Client Debug Info:', debugInfo);

        setIdentificationProgress(20);

        // Step 2: Process image for optimal API results
        setIdentificationStage('processing');
        const { ImageProcessor } = await import('../utils/imageProcessing.js');

        let processedImage;
        try {
          processedImage = await ImageProcessor.optimizeForAPI(imageData);
          console.log('Image processed successfully');
        } catch (processingError) {
          console.warn('Image processing failed, using original:', processingError);
          processedImage = imageData; // Fallback to original
        }

        setIdentificationProgress(40);

        // Step 3: Perform album identification with timeout
        setIdentificationStage('searching');
        const identificationTimeout = 30000; // 30 seconds timeout

        const identificationPromise = serpClient.identifyAlbum(processedImage);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Identification timeout - taking too long')), identificationTimeout)
        );

        const result = await Promise.race([identificationPromise, timeoutPromise]);

        setIdentificationProgress(80);

        if (result.success && result.candidates && result.candidates.length > 0) {
          // Success! Show results
          console.log('Album identification successful:', result);
          setIdentificationStage('complete');
          setIdentificationProgress(100);
          setIdentificationResults(result);

          const topResult = result.candidates[0];
          const albumData = {
            title: topResult.title || 'Unknown Title',
            artist: topResult.artist || 'Unknown Artist',
            year: topResult.year || null,
            coverImage: imageData,
            notes: `Identified via SerpAPI (${result.requestMethod}) - Confidence: ${Math.round((topResult.confidence || 0.5) * 100)}%`,
            identificationMethod: 'serpapi-' + result.requestMethod,
            genre: [],
            purchasePrice: null,
            purchaseLocation: ''
          };

          // Wait a moment to show completion
          await new Promise(resolve => setTimeout(resolve, 1000));
          setIsIdentifying(false);

          return {
            success: true,
            albumData
          };

        } else {
          // No results found
          console.warn('No album matches found:', result);
          setIdentificationStage('no-results');
          setIdentificationProgress(100);

          await new Promise(resolve => setTimeout(resolve, 2000));
          setIsIdentifying(false);

          return {
            success: false,
            error: 'No matches found for this album cover',
            imageData
          };
        }

      } catch (error) {
        console.error('Album identification error:', error);

        // Determine error type and provide appropriate feedback
        let errorMessage = 'Identification failed';
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out - please try again';
        } else if (error.message.includes('CORS') || error.message.includes('Network')) {
          errorMessage = 'Network error - using manual entry';
        } else if (error.type === 'PROXY_ERROR') {
          errorMessage = 'Service temporarily unavailable';
        }

        setIdentificationStage('error');
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsIdentifying(false);

        return {
          success: false,
          error: errorMessage,
          imageData,
          originalError: error
        };
      }

    } catch (error) {
      console.error('Critical identification error:', error);
      setIsIdentifying(false);

      return {
        success: false,
        error: 'Identification system error',
        imageData,
        originalError: error
      };
    }
  };

  const handleCameraIdentify = async (imageData) => {
    try {
      console.log('User chose to identify album with captured photo');

      // Start identification process using existing file upload logic
      setIsIdentifying(true);
      setIdentificationResults(null);
      setIdentifyingImage(imageData); // Store the captured image

      // Process the image for identification
      console.log('Processing captured image...');
      const processedImage = await ImageProcessor.processForIdentification(imageData);

      if (!processedImage) {
        throw new Error('Failed to process captured image');
      }

      // Start identification using comprehensive album identifier
      console.log('Starting album identification...');
      const { AlbumIdentifier } = await import('../services/albumIdentifier.js');

      try {
        const result = await AlbumIdentifier.identifyFromImage(processedImage);

        if (result && result.candidates && result.candidates.length > 0) {
          console.log('Identification successful:', result);
          setIdentificationResults(result);
          setShowIdentificationResults(true);
          setIsIdentifying(false);

          return {
            success: true,
            showResults: true,
            results: result
          };
        } else {
          console.log('No albums found in identification');
          setIsIdentifying(false);

          // Fallback to manual entry with the captured image
          return {
            success: false,
            error: 'Album cover captured with camera - identification found no results',
            imageData
          };
        }
      } catch (identError) {
        console.error('Identification failed:', identError);
        setIsIdentifying(false);

        // Fallback to manual entry with the captured image
        return {
          success: false,
          error: 'Album cover captured with camera - identification failed',
          imageData,
          originalError: identError
        };
      }
    } catch (err) {
      console.error('Failed to identify camera capture:', err);
      setIsIdentifying(false);

      return {
        success: false,
        error: `Failed to identify album: ${err.message}`,
        imageData,
        originalError: err
      };
    }
  };

  const handleCloseIdentificationResults = () => {
    console.log('Closing identification results');
    setShowIdentificationResults(false);
    setIdentificationResults(null);
    setIdentifyingImage(null);
    setIsIdentifying(false);
  };

  const handleSelectIdentifiedAlbum = (selectedAlbum) => {
    console.log('User selected identified album:', selectedAlbum);

    // Close identification results
    setShowIdentificationResults(false);

    // Prepare album data with the captured image and selected metadata
    const albumWithMetadata = {
      ...selectedAlbum,
      coverImage: identifyingImage, // Use the captured image
      identificationMethod: 'camera-serpapi',
      notes: selectedAlbum.notes || 'Album identified from camera capture',
      // Preserve user-editable fields as empty for user input
      purchasePrice: null,
      purchaseLocation: '',
      // Let user edit condition if they want
      condition: selectedAlbum.condition || 'Near Mint'
    };

    return albumWithMetadata;
  };

  return {
    isIdentifying,
    identificationStage,
    identificationProgress,
    identificationResults,
    identifyingImage,
    showIdentificationResults,
    handleIdentifyAlbum,
    handleCameraIdentify,
    handleCloseIdentificationResults,
    handleSelectIdentifiedAlbum
  };
}
