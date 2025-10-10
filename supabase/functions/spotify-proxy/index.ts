import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Spotify API credentials (server-side only, not exposed to client)
const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID')!
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')!

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface SpotifySearchResponse {
  artists: {
    items: Array<{
      id: string
      name: string
      images: Array<{ url: string; width: number; height: number }>
      external_urls: { spotify: string }
    }>
  }
}

// Token cache (in-memory for this function instance)
let cachedToken: string | null = null
let tokenExpiry: number = 0

async function getSpotifyAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken
  }

  console.log('Fetching new Spotify access token...')

  const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Spotify auth error:', errorText)
    throw new Error(`Spotify auth failed: ${response.status}`)
  }

  const data = await response.json() as SpotifyTokenResponse
  cachedToken = data.access_token
  // Set expiry with 5 minute buffer
  tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000)

  console.log('Spotify token obtained, expires in', data.expires_in, 'seconds')
  return cachedToken
}

async function searchSpotifyArtist(artistName: string): Promise<any> {
  const token = await getSpotifyAccessToken()

  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', artistName)
  url.searchParams.set('type', 'artist')
  url.searchParams.set('limit', '1')

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`)
  }

  const data = await response.json() as SpotifySearchResponse

  if (data.artists?.items && data.artists.items.length > 0) {
    const artist = data.artists.items[0]

    // Return formatted response
    return {
      id: artist.id,
      name: artist.name,
      image: artist.images[0]?.url || null,
      imageWidth: artist.images[0]?.width || null,
      imageHeight: artist.images[0]?.height || null,
      spotifyUrl: artist.external_urls.spotify
    }
  }

  return null
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, artistName } = await req.json()

    if (action === 'search' && artistName) {
      console.log(`Searching Spotify for artist: ${artistName}`)
      const result = await searchSpotifyArtist(artistName)

      return new Response(
        JSON.stringify({ success: true, data: result }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Invalid request
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action or missing artistName' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )

  } catch (error) {
    console.error('Spotify proxy error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
