// Image processing utilities for album cover enhancement
import cv from '@techstark/opencv-js';

export class ImageProcessor {
  static openCvLoaded = false;

  static async initializeOpenCV() {
    if (this.openCvLoaded) return true;
    
    try {
      // OpenCV.js is loaded asynchronously
      await new Promise((resolve, reject) => {
        if (cv.getBuildInformation) {
          this.openCvLoaded = true;
          resolve();
        } else {
          cv.onRuntimeInitialized = () => {
            this.openCvLoaded = true;
            resolve();
          };
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error('OpenCV initialization timeout')), 10000);
        }
      });
      
      console.log('OpenCV.js initialized successfully');
      return true;
    } catch (error) {
      console.warn('OpenCV.js initialization failed, falling back to basic processing:', error);
      return false;
    }
  }
  static async preprocessImage(imageDataUrl) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = await this.loadImage(imageDataUrl);
      
      // Set canvas size
      const maxSize = 1024;
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Draw and process image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Apply enhancements
      this.enhanceContrast(ctx, canvas.width, canvas.height);
      this.reduceBrightness(ctx, canvas.width, canvas.height);
      
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Image preprocessing error:', error);
      return imageDataUrl; // Return original on error
    }
  }

  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  static enhanceContrast(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = 1.2; // Contrast enhancement factor
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast enhancement to RGB channels
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));     // Red
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128)); // Green
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128)); // Blue
      // Alpha channel (data[i + 3]) remains unchanged
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  static reduceBrightness(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const adjustment = -10; // Slight brightness reduction
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + adjustment));     // Red
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + adjustment)); // Green
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + adjustment)); // Blue
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  static async detectAlbumCoverArea(imageDataUrl) {
    try {
      // Try advanced OpenCV detection first
      if (await this.initializeOpenCV()) {
        const advancedResult = await this.detectAlbumCoverWithOpenCV(imageDataUrl);
        if (advancedResult) return advancedResult;
      }
      
      // Fallback to simple center crop
      return await this.detectAlbumCoverSimple(imageDataUrl);
    } catch (error) {
      console.error('Album cover detection error:', error);
      return imageDataUrl;
    }
  }

  static async detectAlbumCoverSimple(imageDataUrl) {
    // Simple implementation - assumes the album cover is the main subject
    const img = await this.loadImage(imageDataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Return the center square of the image
    const size = Math.min(img.width, img.height);
    const x = (img.width - size) / 2;
    const y = (img.height - size) / 2;
    
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, x, y, size, size, 0, 0, size, size);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  static async detectAlbumCoverWithOpenCV(imageDataUrl) {
    try {
      const img = await this.loadImage(imageDataUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Convert to OpenCV format
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      
      // Convert to grayscale and detect edges
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, 50, 150);
      
      // Find contours
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      let bestRect = null;
      let bestArea = 0;
      
      // Look for rectangular contours (potential album covers)
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const approx = new cv.Mat();
        const peri = cv.arcLength(contour, true);
        
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);
        
        // Look for 4-sided polygons (rectangles)
        if (approx.rows === 4) {
          const rect = cv.boundingRect(contour);
          const area = rect.width * rect.height;
          const aspectRatio = rect.width / rect.height;
          
          // Album covers are typically square or close to square
          if (area > bestArea && area > (img.width * img.height) * 0.1 && 
              aspectRatio >= 0.8 && aspectRatio <= 1.2) {
            bestArea = area;
            bestRect = rect;
          }
        }
        
        approx.delete();
        contour.delete();
      }
      
      // Clean up OpenCV objects
      src.delete();
      gray.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      
      // If we found a good rectangular area, crop to it
      if (bestRect && bestArea > 0) {
        const outputCanvas = document.createElement('canvas');
        const outputCtx = outputCanvas.getContext('2d');
        
        outputCanvas.width = bestRect.width;
        outputCanvas.height = bestRect.height;
        
        outputCtx.drawImage(
          img, 
          bestRect.x, bestRect.y, bestRect.width, bestRect.height,
          0, 0, bestRect.width, bestRect.height
        );
        
        console.log('OpenCV: Detected album cover area:', bestRect);
        return outputCanvas.toDataURL('image/jpeg', 0.8);
      }
      
      return null; // Fall back to simple method
    } catch (error) {
      console.error('OpenCV album detection error:', error);
      return null; // Fall back to simple method
    }
  }

  static async removeGlare(imageDataUrl) {
    try {
      // Try advanced OpenCV glare removal first
      if (await this.initializeOpenCV()) {
        const advancedResult = await this.removeGlareWithOpenCV(imageDataUrl);
        if (advancedResult) return advancedResult;
      }
      
      // Fallback to simple pixel-based approach
      return await this.removeGlareSimple(imageDataUrl);
    } catch (error) {
      console.error('Glare removal error:', error);
      return imageDataUrl;
    }
  }

  static async removeGlareSimple(imageDataUrl) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await this.loadImage(imageDataUrl);
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Simple glare reduction - tone down very bright pixels
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      
      if (brightness > 200) {
        const reduction = (brightness - 200) / 255 * 0.3;
        data[i] = Math.max(0, data[i] - data[i] * reduction);
        data[i + 1] = Math.max(0, data[i + 1] - data[i + 1] * reduction);
        data[i + 2] = Math.max(0, data[i + 2] - data[i + 2] * reduction);
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  static async removeGlareWithOpenCV(imageDataUrl) {
    try {
      const img = await this.loadImage(imageDataUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const src = cv.imread(canvas);
      const result = new cv.Mat();
      
      // Convert to LAB color space for better light handling
      const lab = new cv.Mat();
      cv.cvtColor(src, lab, cv.COLOR_RGB2Lab);
      
      // Split LAB channels
      const labChannels = new cv.MatVector();
      cv.split(lab, labChannels);
      
      const L = labChannels.get(0);  // Lightness channel
      const A = labChannels.get(1);  // Green-Red channel
      const B = labChannels.get(2);  // Blue-Yellow channel
      
      // Apply adaptive histogram equalization to lightness channel
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      const enhancedL = new cv.Mat();
      clahe.apply(L, enhancedL);
      
      // Merge channels back
      const enhancedChannels = new cv.MatVector();
      enhancedChannels.push_back(enhancedL);
      enhancedChannels.push_back(A);
      enhancedChannels.push_back(B);
      
      cv.merge(enhancedChannels, lab);
      cv.cvtColor(lab, result, cv.COLOR_Lab2RGB);
      
      // Apply median blur to reduce noise
      const smoothed = new cv.Mat();
      cv.medianBlur(result, smoothed, 3);
      
      // Display result
      cv.imshow(canvas, smoothed);
      
      // Clean up
      src.delete();
      result.delete();
      lab.delete();
      labChannels.delete();
      L.delete();
      A.delete();
      B.delete();
      enhancedL.delete();
      enhancedChannels.delete();
      smoothed.delete();
      clahe.delete();
      
      console.log('OpenCV: Applied advanced glare reduction');
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('OpenCV glare removal error:', error);
      return null; // Fall back to simple method
    }
  }

  static async standardizeImage(imageDataUrl, targetSize = 512) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = await this.loadImage(imageDataUrl);
      
      // Create square canvas
      canvas.width = targetSize;
      canvas.height = targetSize;
      
      // Calculate dimensions to maintain aspect ratio
      let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
      
      if (img.width > img.height) {
        drawHeight = targetSize;
        drawWidth = (img.width / img.height) * targetSize;
        offsetX = -(drawWidth - targetSize) / 2;
      } else {
        drawWidth = targetSize;
        drawHeight = (img.height / img.width) * targetSize;
        offsetY = -(drawHeight - targetSize) / 2;
      }
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);
      
      // Draw image
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
      console.error('Image standardization error:', error);
      return imageDataUrl;
    }
  }

  static async compressImage(imageDataUrl, quality = 0.8, maxSize = 1024) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = await this.loadImage(imageDataUrl);
      
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width *= scale;
        height *= scale;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      return canvas.toDataURL('image/jpeg', quality);
    } catch (error) {
      console.error('Image compression error:', error);
      return imageDataUrl;
    }
  }

  static async processForIdentification(imageDataUrl) {
    try {
      // Complete processing pipeline for album identification
      let processed = imageDataUrl;
      
      // Step 1: Crop to album cover area
      processed = await this.detectAlbumCoverArea(processed);
      
      // Step 2: Remove glare
      processed = await this.removeGlare(processed);
      
      // Step 3: Enhance image
      processed = await this.preprocessImage(processed);
      
      // Step 4: Standardize size
      processed = await this.standardizeImage(processed, 800);
      
      return processed;
    } catch (error) {
      console.error('Full processing pipeline error:', error);
      return imageDataUrl;
    }
  }

  // Utility functions for data format conversion
  static dataURLToBlob(dataURL) {
    try {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error('Data URL to blob conversion error:', error);
      return null;
    }
  }

  static blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  static async optimizeForAPI(imageDataUrl, targetFormat = 'jpeg', quality = 0.8) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = await this.loadImage(imageDataUrl);
      
      // Optimal size for API processing (balance between quality and speed)
      const maxSize = 1024;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Use high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const mimeType = targetFormat === 'png' ? 'image/png' : 'image/jpeg';
      return canvas.toDataURL(mimeType, quality);
    } catch (error) {
      console.error('API optimization error:', error);
      return imageDataUrl;
    }
  }

  static getImageDimensions(imageDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }

  static async validateImageSize(imageDataUrl, maxSizeBytes = 5 * 1024 * 1024) {
    try {
      const blob = this.dataURLToBlob(imageDataUrl);
      if (!blob) return false;
      
      return blob.size <= maxSizeBytes;
    } catch (error) {
      console.error('Image size validation error:', error);
      return false;
    }
  }
}