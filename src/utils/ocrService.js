import Tesseract from 'tesseract.js';

export class OCRService {
  static async extractText(imageDataUrl) {
    try {
      console.log('Starting OCR text extraction...');
      
      const { data: { text } } = await Tesseract.recognize(
        imageDataUrl,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -&.',
          tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT
        }
      );

      console.log('OCR completed, extracted text:', text);
      return this.cleanExtractedText(text);
    } catch (error) {
      console.error('OCR extraction error:', error);
      return '';
    }
  }

  static cleanExtractedText(text) {
    if (!text) return '';
    
    // Clean up the extracted text
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s-&.]/g, '') // Remove special characters except common ones
      .trim();
  }

  static extractAlbumInfo(text) {
    if (!text) return null;

    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const possibleTitles = [];
    const possibleArtists = [];
    
    // Look for patterns that might indicate artist/album names
    for (const line of lines) {
      // Skip very short lines or lines with too many numbers
      if (line.length < 3 || /\d{4,}/.test(line)) continue;
      
      // Lines with "&" might be artist names
      if (line.includes('&')) {
        possibleArtists.push(line);
      }
      
      // Longer lines might be album titles
      if (line.length > 10) {
        possibleTitles.push(line);
      }
      
      // All caps might be important (artist/album names)
      if (line === line.toUpperCase() && line.length > 3) {
        possibleTitles.push(line);
        possibleArtists.push(line);
      }
    }

    // Try to determine most likely artist and title
    const result = {};
    
    if (possibleArtists.length > 0) {
      result.artist = possibleArtists[0];
    }
    
    if (possibleTitles.length > 0) {
      // Use the title that's different from the artist
      const title = possibleTitles.find(t => 
        !possibleArtists.some(a => a.toLowerCase() === t.toLowerCase())
      ) || possibleTitles[0];
      
      result.title = title;
    }

    // Extract year if found
    const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1]);
    }

    // Only return if we found at least title or artist
    if (result.title || result.artist) {
      return result;
    }

    return null;
  }

  static async identifyFromOCR(imageDataUrl) {
    try {
      const extractedText = await this.extractText(imageDataUrl);
      
      if (!extractedText) {
        return null;
      }

      const albumInfo = this.extractAlbumInfo(extractedText);
      
      if (albumInfo) {
        return {
          ...albumInfo,
          extractedText,
          source: 'ocr',
          confidence: 0.6 // OCR results are generally less reliable
        };
      }

      return null;
    } catch (error) {
      console.error('OCR identification error:', error);
      return null;
    }
  }

  static async preprocessImageForOCR(imageDataUrl) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = await this.loadImage(imageDataUrl);
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Convert to grayscale for better OCR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = gray;     // Red
        data[i + 1] = gray; // Green
        data[i + 2] = gray; // Blue
        // Alpha channel remains unchanged
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // Increase contrast for better text recognition
      ctx.filter = 'contrast(150%) brightness(110%)';
      ctx.drawImage(canvas, 0, 0);
      
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('OCR preprocessing error:', error);
      return imageDataUrl;
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

  static async extractTextRegions(imageDataUrl) {
    // Future enhancement: identify text regions before OCR
    // For now, use the full image
    return [imageDataUrl];
  }
}