// Test Google Reverse Image API with multiple album covers
// To determine accuracy and response format for album identification

async function testWithMultipleAlbums() {
  console.log('Testing Google Reverse Image API with various album covers...\n');
  
  // Test with different famous album covers
  const testAlbums = [
    {
      name: 'Abbey Road - The Beatles',
      url: 'https://upload.wikimedia.org/wikipedia/en/4/42/Beatles_-_Abbey_Road.jpg'
    },
    {
      name: 'Nevermind - Nirvana', 
      url: 'https://upload.wikimedia.org/wikipedia/en/b/b7/NirvanaNevermindalbumcover.jpg'
    },
    {
      name: 'The Dark Side of the Moon - Pink Floyd',
      url: 'https://upload.wikimedia.org/wikipedia/en/3/3b/Dark_Side_of_the_Moon.png'
    },
    {
      name: 'Thriller - Michael Jackson',
      url: 'https://upload.wikimedia.org/wikipedia/en/5/55/Michael_Jackson_-_Thriller.png'
    }
  ];
  
  const endpoint = 'https://google-reverse-image-api.vercel.app/reverse';
  let successCount = 0;
  let totalTests = testAlbums.length;
  
  for (const album of testAlbums) {
    try {
      console.log(`\n--- Testing: ${album.name} ---`);
      console.log(`Image URL: ${album.url}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'VinylCompanion/1.0 (Album Testing)'
        },
        body: JSON.stringify({ imageUrl: album.url })
      });
      
      console.log('Status:', response.status);
      
      // Check rate limiting
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      if (rateLimitRemaining) {
        console.log('Rate limit remaining:', rateLimitRemaining);
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ SUCCESS!');
          console.log('Similar URL:', data.data?.similarUrl || 'N/A');
          console.log('Result Text:', data.data?.resultText || 'N/A');
          successCount++;
          
          // Check if it contains album/music information
          const resultText = data.data?.resultText?.toLowerCase() || '';
          const hasAlbumInfo = resultText.includes('album') || 
                              resultText.includes('music') || 
                              resultText.includes('song') ||
                              album.name.split(' - ')[0].toLowerCase().split(' ').some(word => 
                                resultText.includes(word.toLowerCase()));
          
          console.log('Contains music info:', hasAlbumInfo ? '✅' : '❌');
        } else {
          console.log('❌ API returned failure:', data.message);
        }
      } else {
        const errorData = await response.json();
        console.log('❌ Request failed:', response.status, errorData.message);
      }
      
      // Add delay to respect rate limits
      console.log('Waiting 2 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log('❌ Request error:', error.message);
    }
  }
  
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Successful identifications: ${successCount}/${totalTests}`);
  console.log(`Success rate: ${((successCount/totalTests) * 100).toFixed(1)}%`);
  
  if (successCount === 0) {
    console.log('\n⚠️  No successful identifications. This API may not be suitable for album covers.');
    console.log('Consider alternative APIs or different image sources.');
  }
}

// Run the test
testWithMultipleAlbums().then(() => {
  console.log('\nTesting completed.');
}).catch(console.error);