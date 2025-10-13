// Test with exact format from repository README

console.log('Testing with EXACT format from repository README...\n');

// First test with the exact example from README
const url = "https://google-reverse-image-api.vercel.app/reverse";
const data = { imageUrl: "https://fastly.picsum.photos/id/513/200/300.jpg?hmac=KcBD-M89_o9rkxWW6PS2yEfAMCfd3TH9McppOsf3GZ0" };

console.log('Testing with README example image...');
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
})
  .then((response) => {
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    if (response.ok) {
      return response.json();
    } else {
      throw new Error("Could not perform reverse image search.");
    }
  })
  .then((data) => {
    console.log('✅ SUCCESS! Response data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Now test with an album cover using the working format
    testAlbumCover();
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    console.log('README example failed - API might be having issues');
  });

// Test album cover with exact same format
function testAlbumCover() {
  console.log('\n--- Testing album cover with working format ---');
  
  const albumData = { 
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/4/42/Beatles_-_Abbey_Road.jpg" 
  };

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(albumData),
  })
    .then((response) => {
      console.log('Album test - Response status:', response.status);
      if (response.ok) {
        return response.json();
      } else {
        throw new Error("Could not perform reverse image search for album.");
      }
    })
    .then((data) => {
      console.log('✅ Album SUCCESS! Response data:');
      console.log(JSON.stringify(data, null, 2));
    })
    .catch((error) => {
      console.error('❌ Album Error:', error.message);
    });
}