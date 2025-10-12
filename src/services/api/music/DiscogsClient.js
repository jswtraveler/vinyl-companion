// Discogs API client for vinyl-specific data
const RATE_LIMIT = 1000; // 1 second to be safe
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

export class DiscogsClient {
  static BASE_URL = 'https://api.discogs.com';
  static TOKEN = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_DISCOGS_TOKEN : null);

  static async searchReleases(query) {
    if (!this.TOKEN) {
      console.warn('Discogs token not configured');
      return [];
    }

    await enforceRateLimit();

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
    return releases.map(release => {
      let title = release.title;
      let artist = release.artist;

      // Parse "Artist - Album" format from Discogs title
      if (title && (!artist || artist === 'Unknown Artist')) {
        const match = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        if (match) {
          artist = match[1].trim();
          title = match[2].trim();
        }
      }

      // Map Discogs format to our album schema format
      const mapDiscogsFormat = (discogsFormat) => {
        if (!discogsFormat) return 'LP';

        const formatMap = {
          'Vinyl': 'LP',
          'LP': 'LP',
          'EP': 'EP',
          'Single': 'Single',
          '7"': 'Single',
          '10"': '10"',
          '12"': 'LP',
          'Box Set': 'Box Set',
          'Picture Disc': 'Picture Disc',
          'Compilation': 'Compilation'
        };

        return formatMap[discogsFormat] || 'LP';
      };

      // Map Discogs genres to our schema genres
      const mapDiscogsGenres = (discogsGenres) => {
        if (!Array.isArray(discogsGenres)) return [];

        const validGenres = [
          'Rock', 'Pop', 'Jazz', 'Blues', 'Classical', 'Folk', 'Country', 'R&B/Soul',
          'Hip Hop', 'Electronic', 'Punk', 'Metal', 'Alternative', 'Indie', 'World', 'Soundtrack'
        ];

        const genreMap = {
          'Hip-Hop': 'Hip Hop',
          'R&B': 'R&B/Soul',
          'Soul': 'R&B/Soul',
          'Electronic': 'Electronic',
          'Prog Rock': 'Rock',
          'Progressive Rock': 'Rock',
          'Classic Rock': 'Rock',
          'Psychedelic Rock': 'Rock',
          'Hard Rock': 'Rock',
          'Pop Rock': 'Rock'
        };

        return discogsGenres
          .map(genre => genreMap[genre] || (validGenres.includes(genre) ? genre : null))
          .filter(Boolean)
          .slice(0, 3); // Limit to 3 genres max
      };

      return {
        id: release.id,
        title: title,
        artist: artist || 'Unknown Artist',
        year: release.year,
        label: release.label?.[0],
        catalogNumber: release.catno,
        format: mapDiscogsFormat(release.format?.[0] || release.format),
        country: release.country,
        genre: mapDiscogsGenres(release.genre),
        style: release.style,
        coverImage: release.cover_image,
        source: 'discogs',
        confidence: 0.9
      };
    });
  }
}

export default DiscogsClient;
