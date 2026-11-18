import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'landing', 'screens', 'share-2026-11.jpg');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(HERE, 'poster.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(OUT);
await browser.close();
console.log('wrote', OUT);
