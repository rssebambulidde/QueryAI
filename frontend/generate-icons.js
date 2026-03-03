const sharp = require('sharp');
const fs = require('fs');

async function generate() {
    // Use the actual app icon SVG - blue gradient bg, Q circle, orange dot
    const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with blue gradient, rounded corners -->
  <rect width="1024" height="1024" rx="220" fill="url(#gradient)"/>
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#1E40AF"/>
    </linearGradient>
  </defs>
  <!-- Q main circle -->
  <circle cx="490" cy="490" r="220" stroke="white" stroke-width="80" fill="none"/>
  <!-- Q tail -->
  <path d="M645 645 L800 800" stroke="white" stroke-width="80" stroke-linecap="round"/>
  <!-- Orange accent dot -->
  <circle cx="790" cy="234" r="80" fill="#F97316"/>
</svg>`;

    const buffer = Buffer.from(svg);

    if (!fs.existsSync('public/icons')) {
        fs.mkdirSync('public/icons', { recursive: true });
    }

    await sharp(buffer).resize(192, 192).png().toFile('public/icons/icon-192x192.png');
    console.log('Generated icon-192x192.png');

    await sharp(buffer).resize(512, 512).png().toFile('public/icons/icon-512x512.png');
    console.log('Generated icon-512x512.png');

    // Also write a 180x180 apple touch icon
    await sharp(buffer).resize(180, 180).png().toFile('public/apple-touch-icon.png');
    console.log('Generated apple-touch-icon.png');
}

generate().catch(console.error);
