// Génère les icônes de l'app (favicon + icônes PWA + apple-touch-icon + badge
// de notification) à partir d'un SVG dessiné ici. Lancer avec : npm run icons
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Silhouette du trophée (réutilisée pour l'icône couleur et le badge monochrome)
const trophee = (fill) => `
  <g fill="${fill}">
    <path d="M188 152 C150 150 138 197 182 222" fill="none" stroke="${fill}" stroke-width="20" stroke-linecap="round"/>
    <path d="M324 152 C374 150 374 197 330 222" fill="none" stroke="${fill}" stroke-width="20" stroke-linecap="round"/>
    <path d="M176 140 L336 140 C336 208 312 272 256 286 C200 272 176 208 176 140 Z"/>
    <rect x="247" y="282" width="18" height="36"/>
    <rect x="222" y="314" width="68" height="16" rx="6"/>
    <rect x="214" y="338" width="84" height="14" rx="5"/>
    <rect x="192" y="354" width="128" height="22" rx="8"/>
  </g>`;

// Icône de l'app : trophée blanc + étoile ambre sur fond dégradé ambre→orange
const iconeApp = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="0.6" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  ${trophee('#ffffff')}
  <path fill="#f59e0b" d="M256 168 l11.6 23.5 25.9 3.8 -18.7 18.3 4.4 25.8 -23.2 -12.2 -23.2 12.2 4.4 -25.8 -18.7 -18.3 25.9 -3.8 Z"/>
</svg>`;

// Badge de notification (petite icône barre d'état Android) : silhouette
// blanche sur fond TRANSPARENT — Android ne garde que la forme et la recolore.
const badgeNotif = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${trophee('#ffffff')}
</svg>`;

const cibles = [
  [iconeApp, 'pwa-192x192.png', 192],
  [iconeApp, 'pwa-512x512.png', 512],
  [iconeApp, 'pwa-maskable-512x512.png', 512],
  [iconeApp, 'apple-touch-icon-180x180.png', 180],
  [badgeNotif, 'badge-96x96.png', 96],
];

await writeFile(path.join(publicDir, 'favicon.svg'), iconeApp);
for (const [svg, nom, taille] of cibles) {
  await sharp(Buffer.from(svg)).resize(taille, taille).png().toFile(path.join(publicDir, nom));
  console.log(`✅ ${nom} (${taille}px)`);
}
console.log('🏁 Icônes générées.');
