import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'landing', 'mail');
mkdirSync(OUT, { recursive: true });

const HEROES = {
  en: { title: 'You are in the crew!', tag: 'RAITTA tester' },
  fi: { title: 'Olet mukana tiimissä!', tag: 'RAITTA-testaaja' },
  sv: { title: 'Du är med i gänget!', tag: 'RAITTA-testare' },
  ru: { title: 'Вы в команде!', tag: 'Тестировщик RAITTA' },
  et: { title: 'Oled meeskonnas!', tag: 'RAITTA testija' },
};

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 520, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(HERE, 'mail-hero.html')).href, { waitUntil: 'networkidle0' });
for (const [language, hero] of Object.entries(HEROES)) {
  await page.evaluate((h) => window.fill(h), hero);
  await page.evaluate((h) => window.fill(h), hero);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, `tester-${language}.jpg`));
  console.log('mail hero', language);
}
await browser.close();
