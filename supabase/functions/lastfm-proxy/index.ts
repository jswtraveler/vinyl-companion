import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Last.fm API key (server-side only, not exposed to client)
const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY')!

async function makeLastFmRequest(method: string, params: Record<string, string>): Promise<any> {
  const url = new URL('https://ws.audioscrobbler.com/2.0/')

  // Add API key and method
  url.searchParams.set('api_key', LASTFM_API_KEY)
  url.searchParams.set('method', method)
  url.searchParams.set('format', 'json')

  // Add custom parameters
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value)
    }
  }

  console.log(`Last.fm API request: ${method}`)

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Last.fm API error:', errorText)
    throw new Error(`Last.fm API error: ${response.status}`)
  }

  return await response.json()
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method, params } = await req.json()

    if (!method) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing method parameter' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log(`Last.fm proxy: ${method}`, params)
    const result = await makeLastFmRequest(method, params || {})

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Last.fm proxy error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
