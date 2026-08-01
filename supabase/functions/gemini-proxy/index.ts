import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateContent(prompt: string) {
  // gemini-flash-latest is an alias to the current stable Flash model. The 2.x models
  // (2.0/2.5-flash) are gated to "new users" and return 404, so use the latest alias.
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1, // Low temperature for consistent analysis
      topK: 1,
      topP: 1,
      maxOutputTokens: 8192,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  }

  console.log('Gemini API: Generating content...')

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    // Surface Google's real error so the client can distinguish quota (429),
    // a retired/invalid model (404), and auth (401/403) instead of a generic failure.
    let detail = response.statusText
    try {
      const errorData = await response.json()
      detail = errorData?.error?.message || detail
    } catch (_) { /* body was not JSON */ }
    const err = new Error(`Gemini API error: ${response.status} ${detail}`)
    ;(err as Error & { status?: number }).status = response.status
    throw err
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message)
  }

  // Extract text from response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('No content generated')
  }

  return {
    content: text,
    timestamp: new Date().toISOString(),
    usage: data.usageMetadata
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, prompt } = await req.json()

    if (action !== 'generateContent') {
      throw new Error('Invalid action. Only "generateContent" is supported.')
    }

    if (!prompt) {
      throw new Error('prompt is required')
    }

    const result = await generateContent(prompt)

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Gemini proxy error:', error)

    const status = (error as Error & { status?: number }).status || 500
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // keep 200 so supabase-js returns the body instead of a generic FunctionsError
      }
    )
  }
})
