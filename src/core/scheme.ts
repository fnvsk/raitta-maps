import type { Line, Mode, Pattern, Stop } from './types';

export interface SchemeStation {
  id: string;
  name: string;
  lat: number;
  lon: number;

  stops: string[];
  lines: string[];
}

export interface SchemeEdge {
  a: string;
  b: string;
  lines: string[];
  minutes: number;
}

export interface SchemeNetwork {
  mode: Mode;
  stations: SchemeStation[];
  edges: SchemeEdge[];
  lines: string[];

  colors: Record<string, string>;

  runs: Record<string, string[][]>;
}

const PALETTE = ['#E4572E', '#2478F2', '#12A150', '#9333EA', '#F59E0B', '#0E7490', '#DB2777', '#65A30D', '#7C3AED', '#EA580C', '#0891B2', '#BE123C', '#4D7C0F', '#1D4ED8', '#C026D3'];
const MODE_FIRST: Partial<Record<Mode, string>> = { metro: '#EA580C', train: '#15803D' };

const SAME_STATION_M = 450;

const VARIANT_SHARE = 0.15;

const MINOR_LINE_SHARE = 0.2;

const stationName = (name: string) => name.replace(/\s+[A-F]$/, '');

const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

function mainLines(lines: Line[]): Line[] {
  const ids = new Set(lines.map((line) => line.id));
  return lines.filter((line) => {
    const base = /^(.*\d)[A-Z]$/i.exec(line.id)?.[1];
    return !(base && ids.has(base));
  });
}

export function buildNetwork(mode: Mode, allLines: Line[], patterns: Pattern[], stops: Stop[]): SchemeNetwork {
  const lines = mainLines(allLines.filter((line) => line.mode === mode)).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const lineIds = new Set(lines.map((line) => line.id));
  const stopIndex = new Map(stops.map((stop) => [stop.id, stop]));

  const stations: SchemeStation[] = [];
  const stationOf = new Map<string, SchemeStation>();
  const used = patterns.filter((pattern) => lineIds.has(pattern.line));
  const busiest = new Map<string, number>();
  for (const pattern of used) busiest.set(pattern.line, Math.max(busiest.get(pattern.line) ?? 0, pattern.trips));

  const busiestLine = Math.max(0, ...busiest.values());

  const minor = mode === 'tram' ? MINOR_LINE_SHARE : 0;
  const kept = used.filter((pattern) => (busiest.get(pattern.line) ?? 0) >= busiestLine * minor && pattern.trips >= (busiest.get(pattern.line) ?? 0) * VARIANT_SHARE);
  for (const pattern of kept) {
    for (const id of pattern.stops) {
      if (stationOf.has(id)) continue;
      const stop = stopIndex.get(id);
      if (!stop) continue;
      const name = stationName(stop.name);
      let station = stations.find((s) => s.name === name && metres(s, stop) < SAME_STATION_M);
      if (!station) {
        station = { id: `s${stations.length}`, name, lat: stop.lat, lon: stop.lon, stops: [], lines: [] };
        stations.push(station);
      }
      station.stops.push(id);

      const n = station.stops.length;
      station.lat += (stop.lat - station.lat) / n;
      station.lon += (stop.lon - station.lon) / n;
      stationOf.set(id, station);
    }
  }

  const edges = new Map<string, SchemeEdge>();
  for (const pattern of kept) {
    for (let i = 1; i < pattern.stops.length; i++) {
      const from = stationOf.get(pattern.stops[i - 1]);
      const to = stationOf.get(pattern.stops[i]);
      if (!from || !to || from === to) continue;
      const [a, b] = from.id < to.id ? [from, to] : [to, from];
      const key = `${a.id}|${b.id}`;
      const minutes = Math.max(1, (pattern.offsets[i] ?? 0) - (pattern.offsets[i - 1] ?? 0));
      const edge = edges.get(key) ?? { a: a.id, b: b.id, lines: [], minutes };
      if (!edge.lines.includes(pattern.line)) edge.lines.push(pattern.line);
      edge.minutes = Math.min(edge.minutes, minutes);
      edges.set(key, edge);
      for (const station of [from, to]) if (!station.lines.includes(pattern.line)) station.lines.push(pattern.line);
    }
  }
  passThrough(edges, new Map(stations.map((station) => [station.id, station])));
  const order = lines.map((line) => line.id).filter((id) => [...edges.values()].some((edge) => edge.lines.includes(id)));

  const trips = new Map<string, number>();
  for (const pattern of kept) trips.set(pattern.line, (trips.get(pattern.line) ?? 0) + pattern.trips);
  for (const edge of edges.values()) edge.lines.sort((x, y) => (trips.get(y) ?? 0) - (trips.get(x) ?? 0) || order.indexOf(x) - order.indexOf(y));
  const colors: Record<string, string> = {};
  const first = MODE_FIRST[mode];
  order.forEach((id, index) => {
    colors[id] = index === 0 && first ? first : PALETTE[(index + (first ? 1 : 0)) % PALETTE.length];
  });

  if (mode === 'metro' || mode === 'train') for (const id of order) colors[id] = first!;
  return { mode, stations: stations.filter((station) => station.lines.length), edges: [...edges.values()], lines: order, colors, runs: lineRuns(kept, stationOf, edges, order) };
}

function lineRuns(patterns: Pattern[], stationOf: Map<string, SchemeStation>, edges: Map<string, SchemeEdge>, lines: string[]): Record<string, string[][]> {
  const runs: Record<string, string[][]> = {};
  for (const line of lines) {
    const next = new Map<string, string[]>();
    for (const edge of edges.values()) {
      if (!edge.lines.includes(line)) continue;
      next.set(edge.a, [...(next.get(edge.a) ?? []), edge.b]);
      next.set(edge.b, [...(next.get(edge.b) ?? []), edge.a]);
    }
    const between = (a: string, b: string): string[] => {
      if (next.get(a)?.includes(b)) return [b];

      const back = new Map<string, string>([[a, a]]);
      let frontier = [a];
      while (frontier.length && !back.has(b)) {
        const following: string[] = [];
        for (const at of frontier) for (const to of next.get(at) ?? []) if (!back.has(to)) { back.set(to, at); following.push(to); }
        frontier = following;
      }
      if (!back.has(b)) return [b];
      const way: string[] = [];
      for (let at = b; at !== a; at = back.get(at)!) way.unshift(at);
      return way;
    };
    const found: string[][] = [];
    for (const pattern of patterns.filter((p) => p.line === line).sort((x, y) => y.stops.length - x.stops.length)) {
      const ids: string[] = [];
      for (const stop of pattern.stops) {
        const id = stationOf.get(stop)?.id;
        if (!id || ids.at(-1) === id) continue;
        if (ids.length) ids.push(...between(ids.at(-1)!, id));
        else ids.push(id);
      }
      if (ids.length < 2) continue;
      const key = ids.join(',');
      const reversed = [...ids].reverse().join(',');
      if (found.some((run) => { const k = `,${run.join(',')},`; return k.includes(`,${key},`) || k.includes(`,${reversed},`); })) continue;
      found.push(ids);
    }
    runs[line] = found;
  }
  return runs;
}

function passThrough(edges: Map<string, SchemeEdge>, stations: Map<string, SchemeStation>) {
  const length = (edge: SchemeEdge) => metres(stations.get(edge.a)!, stations.get(edge.b)!);
  const sorted = [...edges.values()].sort((x, y) => length(y) - length(x));
  for (const edge of sorted) {
    const direct = length(edge);

    const around = new Map<string, SchemeEdge[]>();
    for (const other of edges.values()) {
      if (other === edge) continue;
      around.set(other.a, [...(around.get(other.a) ?? []), other]);
      around.set(other.b, [...(around.get(other.b) ?? []), other]);
    }
    const best = new Map<string, { cost: number; via: SchemeEdge[] }>([[edge.a, { cost: 0, via: [] }]]);
    let frontier = [edge.a];
    for (let hop = 0; hop < 12 && frontier.length; hop++) {
      const next: string[] = [];
      for (const at of frontier) {
        const here = best.get(at)!;
        for (const other of around.get(at) ?? []) {
          const to = other.a === at ? other.b : other.a;
          const cost = here.cost + length(other);
          if (cost > direct * 1.3 || cost >= (best.get(to)?.cost ?? Infinity)) continue;
          best.set(to, { cost, via: [...here.via, other] });
          next.push(to);
        }
      }
      frontier = next;
    }
    const way = best.get(edge.b);
    if (!way || !way.via.length) continue;
    for (const other of way.via) for (const line of edge.lines) if (!other.lines.includes(line)) other.lines.push(line);
    edges.delete(`${edge.a}|${edge.b}`);
  }
}

export type Point = [number, number];

export function geoLayout(network: SchemeNetwork): Record<string, Point> {
  const lat0 = network.stations.reduce((sum, s) => sum + s.lat, 0) / Math.max(1, network.stations.length);
  const lon0 = network.stations.reduce((sum, s) => sum + s.lon, 0) / Math.max(1, network.stations.length);
  const k = Math.cos((lat0 * Math.PI) / 180);
  return Object.fromEntries(network.stations.map((s) => [s.id, [(s.lon - lon0) * 111_320 * k, -(s.lat - lat0) * 111_320] as Point]));
}

const SHAPE_TOLERANCE = 1.1;

function turns(points: Point[], tolerance: number): number[] {
  const keep: number[] = [];
  const visit = (from: number, to: number) => {
    if (to - from < 2) return;
    const [a, b] = [points[from], points[to]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let far = -1;
    let at = -1;
    for (let i = from + 1; i < to; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - points[i][1]) - (a[0] - points[i][0]) * (b[1] - a[1])) / length;
      if (d > far) {
        far = d;
        at = i;
      }
    }
    if (far > tolerance) {
      keep.push(at);
      visit(from, at);
      visit(at, to);
    }
  };
  visit(0, points.length - 1);
  return keep;
}

export function schemeLayout(network: SchemeNetwork, step = 78, rounds = 700): Record<string, Point> {
  const geo = geoLayout(network);
  const ids = network.stations.map((s) => s.id);
  const near = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of network.edges) {
    near.get(edge.a)?.push(edge.b);
    near.get(edge.b)?.push(edge.a);
  }

  const lengths = network.edges.map((edge) => Math.hypot(geo[edge.a][0] - geo[edge.b][0], geo[edge.a][1] - geo[edge.b][1])).sort((a, b) => a - b);
  const scale = step / Math.max(1, lengths[Math.floor(lengths.length / 2)] ?? 1);
  const home = (id: string): Point => [geo[id][0] * scale, geo[id][1] * scale];

  const nodes = new Set(ids.filter((id) => near.get(id)!.length !== 2));
  if (!nodes.size && ids.length) nodes.add(ids[0]);
  let branches: string[][] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    branches = [];
    const seen = new Set<string>();
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    for (const start of nodes) {
      for (const first of near.get(start)!) {
        if (seen.has(key(start, first))) continue;
        const path = [start, first];
        seen.add(key(start, first));
        while (!nodes.has(path[path.length - 1])) {
          const at = path[path.length - 1];
          const next = near.get(at)!.find((n) => n !== path[path.length - 2] && !seen.has(key(at, n)));
          if (!next) break;
          seen.add(key(at, next));
          path.push(next);
        }
        branches.push(path);
      }
    }

    const pairs = new Map<string, number>();
    let split = false;
    for (const b of branches) {
      const ends = key(b[0], b[b.length - 1]);
      pairs.set(ends, (pairs.get(ends) ?? 0) + 1);
    }
    for (const b of branches) {
      const ends = key(b[0], b[b.length - 1]);
      if ((b[0] === b[b.length - 1] || (pairs.get(ends) ?? 0) > 1) && b.length > 2) {
        nodes.add(b[Math.floor(b.length / 2)]);
        split = true;
      }

      if (attempt === 0) {
        for (const id of turns(b.map(home), SHAPE_TOLERANCE * step).map((i) => b[i])) {
          if (!nodes.has(id)) {
            nodes.add(id);
            split = true;
          }
        }
      }
    }
    if (!split) break;
  }

  const node = [...nodes];
  const pos: Record<string, Point> = Object.fromEntries(node.map((id) => [id, home(id)]));

  const minGap = step * 1.4;
  for (let round = 0; round < rounds; round++) {
    for (const b of branches) {
      const u = b[0];
      const v = b[b.length - 1];
      if (u === v) continue;
      const p = pos[u];
      const q = pos[v];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const segments = b.length - 1;

      const raw = Math.atan2(dy, dx);
      const angle = segments > 1 ? raw : Math.round(raw / (Math.PI / 4)) * (Math.PI / 4);

      const target = segments * step;
      const length = Math.hypot(dx, dy);

      const want = segments > 1 ? Math.min(Math.max(length, target * 0.72), target * 0.95) : target;
      const tx = Math.cos(angle) * want;
      const ty = Math.sin(angle) * want;
      const pull = segments > 1 ? 0.15 : 0.4;
      const cx = ((tx - dx) * pull) / 2;
      const cy = ((ty - dy) * pull) / 2;
      p[0] -= cx;
      p[1] -= cy;
      q[0] += cx;
      q[1] += cy;
    }
    if (round < rounds * 0.85) {
      for (let i = 0; i < node.length; i++) {
        for (let j = i + 1; j < node.length; j++) {
          const p = pos[node[i]];
          const q = pos[node[j]];
          const dx = q[0] - p[0];
          const dy = q[1] - p[1];
          const d = Math.hypot(dx, dy);
          if (d >= minGap || d === 0) continue;
          const push = ((minGap - d) / d) * 0.3;
          p[0] -= dx * push;
          p[1] -= dy * push;
          q[0] += dx * push;
          q[1] += dy * push;
        }
      }
    }
    if (round < rounds * 0.3) {
      for (const id of node) {
        const h = home(id);
        pos[id][0] += (h[0] - pos[id][0]) * 0.01;
        pos[id][1] += (h[1] - pos[id][1]) * 0.01;
      }
    }
  }

  const grid = step / 2;
  for (const id of node) pos[id] = [Math.round(pos[id][0] / grid) * grid, Math.round(pos[id][1] / grid) * grid];

  for (const b of branches) {
    const u = b[0];
    const v = b[b.length - 1];
    const p = pos[u];
    const q = pos[v];
    const segments = b.length - 1;
    if (segments < 2) continue;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const m = Math.min(Math.abs(dx), Math.abs(dy));
    const diag: Point = [Math.sign(dx) * m, Math.sign(dy) * m];

    const bendA: Point = [p[0] + diag[0], p[1] + diag[1]];
    const bendB: Point = [q[0] - diag[0], q[1] - diag[1]];
    const mid = b[Math.floor(b.length / 2)];
    const chord = (a: Point, c: Point, x: Point) => (c[0] - a[0]) * (x[1] - a[1]) - (c[1] - a[1]) * (x[0] - a[0]);
    const realSide = Math.sign(chord(home(u), home(v), home(mid)));
    const bend = Math.sign(chord(p, q, bendA)) === realSide ? bendA : bendB;
    const first = Math.hypot(bend[0] - p[0], bend[1] - p[1]);
    const second = Math.hypot(q[0] - bend[0], q[1] - bend[1]);
    const total = first + second || 1;

    let k = second < 1 || first < 1 ? (first < 1 ? 0 : segments) : Math.min(segments - 1, Math.max(1, Math.round((segments * first) / total)));
    if (first >= 1 && second >= 1 && segments < 2) k = segments;
    for (let i = 1; i < segments; i++) {
      const id = b[i];
      if (i <= k && k > 0) {
        const t = i / k;
        pos[id] = [p[0] + (bend[0] - p[0]) * t, p[1] + (bend[1] - p[1]) * t];
      } else {
        const t = (i - k) / (segments - k);
        pos[id] = [bend[0] + (q[0] - bend[0]) * t, bend[1] + (q[1] - bend[1]) * t];
      }
    }
  }
  return pos;
}

export interface SchemeLeg {
  line: string;
  stations: string[];
}

export interface SchemeRoute {
  legs: SchemeLeg[];
  minutes: number;

  stations: string[];
}

const TRANSFER_MINUTES = 5;

export function routeOnScheme(network: SchemeNetwork, from: string, to: string): SchemeRoute | null {
  if (from === to) return null;
  const next = new Map<string, { to: string; line: string; minutes: number }[]>();
  for (const edge of network.edges) {
    for (const line of edge.lines) {
      next.set(edge.a, [...(next.get(edge.a) ?? []), { to: edge.b, line, minutes: edge.minutes }]);
      next.set(edge.b, [...(next.get(edge.b) ?? []), { to: edge.a, line, minutes: edge.minutes }]);
    }
  }

  const key = (station: string, line: string) => `${station}|${line}`;
  const best = new Map<string, number>();
  const back = new Map<string, string>();
  const queue: { cost: number; station: string; line: string }[] = [];
  for (const step of next.get(from) ?? []) {
    const k = key(step.to, step.line);
    if ((best.get(k) ?? Infinity) > step.minutes) {
      best.set(k, step.minutes);
      back.set(k, key(from, step.line));
      queue.push({ cost: step.minutes, station: step.to, line: step.line });
    }
  }
  let found: string | null = null;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const here = key(current.station, current.line);
    if (current.cost > (best.get(here) ?? Infinity)) continue;
    if (current.station === to) {
      found = here;
      break;
    }
    for (const step of next.get(current.station) ?? []) {
      const cost = current.cost + step.minutes + (step.line === current.line ? 0 : TRANSFER_MINUTES);
      const k = key(step.to, step.line);
      if (cost < (best.get(k) ?? Infinity)) {
        best.set(k, cost);
        back.set(k, here);
        queue.push({ cost, station: step.to, line: step.line });
      }
    }
  }
  if (!found) return null;
  const states: [string, string][] = [];
  for (let k: string | undefined = found; k; k = back.get(k)) {
    const [station, line] = k.split('|');
    states.unshift([station, line]);
    if (station === from) break;
  }
  const legs: SchemeLeg[] = [];
  for (let i = 1; i < states.length; i++) {
    const [station, line] = states[i];
    const last = legs.at(-1);
    if (last && last.line === line) last.stations.push(station);
    else legs.push({ line, stations: [states[i - 1][0], station] });
  }
  return { legs, minutes: best.get(found)!, stations: states.map(([station]) => station) };
}

export function rideOf(network: SchemeNetwork, route: SchemeRoute): string {
  return route.legs
    .map((leg) => {
      const lines = leg.stations.slice(1).reduce<string[] | null>((common, id, i) => {
        const prev = leg.stations[i];
        const edge = network.edges.find((e) => (e.a === prev && e.b === id) || (e.a === id && e.b === prev));
        const here = edge?.lines ?? [leg.line];
        return common ? common.filter((line) => here.includes(line)) : here;
      }, null);
      return (lines?.length ? lines : [leg.line]).join('|');
    })
    .join(';');
}
