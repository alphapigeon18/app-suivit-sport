// Génère les icônes de l'app (favicon + icônes PWA + apple-touch-icon)
// à partir d'un SVG dessiné ici. Lancer avec : npm run icons
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const C = 256; // centre du viewBox 512x512
const SLATE = '#0f172a';

const rad = (deg) => (deg * Math.PI) / 180;
const point = (angleDeg, r) => [C + r * Math.cos(rad(angleDeg)), C + r * Math.sin(rad(angleDeg))];

// Pentagone (sommet vers le haut puis tourné de rotDeg)
function pentagon(cx, cy, R, rotDeg = 0) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = rad(-90 + rotDeg + i * 72);
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return 'M' + pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L') + ' Z';
}

// Construction du ballon (pentagone central + 5 pentagones de bord + coutures)
const RBALL = 176;
const pieces = [];
pieces.push(`<path d="${pentagon(C, C, 46)}" fill="${SLATE}"/>`); // pentagone central
for (let i = 0; i < 5; i++) {
  const theta = -90 + i * 72;
  const [ex, ey] = point(theta, 134); // centre du pentagone de bord
  const [sx, sy] = point(theta, 46); // sommet du pentagone central
  pieces.push(`<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${SLATE}" stroke-width="14" stroke-linecap="round"/>`);
  pieces.push(`<path d="${pentagon(ex, ey, 42, theta + 90)}" fill="${SLATE}"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
    <clipPath id="ball"><circle cx="${C}" cy="${C}" r="${RBALL}"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="0" fill="url(#bg)"/>
  <circle cx="${C}" cy="${C}" r="${RBALL + 6}" fill="#065f46"/>
  <circle cx="${C}" cy="${C}" r="${RBALL}" fill="#ffffff"/>
  <g clip-path="url(#ball)">${pieces.join('')}</g>
</svg>`;

const buffer = Buffer.from(svg);

const cibles = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['pwa-maskable-512x512.png', 512],
  ['apple-touch-icon-180x180.png', 180],
];

await writeFile(path.join(publicDir, 'favicon.svg'), svg);
for (const [nom, taille] of cibles) {
  await sharp(buffer).resize(taille, taille).png().toFile(path.join(publicDir, nom));
  console.log(`✅ ${nom} (${taille}px)`);
}
console.log('🏁 Icônes générées.');
