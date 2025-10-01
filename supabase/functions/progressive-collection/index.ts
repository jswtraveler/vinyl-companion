import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ArtistMetadata {
  tags: Array<{ name: string; count: number }>;
  listeners: number;
  playcount: number;
  mbid?: string;
}

interface SimilarArtist {
  name: string;
  mbid?: string;
  match: number;
  image?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const lastfmApiKey = Deno.env.get('LASTFM_API_KEY')
    if (!lastfmApiKey) {
      throw new Error('LASTFM_API_KEY not configured')
    }

    // Get all users who have albums
    const { data: users, error: usersError } = await supabaseClient
      .from('user_owned_artists')
      .select('user_id')
      .limit(1000)

    if (usersError) throw usersError

    const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])]
    console.log(`Processing ${uniqueUserIds.length} users`)

    let totalProcessed = 0
    let totalErrors = 0

    // Process each user
    for (const userId of uniqueUserIds) {
      try {
        await processUserCollection(supabaseClient, userId, lastfmApiKey)
        totalProcessed++
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error)
        totalErrors++
      }

      // Rate limiting - wait 1 second between users
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return new Response(
      JSON.stringify({
        success: true,
        usersProcessed: totalProcessed,
        errors: totalErrors,
        message: `Processed ${totalProcessed} users, ${totalErrors} errors`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

async function processUserCollection(
  supabase: any,
  userId: string,
  lastfmApiKey: string
) {
  // Get user's owned artists
  const { data: ownedArtists, error: artistsError } = await supabase
    .from('user_owned_artists')
    .select('artist_name, artist_mbid')
    .eq('user_id', userId)

  if (artistsError) throw artistsError

  console.log(`User ${userId}: ${ownedArtists?.length || 0} artists`)

  // For each artist, fetch similar artists and metadata
  for (const artist of ownedArtists || []) {
    await processSimilarArtists(supabase, artist, lastfmApiKey)
    await processArtistMetadata(supabase, artist, lastfmApiKey)

    // Rate limiting - 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

async function processSimilarArtists(
  supabase: any,
  artist: any,
  lastfmApiKey: string
) {
  // Check if we already have cached similar artists (within 30 days)
  const { data: existingCache } = await supabase
    .from('artist_similarity_cache')
    .select('cached_at')
    .eq('source_artist', artist.artist_name)
    .single()

  if (existingCache) {
    const cacheAge = Date.now() - new Date(existingCache.cached_at).getTime()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    if (cacheAge < thirtyDays) {
      console.log(`Cache hit for ${artist.artist_name}`)
      return
    }
  }

  // Fetch similar artists from Last.fm
  const url = new URL('https://ws.audioscrobbler.com/2.0/')
  url.searchParams.set('method', 'artist.getsimilar')
  url.searchParams.set('artist', artist.artist_name)
  if (artist.artist_mbid) {
    url.searchParams.set('mbid', artist.artist_mbid)
  }
  url.searchParams.set('api_key', lastfmApiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '20')

  const response = await fetch(url.toString())
  const data = await response.json()

  if (!data.similarartists?.artist) {
    console.log(`No similar artists for ${artist.artist_name}`)
    return
  }

  const similarArtists: SimilarArtist[] = Array.isArray(data.similarartists.artist)
    ? data.similarartists.artist
    : [data.similarartists.artist]

  // Store in cache
  for (const similar of similarArtists) {
    await supabase
      .from('artist_similarity_cache')
      .upsert({
        source_artist: artist.artist_name,
        source_mbid: artist.artist_mbid,
        target_artist: similar.name,
        target_mbid: similar.mbid,
        similarity_score: parseFloat(similar.match) || 0,
        data_source: 'lastfm',
        cached_at: new Date().toISOString()
      }, {
        onConflict: 'source_artist,target_artist'
      })
  }

  console.log(`Cached ${similarArtists.length} similar artists for ${artist.artist_name}`)
}

async function processArtistMetadata(
  supabase: any,
  artist: any,
  lastfmApiKey: string
) {
  // Check if we already have cached metadata (within 14 days)
  const { data: existingCache } = await supabase
    .from('artist_metadata_cache')
    .select('cached_at')
    .eq('artist_name', artist.artist_name)
    .single()

  if (existingCache) {
    const cacheAge = Date.now() - new Date(existingCache.cached_at).getTime()
    const fourteenDays = 14 * 24 * 60 * 60 * 1000

    if (cacheAge < fourteenDays) {
      return
    }
  }

  // Fetch artist info from Last.fm
  const url = new URL('https://ws.audioscrobbler.com/2.0/')
  url.searchParams.set('method', 'artist.getinfo')
  url.searchParams.set('artist', artist.artist_name)
  if (artist.artist_mbid) {
    url.searchParams.set('mbid', artist.artist_mbid)
  }
  url.searchParams.set('api_key', lastfmApiKey)
  url.searchParams.set('format', 'json')

  const response = await fetch(url.toString())
  const data = await response.json()

  if (!data.artist) {
    console.log(`No metadata for ${artist.artist_name}`)
    return
  }

  const artistData = data.artist
  const metadata: ArtistMetadata = {
    tags: artistData.tags?.tag || [],
    listeners: parseInt(artistData.stats?.listeners || '0'),
    playcount: parseInt(artistData.stats?.playcount || '0'),
    mbid: artistData.mbid
  }

  // Store in cache
  await supabase
    .from('artist_metadata_cache')
    .upsert({
      artist_name: artist.artist_name,
      artist_mbid: artist.artist_mbid || artistData.mbid,
      metadata: metadata,
      data_source: 'lastfm',
      cached_at: new Date().toISOString()
    }, {
      onConflict: 'artist_name'
    })

  console.log(`Cached metadata for ${artist.artist_name}`)
}
