import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

const QUERY = '[out:json][timeout:120];node["highway"="speed_camera"](59.5,19.0,70.1,31.6);out;';

let elements = null;
for (const mirror of MIRRORS) {
  try {
    const res = await fetch(mirror, { method: 'POST', body: new URLSearchParams({ data: QUERY }), headers: { 'User-Agent': 'RAITTA build script (https://raitta.fi)' } });
    if (!res.ok) throw new Error(String(res.status));
    elements = (await res.json()).elements;
    break;
  } catch (error) {
    console.warn(mirror, error.message);
  }
}
if (!elements) throw new Error('No Overpass mirror answered');
const cameras = elements.map((e) => [Number(e.lon.toFixed(6)), Number(e.lat.toFixed(6)), Number.parseInt(e.tags?.maxspeed ?? '', 10) || 0]);
writeFileSync(join(ROOT, 'public', 'data', 'speed-cameras.json'), JSON.stringify(cameras));
console.log('Speed cameras:', cameras.length);
