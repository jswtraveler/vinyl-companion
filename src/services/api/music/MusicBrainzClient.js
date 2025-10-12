// MusicBrainz API client for music metadata
const RATE_LIMIT = 1000; // 1 second between requests
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

export class MusicBrainzClient {
  static BASE_URL = 'https://musicbrainz.org/ws/2';

  static async searchReleases(query) {
    await enforceRateLimit();

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
    await enforceRateLimit();

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

export default MusicBrainzClient;
