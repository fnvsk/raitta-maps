import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const BLUE = '#155EEF';

const mark = (color) => `
  <path d="M21 50V14h17.5a12.5 12.5 0 0 1 0 25H21" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M38 39l11 11" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="37.5" cy="26.5" r="3.6" fill="${color}"/>`;

const rounded = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14.5" fill="${BLUE}"/>${mark('#fff')}</svg>`;

const square = (size, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${BLUE}"/>
  <g transform="translate(32 32) scale(${scale}) translate(-34 -32)">${mark('#fff')}</g></svg>`;

const png = (svg, path) => sharp(Buffer.from(svg)).png().toFile(path);

mkdirSync(join(PUBLIC, 'icons'), { recursive: true });
writeFileSync(join(PUBLIC, 'favicon.svg'), rounded(64));
await png(rounded(32), join(PUBLIC, 'favicon-32.png'));
await png(square(192, 0.9), join(PUBLIC, 'icons', 'icon-192.png'));
await png(square(512, 0.9), join(PUBLIC, 'icons', 'icon-512.png'));
await png(square(512, 0.72), join(PUBLIC, 'icons', 'icon-maskable-512.png'));

await png(square(180, 0.9), join(PUBLIC, 'apple-touch-icon.png'));

const ASSETS = join(ROOT, 'assets');
mkdirSync(ASSETS, { recursive: true });
const foreground = (size, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <g transform="translate(32 32) scale(${scale}) translate(-34 -32)">${mark('#fff')}</g></svg>`;
await png(square(1024, 0.9), join(ASSETS, 'icon-only.png'));
await png(foreground(1024, 0.62), join(ASSETS, 'icon-foreground.png'));
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BLUE}"/></svg>`, join(ASSETS, 'icon-background.png'));
for (const name of ['splash', 'splash-dark']) {
  await png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 64 64"><rect width="64" height="64" fill="${BLUE}"/><g transform="translate(32 32) scale(0.2) translate(-34 -32)">${mark('#fff')}</g></svg>`,
    join(ASSETS, `${name}.png`),
  );
}
console.log('Icons written to public/ and assets/');
