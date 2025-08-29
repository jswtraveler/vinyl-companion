/**
 * Netlify Serverless Function to proxy SerpAPI requests
 * Solves CORS and mobile browser issues with direct SerpAPI access
 */

export const handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  try {
    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    // Validate required fields
    const { imageUrl, apiKey } = requestData;
    if (!imageUrl || !apiKey) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Missing required fields: imageUrl and apiKey' 
        })
      };
    }

    // Validate image URL format
    try {
      new URL(imageUrl);
    } catch (urlError) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid image URL format' })
      };
    }

    // Build SerpAPI request
    const searchParams = new URLSearchParams({
      engine: 'google_reverse_image',
      image_url: imageUrl,
      api_key: apiKey,
      ...requestData.options // Additional options if provided
    });

    const serpApiUrl = `https://serpapi.com/search?${searchParams.toString()}`;

    console.log('Proxying SerpAPI request for image:', imageUrl);

    // Make request to SerpAPI
    const response = await fetch(serpApiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VinylCompanion-Proxy/1.0 (Netlify Function)',
        'Accept': 'application/json',
      }
    });

    // Check if request was successful
    if (!response.ok) {
      console.error(`SerpAPI error: ${response.status} ${response.statusText}`);
      
      let errorBody;
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Unknown error';
      }

      return {
        statusCode: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: `SerpAPI request failed: ${response.status} ${response.statusText}`,
          details: errorBody
        })
      };
    }

    // Parse response
    const data = await response.json();

    // Check for SerpAPI errors in response
    if (data.error) {
      console.error('SerpAPI returned error:', data.error);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'SerpAPI error',
          details: data.error
        })
      };
    }

    console.log('SerpAPI request successful');

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: JSON.stringify({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Proxy function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Proxy function failed',
        details: error.message
      })
    };
  }
};