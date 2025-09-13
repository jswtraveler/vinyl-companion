#!/usr/bin/env python3
"""
Album Metadata Test Script
Compare MusicBrainz and Discogs API responses for album searches
Similar to how the vinyl collection app searches for albums
"""

import requests
import json
import time
from typing import Dict, List, Optional
import argparse


class MusicBrainzAPI:
    """MusicBrainz API client for album metadata"""
    
    def __init__(self):
        self.base_url = "https://musicbrainz.org/ws/2"
        self.user_agent = "AlbumMetadataTest/1.0 (testing@example.com)"
        self.rate_limit_delay = 1.0  # 1 second between requests
        
    def search_albums(self, query: str, limit: int = 10) -> Dict:
        """Search for albums using MusicBrainz API"""
        url = f"{self.base_url}/release/"
        params = {
            'query': query,
            'fmt': 'json',
            'limit': limit
        }
        headers = {
            'User-Agent': self.user_agent
        }
        
        try:
            print(f"🎵 Searching MusicBrainz for: '{query}'...")
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            
            # Rate limiting
            time.sleep(self.rate_limit_delay)
            
            data = response.json()
            return {
                'success': True,
                'data': data,
                'total_results': data.get('count', 0),
                'results': data.get('releases', [])
            }
            
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'data': None,
                'results': []
            }
    
    def format_result(self, release: Dict) -> Dict:
        """Format MusicBrainz release data for comparison"""
        # Get artist info
        artist_credits = release.get('artist-credit', [])
        artists = [ac.get('artist', {}).get('name', 'Unknown') for ac in artist_credits]
        artist = ', '.join(artists) if artists else 'Unknown Artist'
        
        # Get label info
        label_info = release.get('label-info', [])
        labels = [li.get('label', {}).get('name') for li in label_info if li.get('label')]
        label = ', '.join(filter(None, labels)) if labels else None
        
        # Get catalog number
        catalog_numbers = [li.get('catalog-number') for li in label_info if li.get('catalog-number')]
        catalog_number = ', '.join(filter(None, catalog_numbers)) if catalog_numbers else None
        
        return {
            'id': release.get('id'),
            'title': release.get('title', 'Unknown Title'),
            'artist': artist,
            'date': release.get('date'),
            'country': release.get('country'),
            'status': release.get('status'),
            'packaging': release.get('packaging'),
            'label': label,
            'catalog_number': catalog_number,
            'barcode': release.get('barcode'),
            'track_count': release.get('track-count'),
            'format': self._get_format(release),
            'disambiguation': release.get('disambiguation')
        }
    
    def _get_format(self, release: Dict) -> Optional[str]:
        """Extract format information from MusicBrainz release"""
        media = release.get('media', [])
        if media:
            formats = [m.get('format') for m in media if m.get('format')]
            return ', '.join(formats) if formats else None
        return None


class DiscogsAPI:
    """Discogs API client for vinyl-specific data"""
    
    def __init__(self, token: str):
        self.base_url = "https://api.discogs.com"
        self.token = token
        self.rate_limit_delay = 1.0  # 1 second between requests (60/min limit)
        
    def search_albums(self, query: str, limit: int = 10) -> Dict:
        """Search for releases using Discogs API"""
        url = f"{self.base_url}/database/search"
        params = {
            'q': query,
            'type': 'release',
            'format': 'vinyl',  # Focus on vinyl releases
            'per_page': min(limit, 100),  # Max 100 per page
            'token': self.token
        }
        headers = {
            'User-Agent': 'AlbumMetadataTest/1.0'
        }
        
        try:
            print(f"💿 Searching Discogs for: '{query}'...")
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            
            # Rate limiting
            time.sleep(self.rate_limit_delay)
            
            data = response.json()
            return {
                'success': True,
                'data': data,
                'total_results': data.get('pagination', {}).get('items', 0),
                'results': data.get('results', [])
            }
            
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'data': None,
                'results': []
            }
    
    def get_release_details(self, release_id: str) -> Dict:
        """Get detailed release information"""
        url = f"{self.base_url}/releases/{release_id}"
        params = {'token': self.token}
        headers = {'User-Agent': 'AlbumMetadataTest/1.0'}
        
        try:
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            time.sleep(self.rate_limit_delay)
            return response.json()
        except:
            return {}
    
    def format_result(self, result: Dict) -> Dict:
        """Format Discogs search result for comparison"""
        # Get detailed info if we have an ID
        details = {}
        if result.get('id'):
            details = self.get_release_details(str(result['id']))
        
        return {
            'id': result.get('id'),
            'title': result.get('title', 'Unknown Title'),
            'artist': self._extract_artist(result),
            'year': result.get('year'),
            'country': result.get('country'),
            'label': ', '.join(result.get('label', [])) if result.get('label') else None,
            'catalog_number': result.get('catno'),
            'format': ', '.join(result.get('format', [])) if result.get('format') else None,
            'genre': ', '.join(result.get('genre', [])) if result.get('genre') else None,
            'style': ', '.join(result.get('style', [])) if result.get('style') else None,
            'thumb': result.get('thumb'),
            'cover_image': result.get('cover_image'),
            'resource_url': result.get('resource_url'),
            'master_id': result.get('master_id'),
            'master_url': result.get('master_url'),
            'uri': result.get('uri'),
            'community_have': result.get('community', {}).get('have'),
            'community_want': result.get('community', {}).get('want'),
            # Additional details from full release data
            'notes': details.get('notes'),
            'estimated_weight': details.get('estimated_weight'),
            'status': details.get('status'),
            'data_quality': details.get('data_quality')
        }
    
    def _extract_artist(self, result: Dict) -> str:
        """Extract artist name from Discogs result"""
        title = result.get('title', '')
        if ' - ' in title:
            return title.split(' - ')[0]
        return 'Unknown Artist'


def compare_apis(query: str, discogs_token: str, limit: int = 5):
    """Compare MusicBrainz and Discogs API responses"""
    print(f"\n{'='*60}")
    print(f"COMPARING ALBUM METADATA APIs")
    print(f"Search Query: '{query}'")
    print(f"{'='*60}\n")
    
    # Initialize APIs
    mb = MusicBrainzAPI()
    discogs = DiscogsAPI(discogs_token)
    
    # Search both APIs
    mb_results = mb.search_albums(query, limit)
    discogs_results = discogs.search_albums(query, limit)
    
    print("📊 SEARCH RESULTS SUMMARY")
    print(f"MusicBrainz: {'✅' if mb_results['success'] else '❌'} - {len(mb_results['results'])} results")
    print(f"Discogs: {'✅' if discogs_results['success'] else '❌'} - {len(discogs_results['results'])} results")
    print()
    
    # Show errors if any
    if not mb_results['success']:
        print(f"❌ MusicBrainz Error: {mb_results['error']}")
    if not discogs_results['success']:
        print(f"❌ Discogs Error: {discogs_results['error']}")
    
    if not mb_results['success'] or not discogs_results['success']:
        return
    
    # Compare results
    print("🎵 MUSICBRAINZ RESULTS:")
    print("-" * 40)
    for i, release in enumerate(mb_results['results'][:limit], 1):
        formatted = mb.format_result(release)
        print(f"{i}. {formatted['title']} - {formatted['artist']}")
        print(f"   Date: {formatted['date']} | Country: {formatted['country']}")
        print(f"   Format: {formatted['format']} | Status: {formatted['status']}")
        print(f"   Label: {formatted['label']} | Cat#: {formatted['catalog_number']}")
        print(f"   ID: {formatted['id']}")
        print()
    
    print("💿 DISCOGS RESULTS:")
    print("-" * 40)
    for i, result in enumerate(discogs_results['results'][:limit], 1):
        formatted = discogs.format_result(result)
        print(f"{i}. {formatted['title']} - {formatted['artist']}")
        print(f"   Year: {formatted['year']} | Country: {formatted['country']}")
        print(f"   Format: {formatted['format']} | Genre: {formatted['genre']}")
        print(f"   Label: {formatted['label']} | Cat#: {formatted['catalog_number']}")
        print(f"   Community: {formatted['community_have']} have, {formatted['community_want']} want")
        print(f"   ID: {formatted['id']}")
        print()
    
    # Detailed comparison
    print("🔍 DETAILED COMPARISON:")
    print("-" * 40)
    print("MusicBrainz Strengths:")
    print("  ✅ Comprehensive metadata (official music database)")
    print("  ✅ Detailed track information")
    print("  ✅ Artist relationship data")
    print("  ✅ International release variations")
    print("  ✅ Free to use (with rate limiting)")
    print()
    print("Discogs Strengths:")
    print("  ✅ Vinyl-specific information (format, pressing details)")
    print("  ✅ Community data (have/want statistics)")
    print("  ✅ High-quality cover images")
    print("  ✅ Marketplace/pricing data")
    print("  ✅ Genre and style classifications")
    print("  ✅ Real-world catalog numbers and pressing variations")
    print()
    
    # Raw JSON comparison (first result only)
    if mb_results['results'] and discogs_results['results']:
        print("📄 RAW DATA COMPARISON (First Result):")
        print("-" * 40)
        
        print("MusicBrainz Raw JSON:")
        print(json.dumps(mb.format_result(mb_results['results'][0]), indent=2, ensure_ascii=False))
        print()
        
        print("Discogs Raw JSON:")
        print(json.dumps(discogs.format_result(discogs_results['results'][0]), indent=2, ensure_ascii=False))
        print()


def main():
    parser = argparse.ArgumentParser(description='Compare MusicBrainz and Discogs album metadata')
    parser.add_argument('query', help='Album search query (e.g., "Dark Side of the Moon Pink Floyd")')
    parser.add_argument('--discogs-token', 
                       default='cnnvGRrVAJNYTcPEZrAXMykPzWrgzuYMdrkTbTXM',
                       help='Discogs API token (defaults to app token)')
    parser.add_argument('--limit', type=int, default=3, help='Number of results to compare (default: 3)')
    
    args = parser.parse_args()
    
    try:
        compare_apis(args.query, args.discogs_token, args.limit)
    except KeyboardInterrupt:
        print("\n\n⏹️  Search cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    # Example usage if run without arguments
    import sys
    if len(sys.argv) == 1:
        print("🎵 Album Metadata Comparison Tool")
        print("\nUsage examples:")
        print("  python album_metadata_test.py 'Dark Side of the Moon Pink Floyd'")
        print("  python album_metadata_test.py 'Nevermind Nirvana' --limit 5")
        print("  python album_metadata_test.py 'OK Computer Radiohead' --discogs-token YOUR_TOKEN")
        print("\nTry searching for an album:")
        query = input("Enter album name: ").strip()
        if query:
            compare_apis(query, 'cnnvGRrVAJNYTcPEZrAXMykPzWrgzuYMdrkTbTXM', 3)
    else:
        main()