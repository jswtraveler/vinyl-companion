/**
 * Google Gemini AI Client for Album Mood Analysis
 * Uses Supabase Edge Function proxy to keep API key secure
 */

import { supabase } from '../../database/supabaseClient.js';

class GeminiError extends Error {
  constructor(message, status, type) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.type = type;
  }
}

export class GeminiClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || null;
    this.useProxy = !this.apiKey; // Use proxy if no API key provided
    this.requestCount = 0;
    this.lastRequestTime = null;

    if (this.useProxy) {
      console.log('🤖 Gemini client using Edge Function proxy');
    }
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!this.apiKey || this.useProxy;
  }

  /**
   * Get current usage statistics
   */
  getUsageStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      isConfigured: this.isConfigured()
    };
  }

  /**
   * Rate limiting - ensure we don't exceed API limits
   */
  async rateLimit() {
    const now = Date.now();
    if (this.lastRequestTime) {
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minInterval = 1000; // 1 second minimum between requests
      
      if (timeSinceLastRequest < minInterval) {
        const waitTime = minInterval - timeSinceLastRequest;
        console.log(`Gemini API: Rate limiting - waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Generate content using Gemini API
   */
  async generateContent(prompt) {
    if (!this.isConfigured()) {
      throw new GeminiError('Gemini API key not configured', 401, 'MISSING_API_KEY');
    }

    await this.rateLimit();

    // Use Edge Function proxy if no API key provided
    if (this.useProxy) {
      return this.executeProxyRequest(prompt);
    }

    // Direct API call (legacy support)
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent analysis
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192, // Increased to prevent truncation
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log('Gemini API: Generating content...');

    try {
      const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      this.requestCount++;

      if (!response.ok) {
        const errorData = await response.json();
        throw new GeminiError(
          `Gemini API request failed: ${response.status} ${response.statusText}`,
          response.status,
          'API_ERROR'
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new GeminiError(data.error.message, 400, 'GENERATION_ERROR');
      }

      console.log('Gemini API: Content generated successfully');

      // Extract text from response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new GeminiError('No content generated', 500, 'EMPTY_RESPONSE');
      }

      return {
        success: true,
        content: text,
        timestamp: new Date().toISOString(),
        usage: data.usageMetadata
      };

    } catch (error) {
      console.error('Gemini API error:', error);

      if (error instanceof GeminiError) {
        throw error;
      }

      throw new GeminiError(
        `Gemini API network error: ${error.message}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Execute request through Edge Function proxy
   * @param {string} prompt - Prompt for content generation
   * @returns {Promise<Object>} API response
   */
  async executeProxyRequest(prompt) {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { action: 'generateContent', prompt }
      });

      if (error) {
        console.error('Gemini proxy error:', error);
        throw new GeminiError(`Gemini proxy error: ${error.message}`, 500, 'PROXY_ERROR');
      }

      if (!data.success) {
        throw new GeminiError(data.error || 'Unknown error', 500, 'PROXY_ERROR');
      }

      this.requestCount++;

      return {
        success: true,
        content: data.data.content,
        timestamp: data.data.timestamp,
        usage: data.data.usage
      };
    } catch (error) {
      console.error('Failed to call Gemini proxy:', error);

      if (error instanceof GeminiError) {
        throw error;
      }

      throw new GeminiError(
        `Gemini proxy network error: ${error.message}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Filter albums that need mood tag analysis
   */
  filterAlbumsForAnalysis(albums, options = {}) {
    const { onlyUntagged = true, minTagCount = 1 } = options;
    
    if (!onlyUntagged) {
      return { toAnalyze: albums, alreadyTagged: [] };
    }
    
    const toAnalyze = [];
    const alreadyTagged = [];
    
    albums.forEach(album => {
      const moodCount = album.moods ? album.moods.length : 0;
      
      if (moodCount === 0 || (moodCount < minTagCount && options.includePartial)) {
        toAnalyze.push(album);
      } else {
        alreadyTagged.push(album);
      }
    });
    
    return { toAnalyze, alreadyTagged };
  }

  /**
   * Analyze a collection of albums and suggest mood tags
   */
  async analyzeCollection(albums, availableMoods = [], options = {}) {
    if (!albums || albums.length === 0) {
      throw new GeminiError('No albums provided for analysis', 400, 'NO_ALBUMS');
    }

    // Filter albums based on analysis options
    const { toAnalyze, alreadyTagged } = this.filterAlbumsForAnalysis(albums, options);
    
    if (toAnalyze.length === 0) {
      return {
        success: true,
        analysis: [],
        skippedAlbums: alreadyTagged.map(album => ({
          albumId: album.id,
          title: album.title,
          artist: album.artist,
          existingMoods: album.moods || [],
          skippedReason: 'Already has mood tags'
        })),
        totalAnalyzed: 0,
        totalSkipped: alreadyTagged.length,
        timestamp: new Date().toISOString()
      };
    }

    const moodList = availableMoods.length > 0 
      ? availableMoods.map(m => m.label).join(', ')
      : 'Nostalgic, Energetic, Chill, Upbeat, Melancholic, Road Trip, Late Night, Sunday Morning, Dreamy, Raw, Comfort, Party';

    // Create a structured prompt for mood analysis
    const albumsToAnalyze = toAnalyze.slice(0, 50); // Limit to 50 albums per request
    const albumList = albumsToAnalyze
      .map((album, index) => 
        `${index + 1}. "${album.title}" by ${album.artist}${album.genre ? ` (${album.genre.join(', ')})` : ''}${album.year ? ` [${album.year}]` : ''}`
      ).join('\n');

    const prompt = `As a music expert, analyze these vinyl albums and suggest appropriate mood tags for each one.

Albums to analyze:
${albumList}

Available mood tags: ${moodList}

For each album, suggest 2-3 mood tags that best describe the emotional feeling or atmosphere of the music. Consider the genre, artist style, and general musical characteristics.

Please respond in this exact JSON format:
{
  "analysis": [
    {
      "index": 1,
      "title": "Album Title",
      "artist": "Artist Name", 
      "suggestedMoods": ["Mood1", "Mood2", "Mood3"],
      "reasoning": "Brief explanation of why these moods fit"
    }
  ]
}

Ensure the response is valid JSON and includes all ${Math.min(albumsToAnalyze.length, 50)} albums.`;

    try {
      const result = await this.generateContent(prompt);
      const analysis = this.parseAnalysisResponse(result.content, albumsToAnalyze);
      
      // Combine analysis results with skipped albums info
      const skippedAlbums = alreadyTagged.map(album => ({
        albumId: album.id,
        title: album.title,
        artist: album.artist,
        existingMoods: album.moods || [],
        skippedReason: 'Already has mood tags'
      }));
      
      return {
        success: true,
        analysis,
        skippedAlbums,
        totalAnalyzed: albumsToAnalyze.length,
        totalSkipped: alreadyTagged.length,
        totalAlbums: albums.length,
        timestamp: result.timestamp,
        usage: result.usage
      };

    } catch (error) {
      console.error('Collection analysis failed:', error);
      
      return {
        success: false,
        error: {
          message: error.message,
          type: error.type || 'ANALYSIS_ERROR'
        },
        analysis: [],
        skippedAlbums: [],
        totalAnalyzed: 0,
        totalSkipped: 0,
        totalAlbums: albums.length,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse the AI response into structured data
   */
  parseAnalysisResponse(content, originalAlbums) {
    try {
      console.log('Raw Gemini response:', content);
      
      // Try multiple approaches to extract JSON from the response
      let jsonString = null;
      
      // Try to find JSON block with markdown code fence
      const markdownJsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
      if (markdownJsonMatch) {
        jsonString = markdownJsonMatch[1];
      } else {
        // Try to find any JSON object
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        }
      }
      
      if (!jsonString) {
        console.error('No JSON found in response. Full content:', content);
        throw new Error('No JSON found in response');
      }

      console.log('Extracted JSON string:', jsonString);
      
      // Try to repair incomplete JSON by adding missing closing brackets
      let repairedJson = jsonString.trim();
      if (!repairedJson.endsWith('}')) {
        // Count opening vs closing brackets to determine what's missing
        const openBrackets = (repairedJson.match(/\{/g) || []).length;
        const closeBrackets = (repairedJson.match(/\}/g) || []).length;
        const openArrays = (repairedJson.match(/\[/g) || []).length;
        const closeArrays = (repairedJson.match(/\]/g) || []).length;
        
        console.log(`Bracket counts - Objects: ${openBrackets}/${closeBrackets}, Arrays: ${openArrays}/${closeArrays}`);
        
        // Remove trailing comma if present
        if (repairedJson.endsWith(',')) {
          repairedJson = repairedJson.slice(0, -1);
        }
        
        // Add missing closing brackets
        if (closeArrays < openArrays) {
          repairedJson += ']';
          console.log('Added missing ] bracket');
        }
        if (closeBrackets < openBrackets) {
          repairedJson += '}';
          console.log('Added missing } bracket');
        }
        
        console.log('Repaired JSON string:', repairedJson);
      }
      
      const parsed = JSON.parse(repairedJson);
      console.log('Parsed JSON:', parsed);
      
      if (!parsed.analysis || !Array.isArray(parsed.analysis)) {
        throw new Error('Invalid analysis format');
      }

      // Map the analysis back to the original albums
      return parsed.analysis.map((item, index) => {
        const originalAlbum = originalAlbums[index];
        return {
          albumId: originalAlbum?.id,
          title: originalAlbum?.title || item.title,
          artist: originalAlbum?.artist || item.artist,
          suggestedMoods: Array.isArray(item.suggestedMoods) ? item.suggestedMoods : [],
          reasoning: item.reasoning || '',
          confidence: 0.8 // Default confidence score
        };
      });

    } catch (error) {
      console.error('Failed to parse AI response:', error);
      
      // Fallback: create empty analysis for all albums
      return originalAlbums.map(album => ({
        albumId: album.id,
        title: album.title,
        artist: album.artist,
        suggestedMoods: [],
        reasoning: 'Analysis parsing failed',
        confidence: 0
      }));
    }
  }

  /**
   * Get mock results for testing (when API key not available)
   */
  async getMockAnalysis(albums) {
    console.log('Gemini API: Using mock analysis (no API key configured)');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockMoods = ['Nostalgic', 'Energetic', 'Chill', 'Melancholic', 'Dreamy'];
    
    return {
      success: true,
      analysis: albums.slice(0, 10).map(album => ({
        albumId: album.id,
        title: album.title,
        artist: album.artist,
        suggestedMoods: mockMoods.slice(0, 2 + Math.floor(Math.random() * 2)),
        reasoning: `Mock analysis for ${album.title} - suggested based on genre and style`,
        confidence: 0.7 + Math.random() * 0.3
      })),
      totalAlbums: Math.min(albums.length, 10),
      timestamp: new Date().toISOString(),
      usage: { inputTokens: 100, outputTokens: 200 }
    };
  }

  /**
   * Main method to analyze collection with fallback to mock
   */
  async analyzeCollectionWithFallback(albums, availableMoods = []) {
    try {
      if (!this.isConfigured()) {
        return await this.getMockAnalysis(albums);
      } else {
        return await this.analyzeCollection(albums, availableMoods);
      }
    } catch (error) {
      console.error('Analysis failed, using mock data:', error);
      return await this.getMockAnalysis(albums);
    }
  }
}

// Export singleton instance - read API key from env if available
export const geminiClient = new GeminiClient(import.meta.env.VITE_GEMINI_API_KEY);
export default geminiClient;

// Export error class for external use
export { GeminiError };