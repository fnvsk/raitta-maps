import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = 'https://raitta-maps.vercel.app';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'landing', 'screens', 'guide');

const VIEWPORT = { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const LANGUAGES = ['fi', 'en', 'sv', 'ru', 'et'];
const SCREENS = { home: 'tampere', live: 'helsinki' };

mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

for (const language of LANGUAGES) {
  for (const [name, region] of Object.entries(SCREENS)) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.evaluateOnNewDocument(
      (chosen, code) =>
        localStorage.setItem('raita-settings', JSON.stringify({ state: { onboarded: true, language: code, theme: 'light', region: chosen }, version: 2 })),
      region,
      language,
    );
    await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
    await wait(7000);
    await page.waitForFunction(() => document.fonts.ready.then(() => true));
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).resize({ width: 786 }).webp({ quality: 88 }).toFile(join(OUT, `${name}-${language}.webp`));
    console.log('saved', name, language);
    await page.close();
  }
}
await browser.close();
