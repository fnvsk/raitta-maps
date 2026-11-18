import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'places');
const MIRRORS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const AREA = 'area["ISO3166-1"="FI"][admin_level=2]->.fi;';

const TILED_SHOPS = [
  'accessories', 'alcohol', 'antiques', 'art', 'bag', 'bakery', 'beauty', 'bed', 'beverages', 'bicycle', 'books', 'boutique', 'butcher', 'camera', 'car', 'car_repair',
  'car_parts', 'carpet', 'charity', 'chemist', 'chocolate', 'clothes', 'coffee', 'computer', 'confectionery', 'convenience', 'copyshop', 'cosmetics', 'deli', 'delicatessen',
  'department_store', 'doityourself', 'dry_cleaning', 'electronics', 'erotic', 'fabric', 'florist', 'frozen_food', 'furniture', 'garden_centre', 'general', 'gift', 'greengrocer',
  'hairdresser', 'hardware', 'hearing_aids', 'hifi', 'ice_cream', 'interior_decoration', 'jewelry', 'kiosk', 'lamps', 'laundry', 'mall', 'massage', 'mobile_phone', 'motorcycle',
  'music', 'musical_instrument', 'newsagent', 'optician', 'outdoor', 'perfume', 'perfumery', 'pet', 'photo', 'second_hand', 'shoes', 'sports', 'stationery', 'supermarket',
  'tailor', 'tattoo', 'ticket', 'tobacco', 'toys', 'travel_agency', 'video', 'video_games', 'watches', 'weapons', 'wholesale', 'wine', 'locksmith', 'computer', 'books',
];
const AMENITIES = [
  'social_facility', 'social_centre', 'events_venue', 'conference_centre', 'exhibition_centre', 'music_venue', 'driving_school', 'music_school', 'language_school',
  'dancing_school', 'prep_school', 'childcare', 'car_rental', 'boat_rental', 'vehicle_inspection', 'bureau_de_change', 'money_transfer', 'payment_centre', 'coworking_space',
  'studio', 'stripclub', 'casino', 'gambling', 'karaoke_box', 'internet_cafe', 'planetarium', 'animal_boarding', 'animal_shelter', 'lost_property_office', 'public_bath', 'car_wash',
];
const LEISURE = [
  'fitness_centre', 'sauna', 'dance', 'bowling_alley', 'adult_gaming_centre', 'amusement_arcade', 'tanning_salon', 'sports_hall', 'escape_game', 'trampoline_park',
  'horse_riding', 'fitness_station', 'hackerspace',
];
const OFFICES = ['yes', 'business_park', 'coworking', 'cleaning', 'communication', 'industrial_design', 'consulting'];

const SHOP_CLASSES = {
  grocery: 'grocery', food: 'grocery', health_food: 'grocery', pastry: 'grocery', seafood: 'grocery', cheese: 'grocery', farm: 'grocery', spices: 'grocery', ethnic: 'grocery',
  nails: 'hairdresser', barbershop: 'hairdresser', piercing: 'hairdresser', tyres: 'car_repair', pet_grooming: 'pet_grooming',
};
const first = (value) => String(value).split(';')[0].trim();

const QUERIES = [
  ['shops', `nwr["shop"]["name"]["shop"!~"^(${TILED_SHOPS.join('|')})$"](area.fi);`, (t) => t.shop && !TILED_SHOPS.includes(t.shop), (t) => [SHOP_CLASSES[first(t.shop)] ?? 'shop', first(t.shop)]],
  ['amenities', `nwr["amenity"~"^(${AMENITIES.join('|')})$"]["name"](area.fi);`, (t) => AMENITIES.includes(t.amenity), (t) => [t.amenity, t.amenity]],
  ['leisure', `nwr["leisure"~"^(${LEISURE.join('|')})$"]["name"](area.fi);`, (t) => LEISURE.includes(t.leisure), (t) => [t.leisure, t.leisure]],
  ['healthcare', `nwr["healthcare"]["name"][!"amenity"](area.fi);`, (t) => t.healthcare && !t.amenity, (t) => ['healthcare', first(t.healthcare)]],
  ['offices', `nwr["office"~"^(${OFFICES.join('|')})$"]["name"][!"shop"][!"amenity"](area.fi);`, (t) => OFFICES.includes(t.office) && !t.shop && !t.amenity, (t) => ['office', first(t.office)]],
  ['crafts', `nwr["craft"]["name"][!"shop"][!"amenity"](area.fi);`, (t) => t.craft && !t.shop && !t.amenity, (t) => ['craft', first(t.craft)]],
  ['memorials', `nwr["historic"="memorial"]["name"](area.fi);`, (t) => t.historic === 'memorial', () => ['memorial', 'memorial']],
  ['apartments', `nwr["tourism"="apartment"]["name"](area.fi);`, (t) => t.tourism === 'apartment', () => ['apartment', 'apartment']],
];

const extractAt = process.argv.indexOf('--osm');
const extract = extractAt > 0 ? JSON.parse(readFileSync(process.argv[extractAt + 1], 'utf8')) : null;

const BANDS = [59, 60.2, 60.6, 61, 61.6, 62.4, 63.4, 65, 70.2];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CACHE = join(ROOT, 'node_modules', '.cache', 'extra-places');
mkdirSync(CACHE, { recursive: true });
async function overpass(body, band) {
  const file = join(CACHE, `${createHash('sha1').update(`${body}|${band}`).digest('hex').slice(0, 16)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const elements = await fetchBand(body, band);
  writeFileSync(file, JSON.stringify(elements));
  return elements;
}

async function fetchBand(body, [south, north]) {
  const query = `[out:json][timeout:300][bbox:${south},19,${north},31.7];${AREA}(${body});out center tags;`;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const mirror of MIRRORS) {
      try {
        const res = await fetch(mirror, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'RAITTA build script (https://raitta.fi)' } });
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()).elements;
      } catch (error) {
        console.warn(mirror, error.message);
      }
    }
    await wait(30_000 * (attempt + 1));
  }
  throw new Error('No Overpass mirror answered');
}

const byOsm = new Map();
for (const [name, body, test, classOf] of QUERIES) {
  const elements = [];
  if (extract) elements.push(...extract.filter((element) => element.tags?.name && test(element.tags)));
  else for (let i = 0; i < BANDS.length - 1; i++) elements.push(...(await overpass(body, [BANDS[i], BANDS[i + 1]])));
  let kept = 0;
  for (const element of elements) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined || !element.tags?.name) continue;
    const osm = `${element.type[0]}${element.id}`;
    if (byOsm.has(osm)) continue;
    const [cls, sub] = classOf(element.tags);
    byOsm.set(osm, [Number(lon.toFixed(6)), Number(lat.toFixed(6)), cls, sub, element.tags.name, osm]);
    kept++;
  }
  console.log(name, kept);
}

const cellOf = (lat, lon) => `${(Math.floor(lat * 2) / 2).toFixed(1)}_${Math.floor(lon)}`;
const cells = new Map();
for (const row of byOsm.values()) {
  const key = cellOf(row[1], row[0]);
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(row);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [key, rows] of cells) writeFileSync(join(OUT, `${key}.json`), JSON.stringify(rows.sort((a, b) => a[1] - b[1] || a[0] - b[0])));
writeFileSync(join(OUT, 'index.json'), JSON.stringify([...cells.keys()].sort()));
rmSync(join(ROOT, 'public', 'data', 'extra-places.json'), { force: true });
console.log('Extra places:', byOsm.size, 'in', cells.size, 'cells');
