import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const LISTENBRAINZ_TOKEN = Deno.env.get('LISTENBRAINZ_TOKEN')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function makeListenBrainzRequest(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(endpoint, 'https://api.listenbrainz.org')

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value)
    }
  })

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'VinylCollectionApp/1.0'
  }

  // Add authorization header if token is available
  if (LISTENBRAINZ_TOKEN) {
    headers['Authorization'] = `Token ${LISTENBRAINZ_TOKEN}`
  }

  console.log(`ListenBrainz API request: ${url.pathname}`)

  const response = await fetch(url.toString(), { headers })

  if (!response.ok) {
    throw new Error(`ListenBrainz API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, params } = await req.json()

    if (!endpoint) {
      throw new Error('endpoint is required')
    }

    const result = await makeListenBrainzRequest(endpoint, params || {})

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('ListenBrainz proxy error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
