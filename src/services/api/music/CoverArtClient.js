// Cover Art Archive API client
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

export default CoverArtClient;
