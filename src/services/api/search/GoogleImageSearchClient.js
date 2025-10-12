// Google Reverse Image Search API client (using third-party service)
const RATE_LIMIT = 2000; // 2 seconds between requests
let lastRequestTime = 0;

const enforceRateLimit = async () => {
  const timeSinceLastRequest = Date.now() - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT) {
    await new Promise(resolve =>
      setTimeout(resolve, RATE_LIMIT - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
};

export class GoogleImageSearchClient {
  static BASE_URL = 'https://google-reverse-image-api.vercel.app';

  static async searchByImage(imageUrl) {
    await enforceRateLimit();

    try {
      const response = await fetch(`${this.BASE_URL}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl })
      });

      if (!response.ok) {
        throw new Error(`Google Image Search error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseSearchResults(data);
    } catch (error) {
      console.error('Google Image Search error:', error);
      return [];
    }
  }

  static parseSearchResults(results) {
    // Parse Google search results to extract album information
    const albumResults = [];

    if (results.results) {
      for (const result of results.results.slice(0, 5)) {
        const albumInfo = this.extractAlbumInfo(result.title, result.snippet);
        if (albumInfo) {
          albumResults.push({
            ...albumInfo,
            source: 'google-image',
            url: result.link,
            confidence: 0.7
          });
        }
      }
    }

    return albumResults;
  }

  static extractAlbumInfo(title, snippet) {
    // Simple pattern matching for album information
    const patterns = {
      albumArtist: /(.+?)\s*[-–—]\s*(.+?)(?:\s*\(|\s*\[|$)/,
      year: /\b(19\d{2}|20\d{2})\b/,
      vinyl: /\b(vinyl|lp|record|album)\b/i
    };

    const albumArtistMatch = title.match(patterns.albumArtist);
    const yearMatch = (title + ' ' + snippet).match(patterns.year);
    const vinylMatch = (title + ' ' + snippet).match(patterns.vinyl);

    if (albumArtistMatch && vinylMatch) {
      return {
        artist: albumArtistMatch[1].trim(),
        title: albumArtistMatch[2].trim(),
        year: yearMatch ? parseInt(yearMatch[1]) : null
      };
    }

    return null;
  }
}

export default GoogleImageSearchClient;
