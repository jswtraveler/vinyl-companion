/**
 * Music API Clients
 *
 * Clients for music metadata services including Last.fm, ListenBrainz,
 * Spotify, MusicBrainz, Discogs, and Cover Art Archive.
 */

// Music streaming and scrobbling services
export { LastFmClient, default as LastFm } from './LastFmClient.js';
export { ListenBrainzClient, default as ListenBrainz } from './ListenBrainzClient.js';
export { SpotifyClient, default as Spotify } from './SpotifyClient.js';

// Music metadata and vinyl databases
export { MusicBrainzClient, default as MusicBrainz } from './MusicBrainzClient.js';
export { DiscogsClient, default as Discogs } from './DiscogsClient.js';
export { CoverArtClient, default as CoverArt } from './CoverArtClient.js';
