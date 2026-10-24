import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'packaging/icons');
const publicDir = path.join(rootDir, 'public');

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#171C28"/>
      <stop offset="100%" stop-color="#0B0E15"/>
    </linearGradient>
    <linearGradient id="amberGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F7B955"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  <rect x="20" y="20" width="472" height="472" rx="108" fill="url(#bgGrad)" stroke="#2E374B" stroke-width="8"/>
  <rect x="44" y="44" width="424" height="424" rx="88" fill="none" stroke="#E89B3C" stroke-opacity="0.22" stroke-width="3"/>
  <!-- Optical Node & Keyframe Diamond Prism -->
  <circle cx="256" cy="256" r="148" fill="none" stroke="url(#cyanGrad)" stroke-width="10" stroke-dasharray="48 18" opacity="0.65"/>
  <polygon points="256,96 404,256 256,416 108,256" fill="none" stroke="url(#amberGrad)" stroke-width="18" stroke-linejoin="round"/>
  <polygon points="222,190 326,256 222,322" fill="url(#amberGrad)"/>
  <circle cx="256" cy="96" r="14" fill="#38BDF8"/>
  <circle cx="404" cy="256" r="14" fill="#E89B3C"/>
  <circle cx="256" cy="416" r="14" fill="#38BDF8"/>
  <circle cx="108" cy="256" r="14" fill="#E89B3C"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon, 'utf8');
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon, 'utf8');

for (const sz of [512, 256, 128, 64, 48, 32, 16]) {
  const resvg = new Resvg(svgIcon, { fitTo: { mode: 'width', value: sz } });
  const pngBytes = resvg.render().asPng();
  fs.writeFileSync(path.join(iconsDir, `icon-${sz}.png`), pngBytes);
  if (sz === 512) {
    fs.writeFileSync(path.join(iconsDir, 'icon.png'), pngBytes);
  }
}

// Build multi-resolution Windows .ico via ImageMagick convert (16..256px layers)
try {
  execFileSync('convert', [
    path.join(iconsDir, 'icon-16.png'),
    path.join(iconsDir, 'icon-32.png'),
    path.join(iconsDir, 'icon-48.png'),
    path.join(iconsDir, 'icon-64.png'),
    path.join(iconsDir, 'icon-128.png'),
    path.join(iconsDir, 'icon-256.png'),
    path.join(iconsDir, 'icon.ico'),
  ]);
  console.log('Generated multi-platform icons in packaging/icons/ (.svg, .png 16..512px, .ico)');
} catch (err) {
  console.warn('Skipped .ico generation:', err);
}
