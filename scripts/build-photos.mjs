import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'city-photos-v2.json');
const HEADERS = { 'User-Agent': 'RAITTA/1.0 (https://raitta.fi; city photos for the region list)' };
const FILES = {
  helsinki: 'Southern Helsinki panorama 2011-06-28 1.jpg',
  tampere: 'Tampere aerial view 1.jpg',
  turku: 'Aurajoki Turku panorama.jpg',
  oulu: 'Oulu Cathedral 2018.jpg',
  jyvaskyla: 'Jyväskylä panorama.jpg',
  kuopio: 'Kuopio aerial 6.jpg',
  lahti: 'Lahti view 2.jpg',
  pori: 'Pori aerial 2.jpg',
  joensuu: 'Joensuun Tori Drone.jpg',
  lappeenranta: 'Lappeenranta harbour.jpg',
  hameenlinna: 'Hämeen linna, Hämeenlinna, Finland (48841053456).jpg',
  vaasa: 'Vaasa aerial 3.jpg',
  rovaniemi: 'Rovaniemi -The ”Lumberjack\'s Candle Bridge.jpg',
  kotka: 'Kotka city hall.JPG',
  kouvola: 'Kouvola aerial 2.jpg',
  mikkeli: 'Mikkeli, Finland, view from Savilahti.jpg',
  salo: 'SALO keskustan.JPG',
  kajaani: 'A view to Kauppakatu, the main street of Kajaani.JPG',
  raasepori: 'Ekenäs old town 1.jpg',
};

const plain = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const photos = {};
for (const [id, file] of Object.entries(FILES)) {
  if (!file) continue;

  await new Promise((resolve) => setTimeout(resolve, 800));
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1920', titles: `File:${file}` });

  let info;
  for (let attempt = 0; attempt < 4 && !info?.thumburl; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: HEADERS }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    info = json?.query?.pages?.[0]?.imageinfo?.[0];
  }
  const meta = info?.extmetadata ?? {};
  const license = plain(meta.LicenseShortName?.value);
  if (!info?.thumburl || !/^(CC|Public domain|PD)/i.test(license)) {
    console.log(id.padEnd(13), 'skipped:', license || 'not found');
    continue;
  }

  photos[id] = { url: info.thumburl.replace('/1920px-', '/960px-'), large: info.thumburl, author: plain(meta.Artist?.value) || 'Wikimedia Commons', license, source: info.descriptionurl };
  console.log(id.padEnd(13), `${license} · ${photos[id].author}`);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(photos, null, 1));

writeFileSync(join(dirname(OUT), 'city-photos.json'), JSON.stringify(photos, null, 1));
