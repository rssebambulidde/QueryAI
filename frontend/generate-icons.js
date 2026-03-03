const sharp = require('sharp');
const fs = require('fs');

async function generate() {
    const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="#111827"/><circle cx="512" cy="512" r="256" fill="#8b5cf6"/><path d="M512 350 L650 650 L374 650 Z" fill="#fff"/></svg>`;

    const buffer = Buffer.from(svg);

    if (!fs.existsSync('public/icons')) {
        fs.mkdirSync('public/icons', { recursive: true });
    }

    await sharp(buffer).resize(192, 192).png().toFile('public/icons/icon-192x192.png');
    console.log('Generated icon-192x192.png');

    await sharp(buffer).resize(512, 512).png().toFile('public/icons/icon-512x512.png');
    console.log('Generated icon-512x512.png');
}

generate().catch(console.error);
