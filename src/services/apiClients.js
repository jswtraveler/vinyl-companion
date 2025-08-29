// API clients for external services
const RATE_LIMITS = {
  musicbrainz: 1000, // 1 second between requests
  discogs: 1000,     // 1 second to be safe
  google: 2000       // 2 seconds between requests
};

let lastRequestTimes = {};

const enforceRateLimit = async (service) => {
  const lastRequest = lastRequestTimes[service] || 0;
  const timeSinceLastRequest = Date.now() - lastRequest;
  const minInterval = RATE_LIMITS[service];

  if (timeSinceLastRequest < minInterval) {
    await new Promise(resolve => 
      setTimeout(resolve, minInterval - timeSinceLastRequest)
    );
  }

  lastRequestTimes[service] = Date.now();
};

// MusicBrainz API client
export class MusicBrainzClient {
  static BASE_URL = 'https://musicbrainz.org/ws/2';
  
  static async searchReleases(query) {
    await enforceRateLimit('musicbrainz');
    
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `${this.BASE_URL}/release/?query=${encodedQuery}&fmt=json&limit=10`,
        {
          headers: {
            'User-Agent': 'VinylCompanion/1.0 (https://vinyl-companion.app)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`MusicBrainz API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeReleaseData(data.releases || []);
    } catch (error) {
      console.error('MusicBrainz search error:', error);
      return [];
    }
  }

  static async getReleaseById(mbid) {
    await enforceRateLimit('musicbrainz');
    
    try {
      const response = await fetch(
        `${this.BASE_URL}/release/${mbid}?fmt=json&inc=artist-credits+recordings+labels`,
        {
          headers: {
            'User-Agent': 'VinylCompanion/1.0 (https://vinyl-companion.app)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`MusicBrainz API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeReleaseData([data])[0];
    } catch (error) {
      console.error('MusicBrainz release fetch error:', error);
      return null;
    }
  }

  static normalizeReleaseData(releases) {
    return releases.map(release => ({
      id: release.id,
      title: release.title,
      artist: release['artist-credit']?.[0]?.name || 'Unknown Artist',
      year: release.date ? new Date(release.date).getFullYear() : null,
      country: release.country,
      label: release['label-info']?.[0]?.label?.name,
      catalogNumber: release['label-info']?.[0]?.['catalog-number'],
      barcode: release.barcode,
      trackCount: release['track-count'],
      source: 'musicbrainz',
      confidence: 0.8
    }));
  }
}

// Discogs API client
export class DiscogsClient {
  static BASE_URL = 'https://api.discogs.com';
  static TOKEN = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_DISCOGS_TOKEN : null); // Will be set later
  
  static async searchReleases(query) {
    if (!this.TOKEN) {
      console.warn('Discogs token not configured');
      return [];
    }

    await enforceRateLimit('discogs');
    
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `${this.BASE_URL}/database/search?q=${encodedQuery}&type=release&format=vinyl&per_page=10`,
        {
          headers: {
            'Authorization': `Discogs token=${this.TOKEN}`,
            'User-Agent': 'VinylCompanion/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeReleaseData(data.results || []);
    } catch (error) {
      console.error('Discogs search error:', error);
      return [];
    }
  }

  static normalizeReleaseData(releases) {
    return releases.map(release => ({
      id: release.id,
      title: release.title,
      artist: release.artist || 'Unknown Artist',
      year: release.year,
      label: release.label?.[0],
      catalogNumber: release.catno,
      format: release.format?.[0],
      country: release.country,
      genre: release.genre,
      style: release.style,
      coverImage: release.cover_image,
      source: 'discogs',
      confidence: 0.9
    }));
  }
}

// Google Reverse Image Search (using third-party service)
export class GoogleImageSearchClient {
  static BASE_URL = 'https://google-reverse-image-api.vercel.app';
  
  static async searchByImage(imageUrl) {
    await enforceRateLimit('google');
    
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

// Cover Art Archive client
export class CoverArtClient {
  static BASE_URL = 'https://coverartarchive.org';
  
  static async getCoverArt(mbid) {
    try {
      const response = await fetch(`${this.BASE_URL}/release/${mbid}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const frontCover = data.images?.find(img => img.front) || data.images?.[0];
      
      return frontCover?.image || null;
    } catch (error) {
      console.error('Cover Art Archive error:', error);
      return null;
    }
  }
}