import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data');
const HEADERS = { 'User-Agent': 'RAITTA build script (https://raitta.fi)', Accept: 'application/sparql-results+json' };

const PER_CITY = 20;
const ICON_PX = 96;
const LANGUAGES = ['fi', 'en', 'sv', 'ru', 'et'];

const KINDS = [
  'Q570116', 'Q2319498', 'Q33506', 'Q207694', 'Q16970', 'Q2977', 'Q108325', 'Q120560', 'Q44539', 'Q32815', 'Q34627',
  'Q23413', 'Q57821', 'Q1785071', 'Q16560', 'Q1802963', 'Q22698', 'Q1107656', 'Q167346', 'Q12280', 'Q4989906',
  'Q575759', 'Q179700', 'Q860861', 'Q11303', 'Q1440300', 'Q12518', 'Q483110', 'Q1076486', 'Q24354', 'Q153562',
  'Q1060829', 'Q7075', 'Q194195', 'Q43501', 'Q2281788', 'Q839954', 'Q55488', 'Q174782', 'Q41176', 'Q1497364',
  'Q15243209', 'Q18674739', 'Q39614', 'Q3914', 'Q2087181', 'Q1329623', 'Q811979',
];

const sparql = (bbox) => `
SELECT ?item ?coord ?image ?links WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord.
    bd:serviceParam wikibase:cornerSouthWest "Point(${bbox[0]} ${bbox[1]})"^^geo:wktLiteral;
                    wikibase:cornerNorthEast "Point(${bbox[2]} ${bbox[3]})"^^geo:wktLiteral.
  }
  ?item wdt:P18 ?image; wdt:P31 ?kind; wikibase:sitelinks ?links.
  VALUES ?kind { ${KINDS.map((q) => `wd:${q}`).join(' ')} }
}
ORDER BY DESC(?links)
LIMIT ${PER_CITY * 4}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function query(text) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: text })}`, { headers: HEADERS });
    if (res.ok) return (await res.json()).results.bindings;
    await wait(4000 * (attempt + 1));
  }
  throw new Error('Wikidata query failed');
}

async function labels(ids) {
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|descriptions|sitelinks', languages: LANGUAGES.join('|'), sitefilter: LANGUAGES.map((lang) => `${lang}wiki`).join('|'), format: 'json' })}`,
    { headers: HEADERS },
  );
  return (await res.json()).entities;
}

async function credit(file) {
  const res = await fetch(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'extmetadata', format: 'json' })}`,
    { headers: HEADERS },
  );
  const page = Object.values((await res.json()).query.pages)[0];
  const meta = page?.imageinfo?.[0]?.extmetadata ?? {};
  const strip = (html) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return { author: strip(meta.Artist?.value).slice(0, 80), license: strip(meta.LicenseShortName?.value) };
}

const pick = (entity, field) => Object.fromEntries(LANGUAGES.flatMap((lang) => (entity?.[field]?.[lang] ? [[lang, entity[field][lang].value]] : [])));

async function squareIcon(file, id) {
  const res = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=200`, { headers: HEADERS });
  if (!res.ok) throw new Error(`photo ${file}: ${res.status}`);
  
  await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(ICON_PX, ICON_PX, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80 })
    .toFile(join(OUT, 'landmarks', `${id}.webp`));
}

const regions = JSON.parse(readFileSync(join(OUT, 'regions.json'), 'utf8'));
mkdirSync(join(OUT, 'landmarks'), { recursive: true });
const result = {};
for (const region of regions) {
  const rows = await query(sparql(region.bbox));
  
  const items = [];
  for (const row of rows) {
    const id = row.item.value.split('/').pop();
    if (items.some((item) => item.id === id)) continue;
    const [lon, lat] = row.coord.value.replace(/^Point\(|\)$/g, '').split(' ').map(Number);
    items.push({ id, lat, lon, file: decodeURIComponent(row.image.value.split('/').pop()), links: Number(row.links.value) });
    if (items.length === PER_CITY) break;
  }
  const entities = items.length ? await labels(items.map((item) => item.id)) : {};
  const landmarks = [];
  for (const item of items) {
    try {
      await squareIcon(item.file, item.id);
      landmarks.push({
        id: item.id,
        lat: Number(item.lat.toFixed(6)),
        lon: Number(item.lon.toFixed(6)),
        name: pick(entities[item.id], 'labels'),
        about: pick(entities[item.id], 'descriptions'),
        
        wiki: Object.fromEntries(LANGUAGES.flatMap((lang) => (entities[item.id]?.sitelinks?.[`${lang}wiki`] ? [[lang, entities[item.id].sitelinks[`${lang}wiki`].title]] : []))),
        links: item.links,
        photo: item.file,
        
        thumb: ((hash) => `${hash[0]}/${hash.slice(0, 2)}`)(createHash('md5').update(item.file.replaceAll(' ', '_')).digest('hex')),
        credit: await credit(item.file),
      });
    } catch (error) {
      console.warn(region.id, item.id, error.message);
    }
  }
  result[region.id] = landmarks;
  console.log(region.id, landmarks.map((l) => l.name.fi ?? l.name.en ?? l.id).join(', '));
  await wait(1500);
}
writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(result));
console.log('Wrote landmarks for', Object.keys(result).length, 'cities');
