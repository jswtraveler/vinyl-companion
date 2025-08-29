// Test script for Google Reverse Image Search API
// Testing with a sample album cover image URL

async function testGoogleReverseImageAPI() {
  console.log('Testing Google Reverse Image API endpoints...\n');
  
  // Test with a sample album cover - The Dark Side of the Moon
  const testImageUrl = 'https://upload.wikimedia.org/wikipedia/en/3/3b/Dark_Side_of_the_Moon.png';
  
  // Test different endpoint variations
  const endpoints = [
    'https://google-reverse-image-api.vercel.app/api/search',
    'https://google-reverse-image-api.vercel.app/search',
    'https://google-reverse-image-api.vercel.app/reverse',
    'https://google-reverse-image-api.vercel.app/api/reverse',
    'https://google-reverse-image-api.vercel.app'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n--- Testing endpoint: ${endpoint} ---`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'VinylCompanion/1.0 (Testing)'
        },
        body: JSON.stringify({ 
          imageUrl: testImageUrl,
          url: testImageUrl,
          image: testImageUrl
        })
      });
    
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ SUCCESS! Response data:');
        console.log(JSON.stringify(data, null, 2));
        
        // Analyze the response structure
        if (data.results) {
          console.log('\n--- Results Analysis ---');
          console.log('Number of results:', data.results.length);
          if (data.results.length > 0) {
            console.log('First result:', data.results[0]);
          }
        }
        break; // Found working endpoint
      } else {
        const errorText = await response.text();
        console.log('❌ Error:', response.status, errorText);
      }
      
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
  }
  
  // Also test GET request to base URL for documentation
  try {
    console.log('\n--- Testing GET request for documentation ---');
    const docResponse = await fetch('https://google-reverse-image-api.vercel.app');
    if (docResponse.ok) {
      const docText = await docResponse.text();
      console.log('Documentation found:', docText.substring(0, 500) + '...');
    }
  } catch (error) {
    console.log('Documentation request failed:', error.message);
  }
}

// Run the test
testGoogleReverseImageAPI().then(() => {
  console.log('\nTest completed.');
}).catch(console.error);