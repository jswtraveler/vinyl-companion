// Image processing utilities for album cover enhancement

export class ImageProcessor {
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
    // Simple implementation - assumes the album cover is the main subject
    // In a full implementation, you could use edge detection to find rectangular shapes
    try {
      const img = await this.loadImage(imageDataUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // For now, return the center square of the image
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;
      
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, x, y, size, size, 0, 0, size, size);
      
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Album cover detection error:', error);
      return imageDataUrl;
    }
  }

  static async removeGlare(imageDataUrl) {
    try {
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
    } catch (error) {
      console.error('Glare removal error:', error);
      return imageDataUrl;
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
}