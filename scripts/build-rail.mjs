import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'rail.json.gz');
const AGENT = { 'User-Agent': 'RAITTA build script (https://raitta.fi)', 'Digitraffic-User': 'RAITTA' };
const OVERPASS = 'https://overpass.private.coffee/api/interpreter';

const QUERIES = [
  '[out:json][timeout:300];way["railway"="rail"][!"service"](59.6,19.0,70.2,31.7);out geom;',
  '[out:json][timeout:300];way["railway"="rail"]["service"~"^(siding|crossover)$"](59.6,19.0,70.2,31.7);out geom;',
];

const SERVICE_COST = 1.5;

const SNAP_M = 1500;

const DETOUR = 2.2;
const DETOUR_M = 2000;

const SIMPLIFY_M = 12;

const rad = Math.PI / 180;
function metres(a, b) {
  const x = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * rad);
  const y = b[1] - a[1];
  return Math.hypot(x, y) * 111_320;
}

async function json(url, init) {
  const res = await fetch(url, { ...init, headers: { ...AGENT, ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

const cached = process.argv.slice(2);
const downloads = await Promise.all(
  QUERIES.map((query, i) =>
    cached[i] && existsSync(cached[i]) ? JSON.parse(readFileSync(cached[i], 'utf8')) : json(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: query }) }),
  ),
);
const overpass = { elements: downloads.flatMap((download) => download.elements) };
const index = new Map();
const points = [];
const edges = [];
const node = (lon, lat) => {
  const key = `${lon.toFixed(6)},${lat.toFixed(6)}`;
  let id = index.get(key);
  if (id === undefined) {
    id = points.length;
    index.set(key, id);
    points.push([lon, lat]);
    edges.push([]);
  }
  return id;
};
for (const way of overpass.elements) {
  if (!way.geometry) continue;
  let previous = -1;
  const cost = way.tags?.service ? SERVICE_COST : 1;
  for (const { lon, lat } of way.geometry) {
    const id = node(lon, lat);
    if (previous >= 0 && previous !== id) {
      const d = metres(points[previous], points[id]) * cost;
      edges[previous].push([id, d]);
      edges[id].push([previous, d]);
    }
    previous = id;
  }
}
console.log(`track: ${overpass.elements.length} ways, ${points.length} points`);

const CELL = 0.02;
const grid = new Map();
points.forEach(([lon, lat], id) => {
  const key = `${Math.floor(lon / CELL)},${Math.floor(lat / CELL)}`;
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(id);
});

const GAP_M = 120;
let bridged = 0;
points.forEach((at, id) => {
  if (edges[id].length !== 1) return;
  const near = new Set([id, edges[id][0][0]]);
  let best = -1;
  let bestD = GAP_M;
  const cx = Math.floor(at[0] / CELL);
  const cy = Math.floor(at[1] / CELL);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const other of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
        if (near.has(other)) continue;
        const d = metres(at, points[other]);
        if (d < bestD) [best, bestD] = [other, d];
      }
  if (best < 0) return;

  edges[id].push([best, bestD * 3]);
  edges[best].push([id, bestD * 3]);
  bridged++;
});
console.log(`joined ${bridged} loose ends`);

function nearest(at) {
  let best = -1;
  let bestD = SNAP_M;
  const cx = Math.floor(at[0] / CELL);
  const cy = Math.floor(at[1] / CELL);
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      for (const id of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
        const d = metres(at, points[id]);
        if (d < bestD) [best, bestD] = [id, d];
      }
  return best;
}

const stations = (await json('https://rata.digitraffic.fi/api/v1/metadata/stations')).filter((s) => s.countryCode === 'FI');
const where = new Map(stations.map((s) => [s.stationShortCode, [Number(s.longitude.toFixed(5)), Number(s.latitude.toFixed(5))]]));
const pairs = new Set();
const today = new Date();
for (let day = 0; day < 7; day++) {
  const date = new Date(today.getTime() + day * 86_400_000).toISOString().slice(0, 10);
  const trains = await json(`https://rata.digitraffic.fi/api/v1/trains/${date}`);
  for (const train of trains) {
    if (train.trainCategory !== 'Long-distance') continue;
    const codes = train.timeTableRows.map((row) => row.stationShortCode).filter((code, i, all) => code !== all[i - 1]);
    for (let i = 1; i < codes.length; i++) pairs.add([codes[i - 1], codes[i]].sort().join('|'));
  }
  console.log(`${date}: ${pairs.size} station pairs so far`);
}

class Heap {
  items = [];
  push(item) {
    const a = this.items;
    a.push(item);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

function track(from, to) {
  const limit = metres(points[from], points[to]) * DETOUR + DETOUR_M;
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const heap = new Heap();
  heap.push([metres(points[from], points[to]), from]);
  while (heap.size) {
    const [, id] = heap.pop();
    if (id === to) break;
    const here = dist.get(id);
    if (here > limit) return null;
    for (const [next, d] of edges[id]) {
      const total = here + d;
      if (total < (dist.get(next) ?? Infinity)) {
        dist.set(next, total);
        prev.set(next, id);
        heap.push([total + metres(points[next], points[to]), next]);
      }
    }
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev.get(path[path.length - 1]));
  return path.reverse().map((id) => points[id]);
}

function simplify(line) {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = -1;
    let worstD = SIMPLIFY_M;
    const [ax, ay] = line[a];
    const [bx, by] = line[b];
    const k = Math.cos(ay * rad);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = line[i];
      const dx = (bx - ax) * k;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, (((px - ax) * k) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot((px - ax) * k - t * dx, py - ay - t * dy) * 111_320;
      if (d > worstD) [worst, worstD] = [i, d];
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return line.filter((_, i) => keep[i]).map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
}

const segments = {};
let missing = 0;
for (const pair of pairs) {
  const [a, b] = pair.split('|');
  const from = where.has(a) ? nearest(where.get(a)) : -1;
  const to = where.has(b) ? nearest(where.get(b)) : -1;
  const line = from >= 0 && to >= 0 ? track(from, to) : null;
  if (line) segments[pair] = simplify(line);
  else {
    missing++;
    if (process.env.RAIL_DEBUG) console.log(`  no track ${pair}: ${from < 0 ? `${a} off the track` : to < 0 ? `${b} off the track` : "no path within the detour"}`);
  }
}
console.log(`segments: ${Object.keys(segments).length} on the rails, ${missing} left as straight lines`);

const used = new Set([...pairs].flatMap((pair) => pair.split('|')));
const out = { stations: Object.fromEntries([...used].filter((code) => where.has(code)).map((code) => [code, where.get(code)])), segments };
writeFileSync(OUT, gzipSync(JSON.stringify(out), { level: 9 }));
console.log(`wrote ${OUT}`);
