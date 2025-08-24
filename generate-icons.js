const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generatePWAIcons() {
  const svgPath = path.join(__dirname, 'public', 'icon.svg');
  const publicDir = path.join(__dirname, 'public');
  
  try {
    // Generate 192x192 icon
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'pwa-192x192.png'));
    
    console.log('✅ Generated pwa-192x192.png');
    
    // Generate 512x512 icon
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'pwa-512x512.png'));
    
    console.log('✅ Generated pwa-512x512.png');
    
    // Also generate standard favicon sizes
    await sharp(svgPath)
      .resize(64, 64)
      .png()
      .toFile(path.join(publicDir, 'favicon-64x64.png'));
    
    console.log('✅ Generated favicon-64x64.png');
    
    // Generate apple-touch-icon
    await sharp(svgPath)
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    
    console.log('✅ Generated apple-touch-icon.png');
    
    console.log('🎉 All PWA icons generated successfully!');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
  }
}

generatePWAIcons();