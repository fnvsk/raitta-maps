import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'release', 'play');
mkdirSync(OUT, { recursive: true });

await sharp(join(ROOT, 'public', 'icons', 'icon-maskable-512.png')).flatten({ background: '#155eef' }).png().toFile(join(OUT, 'icon-512.png'));

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 586, deviceScaleFactor: 1024 / 1200 });
await page.goto(pathToFileURL(join(HERE, 'play-feature.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await sharp(png).resize(1024, 500).flatten({ background: '#155eef' }).png().toFile(join(OUT, 'feature-1024x500.png'));
await browser.close();
console.log('wrote', OUT);
