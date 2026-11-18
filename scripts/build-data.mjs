import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGIONS = JSON.parse(readFileSync(join(ROOT, 'src', 'core', 'regions.json'), 'utf8'));
const OUT = join(ROOT, 'public', 'data');
const CACHE_MAX_AGE_MS = 24 * 3600 * 1000;

const SHARD_TARGET_BYTES = 256 * 1024;

const SHAPE_TOLERANCE_DEG = 0.00005;
const FEED_FILES = new Set([
  'calendar.txt',
  'calendar_dates.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'stops.txt',
  'shapes.txt',
  'municipalities.txt',
]);

const argument = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

async function loadFeed(region) {
  const file = join(ROOT, '.cache', `${region.id}.zip`);
  const fresh = existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_MAX_AGE_MS;
  if (fresh && !process.argv.includes('--force')) return readFileSync(file);
  const res = await fetch(region.gtfs);
  if (!res.ok) throw new Error(`${region.id}: feed download failed with ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  return buf;
}

function parseLine(line) {
  const out = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let end = i + 1;
      let value = '';
      for (;;) {
        const q = line.indexOf('"', end);
        if (q === -1) throw new Error(`Unterminated quote: ${line}`);
        value += line.slice(end, q);
        if (line[q + 1] === '"') {
          value += '"';
          end = q + 2;
        } else {
          i = q + 2;
          break;
        }
      }
      out.push(value);
    } else {
      const comma = line.indexOf(',', i);
      const end = comma === -1 ? line.length : comma;
      out.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return out;
}

function table(files, name) {
  if (!files[name]) return { index: {}, rows: [] };
  const buf = Buffer.from(files[name].buffer, files[name].byteOffset, files[name].byteLength);
  const readLine = (start) => {
    const nl = buf.indexOf(10, start);
    const end = nl === -1 ? buf.length : nl;
    const stop = end > start && buf[end - 1] === 13 ? end - 1 : end;
    return { text: buf.toString('utf8', start, stop), next: end + 1 };
  };
  const first = readLine(0);
  const header = parseLine(first.text.replace(/^﻿/, ''));
  const index = Object.fromEntries(header.map((h, i) => [h, i]));
  return {
    index,
    rows: {
      *[Symbol.iterator]() {
        let pos = first.next;
        while (pos < buf.length) {
          const { text, next } = readLine(pos);
          pos = next;
          if (text) yield parseLine(text);
        }
      },
    },
  };
}

const seconds = (hms) => {
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

const naturalLine = (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b);

function shardOf(id, shards) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % shards;
}

function writeShards(dir, entries) {
  const bytes = entries.reduce((total, [, value]) => total + JSON.stringify(value).length, 0);
  const shards = Math.max(1, Math.ceil(bytes / SHARD_TARGET_BYTES));
  const groups = Array.from({ length: shards }, () => ({}));
  for (const [id, value] of entries) groups[shardOf(id, shards)][id] = value;
  groups.forEach((group, i) => writeGzip(join(dir, `${i}.json.gz`), group));
  return shards;
}

function modeOf(routeType) {
  const type = Number(routeType);
  if (type === 0 || type === 900) return 'tram';
  if (type === 1 || type === 401) return 'metro';
  if (type === 2 || (type >= 100 && type < 200)) return 'train';
  if (type === 4 || type === 1000) return 'ferry';
  return 'bus';
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let worstDist = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / len;
      if (d > worstDist) {
        worstDist = d;
        worst = i;
      }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
};

const writeGzip = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, gzipSync(JSON.stringify(value), { level: 9 }));
};

const compactDate = (d) => Number(d.toISOString().slice(0, 10).replaceAll('-', ''));

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

async function buildRegion(region) {
  const files = unzipSync(new Uint8Array(await loadFeed(region)), {
    filter: (file) => FEED_FILES.has(file.name),
  });
  const out = join(OUT, region.id);
  const today = compactDate(new Date());

  const services = {};
  const dayCols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const calendar = table(files, 'calendar.txt');
  for (const r of calendar.rows) {
    services[r[calendar.index.service_id]] = {
      days: dayCols.map((d) => r[calendar.index[d]]).join(''),
      start: Number(r[calendar.index.start_date]),
      end: Number(r[calendar.index.end_date]),
      add: [],
      remove: [],
    };
  }
  const exceptions = table(files, 'calendar_dates.txt');
  for (const r of exceptions.rows) {
    const id = r[exceptions.index.service_id];
    const s = (services[id] ??= { days: '0000000', start: 99999999, end: 0, add: [], remove: [] });
    const date = Number(r[exceptions.index.date]);
    (r[exceptions.index.exception_type] === '1' ? s.add : s.remove).push(date);
  }
  for (const [id, s] of Object.entries(services)) {
    const lastDay = s.add.reduce((max, d) => Math.max(max, d), s.end);
    if (lastDay < today) delete services[id];
  }

  const routes = table(files, 'routes.txt');
  const lineByRoute = new Map();
  const lines = new Map();
  for (const r of routes.rows) {
    const id = r[routes.index.route_short_name] || r[routes.index.route_long_name] || r[routes.index.route_id];
    lineByRoute.set(r[routes.index.route_id], id);

    if (!lines.has(id)) {
      lines.set(id, { id, name: r[routes.index.route_long_name] ?? '', mode: modeOf(r[routes.index.route_type]) });
    }
  }

  const trips = table(files, 'trips.txt');
  const tripInfo = new Map();
  for (const r of trips.rows) {
    const serviceId = r[trips.index.service_id];
    if (!services[serviceId]) continue;
    tripInfo.set(r[trips.index.trip_id], {
      line: lineByRoute.get(r[trips.index.route_id]),
      service: serviceId,
      headsign: r[trips.index.trip_headsign] ?? '',
      dir: Number(r[trips.index.direction_id]) || 0,
      shape: r[trips.index.shape_id] ?? '',

      calls: [],
    });
  }

  const stopIndex = new Map();
  const stopIds = [];
  const stopTimes = table(files, 'stop_times.txt');
  const st = stopTimes.index;
  for (const r of stopTimes.rows) {
    const trip = tripInfo.get(r[st.trip_id]);
    if (!trip) continue;
    const stopId = r[st.stop_id];
    let idx = stopIndex.get(stopId);
    if (idx === undefined) {
      idx = stopIds.length;
      stopIds.push(stopId);
      stopIndex.set(stopId, idx);
    }
    const time = r[st.departure_time] || r[st.arrival_time];
    if (!time) continue;
    trip.calls.push(Number(r[st.stop_sequence]), idx, seconds(time) * 2 + (r[st.pickup_type] === '1' ? 0 : 1));
  }

  const stops = table(files, 'stops.txt');
  const si = stops.index;
  const stopNames = new Map();
  for (const r of stops.rows) stopNames.set(r[si.stop_id], r[si.stop_name]);

  const departures = new Map();
  const departureCount = new Map();
  const patterns = new Map();

  const variants = new Map();
  for (const trip of tripInfo.values()) {
    const count = trip.calls.length / 3;
    if (count < 2) continue;
    const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => trip.calls[a * 3] - trip.calls[b * 3]);
    const seq = order.map((i) => ({
      stopId: stopIds[trip.calls[i * 3 + 1]],
      time: Math.floor(trip.calls[i * 3 + 2] / 2),
      pickup: trip.calls[i * 3 + 2] % 2 === 1,
    }));
    trip.calls = null;
    const headsign = trip.headsign || stopNames.get(seq[count - 1].stopId) || '';
    seq.forEach((s, i) => {
      if (i === count - 1 || !s.pickup) return;
      departureCount.set(s.stopId, (departureCount.get(s.stopId) ?? 0) + 1);
      let byGroup = departures.get(s.stopId);
      if (!byGroup) departures.set(s.stopId, (byGroup = new Map()));
      const key = `${trip.line}\u0000${headsign}`;
      let byService = byGroup.get(key);
      if (!byService) byGroup.set(key, (byService = new Map()));
      let list = byService.get(trip.service);
      if (!list) byService.set(trip.service, (list = []));
      list.push(s.time);
    });

    const key = `${trip.line}|${trip.dir}|${headsign}|${seq.map((s) => s.stopId).join(',')}`;
    const start = seq[0].time;
    const running = seq.map((s) => s.time - start);
    const variantKey = `${key}|${running.join(',')}`;
    let variant = variants.get(variantKey);
    if (!variant) {
      variant = { line: trip.line, headsign, stops: seq.map((s) => s.stopId), running, services: new Map() };
      variants.set(variantKey, variant);
    }
    const starts = variant.services.get(trip.service);
    if (starts) starts.push(start);
    else variant.services.set(trip.service, [start]);

    const existing = patterns.get(key);
    if (existing) existing.trips++;
    else {
      patterns.set(key, {
        line: trip.line,
        dir: trip.dir,
        headsign,
        shape: trip.shape,
        stops: seq.map((s) => s.stopId),
        offsets: seq.map((s) => Math.round((s.time - seq[0].time) / 60)),
        trips: 1,
      });
    }
  }
  tripInfo.clear();

  const patternList = [...patterns.values()]
    .sort((a, b) => naturalLine(a.line, b.line) || a.dir - b.dir || b.trips - a.trips)
    .map((p, i) => ({ id: i, ...p }));

  const shapePoints = table(files, 'shapes.txt');
  const wantedShapes = new Set(patternList.map((p) => p.shape));
  const shapes = new Map();
  for (const r of shapePoints.rows) {
    const id = r[shapePoints.index.shape_id];
    if (!wantedShapes.has(id)) continue;
    let list = shapes.get(id);
    if (!list) shapes.set(id, (list = []));
    list.push([
      Number(r[shapePoints.index.shape_pt_sequence]),
      Number(r[shapePoints.index.shape_pt_lon]),
      Number(r[shapePoints.index.shape_pt_lat]),
    ]);
  }

  rmSync(out, { recursive: true, force: true });

  const linesAtStop = new Map();
  for (const p of patternList) {
    for (const stopId of p.stops) {
      let set = linesAtStop.get(stopId);
      if (!set) linesAtStop.set(stopId, (set = new Set()));
      set.add(p.line);
    }
  }

  const municipalities = table(files, 'municipalities.txt');
  const municipalityName = new Map();
  for (const r of municipalities.rows) municipalityName.set(r[0], r[1]);
  const stopList = [];
  for (const r of stops.rows) {
    const id = r[si.stop_id];
    const served = linesAtStop.get(id);
    if (!served) continue;
    stopList.push({
      id,
      code: r[si.stop_code] || id,
      name: r[si.stop_name],
      lat: Number(Number(r[si.stop_lat]).toFixed(5)),
      lon: Number(Number(r[si.stop_lon]).toFixed(5)),
      zone: r[si.zone_id] ?? '',
      city: municipalityName.get(r[si.municipality_id]) ?? '',
      lines: [...served].sort(naturalLine),
    });
  }

  const shapesByLine = new Map();
  for (const p of patternList) {
    let set = shapesByLine.get(p.line);
    if (!set) shapesByLine.set(p.line, (set = new Set()));
    set.add(p.shape);
  }
  const shapeEntries = [];
  for (const [line, ids] of shapesByLine) {
    const lineShapes = {};
    for (const id of ids) {
      const pts = shapes.get(id);
      if (!pts) continue;
      pts.sort((a, b) => a[0] - b[0]);
      lineShapes[id] = simplify(pts.map((p) => [p[1], p[2]]), SHAPE_TOLERANCE_DEG).map(([x, y]) => [
        Number(x.toFixed(5)),
        Number(y.toFixed(5)),
      ]);
    }
    shapeEntries.push([line, lineShapes]);
  }
  const shapeShards = writeShards(join(out, 'shapes'), shapeEntries);

  let timetableBytes = 0;
  const timetableEntries = [];
  for (const { id: stopId } of stopList) {
    const groups = [];

    for (const [key, byService] of departures.get(stopId) ?? []) {
      const [line, headsign] = key.split('\u0000');
      const merged = new Map();
      for (const [service, times] of byService) {
        times.sort((a, b) => a - b);
        const signature = times.join(',');
        const entry = merged.get(signature);
        if (entry) entry.services.push(service);
        else merged.set(signature, { services: [service], times });
      }
      for (const { services: ids, times } of merged.values()) {
        const deltas = times.map((t, i) => (i === 0 ? t : t - times[i - 1]));
        groups.push({ line, headsign, services: ids, times: deltas });
      }
    }
    const json = JSON.stringify(groups);
    timetableBytes += json.length;
    timetableEntries.push([stopId, groups]);
  }
  const timetableShards = writeShards(join(out, 'timetables'), timetableEntries);

  const lineList = [...lines.values()].filter((l) => shapesByLine.has(l.id)).sort((a, b) => naturalLine(a.id, b.id));
  writeGzip(join(out, 'lines.json.gz'), lineList);
  writeGzip(join(out, 'stops.json.gz'), stopList);
  writeGzip(join(out, 'patterns.json.gz'), patternList);

  const stopOrder = new Map(stopList.map((stop, i) => [stop.id, i]));
  const routeList = [...variants.values()].map((variant) => {
    const merged = new Map();
    for (const [service, starts] of variant.services) {
      starts.sort((a, b) => a - b);
      const signature = starts.join(',');
      const entry = merged.get(signature);
      if (entry) entry.v.push(service);
      else merged.set(signature, { v: [service], d: starts.map((t, i) => (i === 0 ? t : t - starts[i - 1])) });
    }
    return {
      l: variant.line,
      h: variant.headsign,
      s: variant.stops.map((id) => stopOrder.get(id)),
      o: variant.running.map((t, i) => (i === 0 ? t : t - variant.running[i - 1])),
      t: [...merged.values()],
    };
  });
  writeGzip(join(out, 'routes.json.gz'), routeList);
  writeGzip(join(out, 'services.json.gz'), services);

  const hub = stopList.reduce((best, s) =>
    (departureCount.get(s.id) ?? 0) > (departureCount.get(best.id) ?? 0) ? s : best,
  );
  const lats = stopList.map((s) => s.lat).sort((a, b) => a - b);
  const lons = stopList.map((s) => s.lon).sort((a, b) => a - b);
  const validTo = Object.values(services).reduce((max, s) => s.add.reduce((m, d) => Math.max(m, d), Math.max(max, s.end)), 0);

  console.log(
    `${region.id}: ${lineList.length} lines, ${stopList.length} stops, ${patternList.length} patterns, ` +
      `timetables ${(timetableBytes / 1e6).toFixed(1)} MB, valid to ${validTo}`,
  );
  return {
    id: region.id,
    center: { lat: hub.lat, lon: hub.lon },

    bbox: [percentile(lons, 0.01), percentile(lats, 0.01), percentile(lons, 0.99), percentile(lats, 0.99)],
    stops: stopList.length,
    lines: lineList.length,
    shapeShards,
    timetableShards,
    generatedAt: new Date().toISOString(),
    validTo,
  };
}

async function main() {
  const indexFile = join(OUT, 'regions.json');
  const only = argument('only')?.split(',');
  const previous = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : [];
  const built = new Map(previous.map((r) => [r.id, r]));

  for (const name of ['lines.json', 'stops.json', 'patterns.json', 'services.json', 'meta.json', 'timetables', 'shapes']) {
    rmSync(join(OUT, name), { recursive: true, force: true });
  }

  for (const region of REGIONS) {
    if (only && !only.includes(region.id)) continue;
    try {
      built.set(region.id, await buildRegion(region));
    } catch (error) {
      console.error(`${region.id}: FAILED - ${error.message}`);
    }
    writeJson(indexFile, REGIONS.flatMap((r) => built.get(r.id) ?? []));
  }
}

await main();
