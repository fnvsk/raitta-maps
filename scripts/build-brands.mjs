import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'brands');
const LIST = join(ROOT, 'src', 'core', 'brands.json');
const HEADERS = { 'User-Agent': 'RAITTA build script (https://raitta.fi)' };
const SIZE = 96;

const MIN_SOURCE_PX = 48;

const get = (url) => fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15000) });

async function image(url) {
  const res = await get(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  if (!meta.width || meta.width < MIN_SOURCE_PX) throw new Error(`too small (${meta.width}px) ${url}`);
  return buffer;
}

async function siteIcons(site) {
  const res = await get(site);
  if (!res.ok) throw new Error(`${res.status} ${site}`);
  const html = (await res.text()).slice(0, 400_000);
  const links = [...html.matchAll(/<link[^>]+>/gi)].map((match) => match[0]);
  const icons = links
    .filter((tag) => /rel=["'][^"']*(apple-touch-icon|icon)[^"']*["']/i.test(tag))
    .map((tag) => {
      const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
      const size = Number(/sizes=["'](\d+)x\d+["']/i.exec(tag)?.[1] ?? (/apple-touch-icon/i.test(tag) ? 180 : 32));
      return href && !/\.svg(\?|$)/i.test(href) ? { url: new URL(href, res.url).href, size } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.size - a.size);
  return [...icons.map((icon) => icon.url), new URL('/apple-touch-icon.png', res.url).href];
}

async function logoOf(brand) {
  const tried = [];
  if (brand.logo) tried.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(brand.logo)}?width=240`);
  for (const url of tried) {
    try {
      return await image(url);
    } catch (error) {
      console.warn('  ', brand.id, error.message);
    }
  }
  if (brand.site) {
    try {
      for (const url of await siteIcons(brand.site)) {
        try {
          return await image(url);
        } catch (error) {
          console.warn('  ', brand.id, error.message);
        }
      }
    } catch (error) {
      console.warn('  ', brand.id, error.message);
    }
    try {
      return await image(`https://www.google.com/s2/favicons?domain=${new URL(brand.site).hostname}&sz=128`);
    } catch (error) {
      console.warn('  ', brand.id, error.message);
    }
  }
  return null;
}

mkdirSync(OUT, { recursive: true });
const brands = JSON.parse(readFileSync(LIST, 'utf8'));
for (const brand of brands) {
  const source = await logoOf(brand);
  if (!source) {
    delete brand.icon;
    console.log('badge', brand.id);
    continue;
  }

  const trimmed = await sharp(source).trim().toBuffer();
  await sharp(trimmed)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(join(OUT, `${brand.id}.webp`));
  brand.icon = true;
  console.log('ok', brand.id);
  await new Promise((resolve) => setTimeout(resolve, 300));
}
writeFileSync(LIST, `[\n${brands.map((brand) => `  ${JSON.stringify(brand)}`).join(',\n')}\n]\n`);
