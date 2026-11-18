import type { Point, SchemeEdge, SchemeNetwork } from './scheme';
import type { PlaceKind, Side } from './schemeHand';

export const LINE_WIDTH = 6;

export const LANE_SPACING = 7.5;
export const STOP_R = 2.4;
export const CHANGE_RIM = 2.6;
export const FONT = 12.5;

const CHAR_W = 6.6;
const LABEL_GAP = 10;
export const BADGE_H = 19;
const MAX_END_BADGES = 3;

export const SIGN = 15;
export const PHOTO = 24;

export const PICTURE = 32;
const SIGN_GAP = 3;

export const SIGNS: Record<PlaceKind, { color: string; path: string }> = {
  airport: { color: '#2563EB', path: 'M6 .6c.6 0 1 .5 1 1.2v3.1l4.4 2.6v1.3L7 7.5v2.4l1.4 1.1v1L6 11.4 3.6 12v-1L5 9.9V7.5L.6 8.8V7.5L5 4.9V1.8C5 1.1 5.4.6 6 .6z' },
  train: { color: '#15803D', path: 'M3.2 .8h5.6A2.2 2.2 0 0 1 11 3v5.2a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3A2.2 2.2 0 0 1 3.2.8zM2.8 2.8v2.8h6.4V2.8zM3.9 7a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm4.2 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zM3.2 10.6h1.7l-1 1.4H2.2zm3.9 0h1.7l1 1.4H8.1z' },
  metro: { color: '#EA580C', path: 'M1.3 10.6V1.6h2.1L6 6.3l2.6-4.7h2.1v9H8.8V5.4L6.7 9.2H5.3L3.2 5.4v5.2z' },
  bus: { color: '#475569', path: 'M2.6.8h6.8A1.6 1.6 0 0 1 11 2.4V9a1 1 0 0 1-.9 1v1.1a.9.9 0 0 1-1.8 0V10H3.7v1.1a.9.9 0 0 1-1.8 0V10A1 1 0 0 1 1 9V2.4A1.6 1.6 0 0 1 2.6.8zM2.6 2.6v3.6h6.8V2.6zm.9 4.8a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6zm5 0a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z' },
  ferry: { color: '#0E7490', path: 'M5 .8h2v1.6h2.4v3l2 .8L10 9.6H2L.6 6.2l2-.8v-3H5zM4 3.6v1.4l2-.8 2 .8V3.6zM1 10.6c1 0 1.2.6 2.5.6s1.5-.6 2.5-.6 1.2.6 2.5.6 1.5-.6 2.5-.6v1c-1 0-1.2.6-2.5.6S7 11.6 6 11.6s-1.2.6-2.5.6S2 11.6 1 11.6z' },
  hospital: { color: '#DC2626', path: 'M4.4 1h3.2v3.4H11v3.2H7.6V11H4.4V7.6H1V4.4h3.4z' },
  university: { color: '#7C3AED', path: 'M6 1.2 11.8 4 6 6.8.2 4zM2.6 5.7 6 7.4l3.4-1.7v3.1C8.6 9.9 7.4 10.5 6 10.5S3.4 9.9 2.6 8.8zM10.5 4.6h.9v4.2h-.9z' },
  stadium: { color: '#0F766E', path: 'M6 2.2c3.1 0 5.6 1.4 5.6 3.8S9.1 9.8 6 9.8.4 8.4.4 6 2.9 2.2 6 2.2zm0 1.9C4 4.1 2.4 5 2.4 6S4 7.9 6 7.9 9.6 7 9.6 6 8 4.1 6 4.1z' },
};

export interface DrawnLine {
  line: string;
  color: string;

  paths: string[];
}

export interface DrawnStation {
  id: string;
  name: string;

  points: Point[];
  centre: Point;

  change: boolean;

  shared: boolean;

  color: string;

  end: boolean;
}

export interface DrawnSign {
  kind?: PlaceKind;
  photo?: string;

  picture?: string;
  title?: string;

  x: number;
  y: number;
  size: number;
}

export interface DrawnLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  bold: boolean;
  signs: DrawnSign[];

  origin: Point;
  side: Side;
}

export interface StationSigns {
  kinds?: PlaceKind[];
  photo?: { url: string; title: string };
  picture?: { url: string; title: string };
}

export interface DrawOptions {
  labels?: boolean;

  sides?: Record<string, Side>;
  signs?: Record<string, StationSigns>;

  measure?: (text: string, bold: boolean) => number;
}

export interface DrawnBadge {
  line: string;
  color: string;

  x: number;
  y: number;
  width: number;
}

export interface DrawnScheme {
  lines: DrawnLine[];
  stations: DrawnStation[];
  labels: DrawnLabel[];
  badges: DrawnBadge[];
  bounds: [number, number, number, number];
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const len = (a: Point) => Math.hypot(a[0], a[1]) || 1;
const unit = (a: Point): Point => [a[0] / len(a), a[1] / len(a)];

const right = (d: Point): Point => {
  const u = unit(d);
  return [-u[1], u[0]];
};
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
export const badgeWidth = (line: string) => Math.max(BADGE_H + 3, 11 + line.length * 7.4);

function lanePoint(p: Point, prev: Point | null, next: Point | null, offset: number): Point {
  if (!prev || !next) {
    const n = right(prev ? sub(p, prev) : sub(next!, p));
    return [p[0] + n[0] * offset, p[1] + n[1] * offset];
  }
  const n1 = right(sub(p, prev));
  const n2 = right(sub(next, p));
  const dot = n1[0] * n2[0] + n1[1] * n2[1];
  const k = offset / Math.max(0.35, 1 + dot);
  return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
}

function smoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [p, q, r] = [points[i - 1], points[i], points[i + 1]];
    const inLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const outLen = Math.hypot(r[0] - q[0], r[1] - q[1]);
    const radius = Math.min(16, inLen / 2, outLen / 2);
    const a: Point = [q[0] - ((q[0] - p[0]) / (inLen || 1)) * radius, q[1] - ((q[1] - p[1]) / (inLen || 1)) * radius];
    const b: Point = [q[0] + ((r[0] - q[0]) / (outLen || 1)) * radius, q[1] + ((r[1] - q[1]) / (outLen || 1)) * radius];
    d += ` L${a[0].toFixed(1)},${a[1].toFixed(1)} Q${q[0].toFixed(1)},${q[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
}

type Box = [number, number, number, number];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

function segmentHitsBox(p: Point, q: Point, box: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const edges: [number, number][] = [
    [-dx, p[0] - box[0]],
    [dx, box[2] - p[0]],
    [-dy, p[1] - box[1]],
    [dy, box[3] - p[1]],
  ];
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return false;
    } else {
      const t = qq / pp;
      if (pp < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

export function drawScheme(network: SchemeNetwork, pos: Record<string, Point>, options: DrawOptions = {}): DrawnScheme {
  const { labels = true, sides = {}, signs = {}, measure = (text: string, bold: boolean) => text.length * CHAR_W * (bold ? 1.08 : 1) } = options;

  const single = network.mode === 'metro' || network.mode === 'train' ? network.colors[network.lines[0]] : null;

  const coloursOf = (edge: SchemeEdge): string[] => {
    if (single) return [single];
    const seen: string[] = [];
    for (const line of network.lines) if (edge.lines.includes(line) && !seen.includes(network.colors[line])) seen.push(network.colors[line]);
    return seen;
  };
  const colours = new Map(network.edges.map((edge) => [edge, coloursOf(edge)]));
  const setKey = (edge: SchemeEdge) => [...colours.get(edge)!].sort().join(',');
  const around = new Map<string, SchemeEdge[]>();
  for (const edge of network.edges) {
    around.set(edge.a, [...(around.get(edge.a) ?? []), edge]);
    around.set(edge.b, [...(around.get(edge.b) ?? []), edge]);
  }
  const other = (edge: SchemeEdge, id: string) => (edge.a === id ? edge.b : edge.a);

  const through = (id: string) => {
    const list = around.get(id) ?? [];
    return list.length === 2 && setKey(list[0]) === setKey(list[1]);
  };

  const used = new Set<SchemeEdge>();
  const branches: { ids: string[]; edges: SchemeEdge[] }[] = [];
  const walk = (start: string, first: SchemeEdge) => {
    const ids = [start];
    const edges: SchemeEdge[] = [];
    let edge: SchemeEdge | undefined = first;
    let at = start;
    while (edge && !used.has(edge)) {
      used.add(edge);
      edges.push(edge);
      at = other(edge, at);
      ids.push(at);
      if (!through(at)) break;
      edge = (around.get(at) ?? []).find((next) => !used.has(next));
    }
    branches.push({ ids, edges });
  };
  for (const station of network.stations) if (!through(station.id)) for (const edge of around.get(station.id) ?? []) if (!used.has(edge)) walk(station.id, edge);
  for (const edge of network.edges) if (!used.has(edge)) walk(edge.a, edge);

  const lanePoints = new Map<string, Point[]>();
  const paths = new Map<string, string[]>();
  for (const branch of branches) {
    const ids = branch.ids;
    const cols = colours.get(branch.edges[0])!;
    const leaning = (colour: string) => {
      let score = 0;
      const u = ids[0];
      const v = ids[ids.length - 1];
      const forwardEnd = sub(pos[v], pos[ids[ids.length - 2]]);
      for (const edge of around.get(v) ?? []) {
        if (edge === branch.edges[branch.edges.length - 1] || !colours.get(edge)!.includes(colour)) continue;
        score += Math.sign(cross(forwardEnd, sub(pos[other(edge, v)], pos[v])));
      }
      const forwardStart = sub(pos[ids[1]], pos[u]);
      for (const edge of around.get(u) ?? []) {
        if (edge === branch.edges[0] || !colours.get(edge)!.includes(colour)) continue;
        score += Math.sign(cross(forwardStart, sub(pos[other(edge, u)], pos[u])));
      }
      return score;
    };
    const ordered = [...cols].sort((x, y) => leaning(x) - leaning(y) || cols.indexOf(x) - cols.indexOf(y));
    ordered.forEach((colour, lane) => {
      const offset = (lane - (ordered.length - 1) / 2) * LANE_SPACING;
      const points = ids.map((id, i) => {
        const point = lanePoint(pos[id], i > 0 ? pos[ids[i - 1]] : null, i < ids.length - 1 ? pos[ids[i + 1]] : null, offset);
        const list = lanePoints.get(id) ?? [];
        if (!list.some((q) => Math.hypot(q[0] - point[0], q[1] - point[1]) < 1.5)) list.push(point);
        lanePoints.set(id, list);
        return point;
      });
      paths.set(colour, [...(paths.get(colour) ?? []), smoothPath(points)]);
    });
  }
  const lines: DrawnLine[] = [...paths.entries()].map(([color, list]) => ({ line: color, color, paths: list }));

  const endsAt = new Set<string>();
  for (const line of network.lines) for (const run of network.runs[line] ?? []) endsAt.add(run[0]).add(run[run.length - 1]);
  const stations: DrawnStation[] = network.stations.map((station) => {
    const list = around.get(station.id) ?? [];
    const points = lanePoints.get(station.id) ?? [pos[station.id]];
    const keys = new Set(list.map(setKey));
    const change = list.length > 2 || keys.size > 1 || (station.lines.length > 1 && endsAt.has(station.id) && list.length > 1);
    return {
      id: station.id,
      name: station.name,
      points,
      centre: pos[station.id],
      change,
      shared: !change && points.length > 1,
      color: list[0] ? colours.get(list[0])![0] : (single ?? network.colors[station.lines[0]]),
      end: list.length === 1,
    };
  });

  const badges: DrawnBadge[] = [];
  const endBadges = new Map<string, string[]>();
  for (const line of network.lines) {
    const ends = new Set<string>();
    for (const run of network.runs[line] ?? []) ends.add(run[0]).add(run[run.length - 1]);
    for (const end of ends) endBadges.set(end, [...(endBadges.get(end) ?? []), line]);
  }
  for (const [end, endLines] of endBadges) {
    const list = around.get(end) ?? [];

    if (list.length !== 1 || endLines.length > MAX_END_BADGES) continue;
    const d = unit(sub(pos[end], pos[other(list[0], end)]));
    const side: Point = [-d[1], d[0]];
    const widths = endLines.map(badgeWidth);
    const total = widths.reduce((s, w) => s + w, 0) + (endLines.length - 1) * 4;

    const across = Math.abs(d[0]) > 0.5;
    let at = -total / 2;
    endLines.forEach((line, i) => {
      const w = widths[i];
      const shift = at + w / 2;
      at += w + 4;
      const reach = across ? 14 + w / 2 : 22;
      const x = pos[end][0] + d[0] * reach + (across ? 0 : side[0] * shift);
      const y = pos[end][1] + d[1] * reach + (across ? (i - (endLines.length - 1) / 2) * (BADGE_H + 4) : side[1] * shift);
      badges.push({ line, color: single ?? network.colors[line], x, y, width: w });
    });
  }

  const segments: [Point, Point][] = network.edges.map((edge) => [pos[edge.a], pos[edge.b]]);
  const badgeBox = (b: DrawnBadge): Box => [b.x - b.width / 2 - 2, b.y - BADGE_H / 2 - 2, b.x + b.width / 2 + 2, b.y + BADGE_H / 2 + 2];
  const marks: Box[] = stations.flatMap((s) => s.points.map((p) => [p[0] - 7, p[1] - 7, p[0] + 7, p[1] + 7] as Box));

  const tagsAt = new Map<string, string[]>();
  for (const [end, endLines] of endBadges) if ((around.get(end)?.length ?? 0) > 1 && endLines.length <= MAX_END_BADGES) tagsAt.set(end, [...endLines]);
  for (const line of network.lines) {
    if (badges.some((b) => b.line === line) || [...tagsAt.values()].some((list) => list.includes(line))) continue;
    const run = [...(network.runs[line] ?? [])].sort((a, b) => b.length - a.length)[0];
    if (!run?.length) continue;
    const far = run[Math.floor(run.length / 2)];
    tagsAt.set(far, [...(tagsAt.get(far) ?? []), line]);
  }
  for (const [at, tagLines] of tagsAt) {
    const widths = tagLines.map(badgeWidth);
    const total = widths.reduce((sum, w) => sum + w, 0) + (tagLines.length - 1) * 4;
    const [x, y] = pos[at];
    const r = 13 + total / 2;

    const spots: { side: Side; c: Point }[] = [
      { side: 'S', c: [x, y + 24] },
      { side: 'N', c: [x, y - 24] },
      { side: 'E', c: [x + r, y] },
      { side: 'W', c: [x - r, y] },
      { side: 'SE', c: [x + r - 4, y + 20] },
      { side: 'SW', c: [x - r + 4, y + 20] },
      { side: 'NE', c: [x + r - 4, y - 20] },
      { side: 'NW', c: [x - r + 4, y - 20] },
    ];
    let best = spots[0];
    let bestScore = Infinity;
    spots.forEach((spot, i) => {
      const box: Box = [spot.c[0] - total / 2 - 2, spot.c[1] - BADGE_H / 2 - 2, spot.c[0] + total / 2 + 2, spot.c[1] + BADGE_H / 2 + 2];
      let score = i * 0.1 + (sides[at] === spot.side ? 20 : 0);
      for (const [p, q] of segments) if (segmentHitsBox(p, q, box)) score += 12;
      for (const mark of marks) if (overlaps(box, mark)) score += 30;
      for (const b of badges) if (overlaps(box, badgeBox(b))) score += 100;
      if (score < bestScore) {
        bestScore = score;
        best = spot;
      }
    });
    let left = best.c[0] - total / 2;
    tagLines.forEach((line, i) => {
      badges.push({ line, color: single ?? network.colors[line], x: left + widths[i] / 2, y: best.c[1], width: widths[i] });
      left += widths[i] + 4;
    });
  }

  const placed: Box[] = badges.map(badgeBox);
  const drawnLabels: DrawnLabel[] = [];
  if (labels) {
    const rank = (s: DrawnStation) => (s.change ? 2 : s.end ? 1 : 0);
    const order = [...stations].sort((a, b) => rank(b) - rank(a));
    for (const station of order) {
      const xs = station.points.map((p) => p[0]);
      const ys = station.points.map((p) => p[1]);
      const pad = station.change ? 8 : 5;
      const box: Box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
      const bold = station.change || station.end;

      const own = signs[station.id];
      const items: { kind?: PlaceKind; photo?: string; picture?: string; title?: string; size: number }[] = [
        ...(own?.kinds ?? []).map((kind) => ({ kind, size: SIGN })),
        ...(own?.photo ? [{ photo: own.photo.url, title: own.photo.title, size: PHOTO }] : []),
        ...(own?.picture ? [{ picture: own.picture.url, title: own.picture.title, size: PICTURE }] : []),
      ];
      const textW = measure(station.name, bold);
      const row = items.reduce((sum, item) => sum + item.size, 0) + Math.max(0, items.length - 1) * SIGN_GAP;
      const gap = items.length ? 6 : 0;
      const width = textW + gap + row;
      const height = Math.max(FONT + 2, ...items.map((item) => item.size));
      const midY = (box[1] + box[3]) / 2;
      const midX = (box[0] + box[2]) / 2;
      const G = LABEL_GAP;

      const places: { side: Side; box: Box; origin: Point; weight: number }[] = [
        { side: 'E', box: [box[2] + G, midY - height / 2, box[2] + G + width, midY + height / 2], origin: [box[2] + G, midY], weight: 0 },
        { side: 'W', box: [box[0] - G - width, midY - height / 2, box[0] - G, midY + height / 2], origin: [box[0] - G, midY], weight: 0.2 },
        { side: 'N', box: [midX - width / 2, box[1] - G - height, midX + width / 2, box[1] - G], origin: [midX, box[1] - G], weight: 0.4 },
        { side: 'S', box: [midX - width / 2, box[3] + G, midX + width / 2, box[3] + G + height], origin: [midX, box[3] + G], weight: 0.5 },
        { side: 'NE', box: [box[2] + 4, box[1] - height - 2, box[2] + 4 + width, box[1] - 2], origin: [box[2] + 4, box[1] - 2], weight: 0.6 },
        { side: 'SE', box: [box[2] + 4, box[3] + 2, box[2] + 4 + width, box[3] + 2 + height], origin: [box[2] + 4, box[3] + 2], weight: 0.7 },
        { side: 'NW', box: [box[0] - 4 - width, box[1] - height - 2, box[0] - 4, box[1] - 2], origin: [box[0] - 4, box[1] - 2], weight: 0.8 },
        { side: 'SW', box: [box[0] - 4 - width, box[3] + 2, box[0] - 4, box[3] + 2 + height], origin: [box[0] - 4, box[3] + 2], weight: 0.9 },
      ];

      const forced = sides[station.id];
      const options = places.map((place) => ({ ...place, weight: place.side === forced ? -60 : place.weight }));
      let best: (typeof options)[number] | null = null;
      let bestScore = Infinity;
      for (const option of options) {
        let score = option.weight;
        for (const other of placed) if (overlaps(option.box, other)) score += 100;
        for (const mark of marks) if (overlaps(option.box, mark)) score += 30;
        for (const [p, q] of segments) if (segmentHitsBox(p, q, option.box)) score += 12;
        if (score < bestScore) {
          bestScore = score;
          best = option;
        }
      }

      if (!best || bestScore >= 100) continue;
      placed.push(best.box);

      const [bx0, by0, bx1, by1] = best.box;
      const cy = (by0 + by1) / 2;
      const left = best.side === 'W' || best.side === 'NW' || best.side === 'SW';
      const textX = left ? bx1 : best.side === 'N' || best.side === 'S' ? bx0 + textW / 2 : bx0;
      let x = left ? bx0 : bx0 + textW + gap;
      const drawnSigns: DrawnSign[] = items.map((item) => {
        const sign = { ...item, x: x + item.size / 2, y: cy };
        x += item.size + SIGN_GAP;
        return sign;
      });
      drawnLabels.push({
        id: station.id,
        text: station.name,
        bold,
        x: textX,
        y: cy + 4.4,
        anchor: left ? 'end' : best.side === 'N' || best.side === 'S' ? 'middle' : 'start',
        signs: drawnSigns,
        origin: best.origin,
        side: best.side,
      });
    }
  }

  const all = [...Object.values(pos)];
  const bounds: [number, number, number, number] = [
    Math.min(...all.map((p) => p[0]), ...placed.map((b) => b[0])),
    Math.min(...all.map((p) => p[1]), ...placed.map((b) => b[1])),
    Math.max(...all.map((p) => p[0]), ...placed.map((b) => b[2])),
    Math.max(...all.map((p) => p[1]), ...placed.map((b) => b[3])),
  ];
  return { lines, stations, labels: drawnLabels, badges, bounds };
}

export function stationSpan(station: DrawnStation): [Point, Point] {
  let best: [Point, Point] = [station.points[0], station.points[0]];
  let far = -1;
  for (const p of station.points) {
    for (const q of station.points) {
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d > far) {
        far = d;
        best = [p, q];
      }
    }
  }
  return best;
}

export function schemeSvg(drawn: DrawnScheme, background = '#F6F7F9', ink = '#151A23'): string {
  const [x0, y0, x1, y1] = drawn.bounds;
  const pad = 36;
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  const font = 'Inter, "Segoe UI", system-ui, sans-serif';
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}">`, `<rect x="${x0 - pad}" y="${y0 - pad}" width="${w}" height="${h}" fill="${background}"/>`];
  for (const line of drawn.lines) for (const d of line.paths) parts.push(`<path d="${d}" fill="none" stroke="${line.color}" stroke-width="${LINE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const s of drawn.stations) {
    const [a, b] = stationSpan(s);
    if (s.change) {
      parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${ink}" stroke-width="${LINE_WIDTH + CHANGE_RIM * 2 + 3}" stroke-linecap="round"/>`);
      parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#FFFFFF" stroke-width="${LINE_WIDTH + 3}" stroke-linecap="round"/>`);
    } else if (s.shared) parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#FFFFFF" stroke-width="${STOP_R * 2}" stroke-linecap="round"/>`);
    else parts.push(`<circle cx="${a[0]}" cy="${a[1]}" r="${STOP_R}" fill="#FFFFFF"/>`);
  }
  for (const b of drawn.badges)
    parts.push(
      `<rect x="${b.x - b.width / 2}" y="${b.y - BADGE_H / 2}" width="${b.width}" height="${BADGE_H}" rx="6" fill="${b.color}"/><text x="${b.x}" y="${b.y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family='${font}'>${b.line}</text>`,
    );
  for (const l of drawn.labels) {
    parts.push(
      `<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" font-size="${FONT}" font-weight="${l.bold ? 700 : 500}" fill="${ink}" stroke="${background}" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round" font-family='${font}'>${l.text.replace(/&/g, '&amp;')}</text>`,
    );
    l.signs.forEach((sign, i) => {
      if (sign.kind) {
        const k = SIGNS[sign.kind];
        const s0 = sign.size;
        parts.push(`<rect x="${sign.x - s0 / 2}" y="${sign.y - s0 / 2}" width="${s0}" height="${s0}" rx="4" fill="${k.color}"/>`);
        parts.push(`<path d="${k.path}" fill="#fff" fill-rule="evenodd" transform="translate(${sign.x - 4.8} ${sign.y - 4.8}) scale(0.8)"/>`);
      } else if (sign.photo) {
        const id = `ph-${l.id}-${i}`.replace(/[^\w-]/g, '');
        const r = sign.size / 2;
        parts.push(`<clipPath id="${id}"><circle cx="${sign.x}" cy="${sign.y}" r="${r}"/></clipPath>`);
        parts.push(`<circle cx="${sign.x}" cy="${sign.y}" r="${r + 2}" fill="#fff" stroke="rgba(0,0,0,.12)"/>`);
        parts.push(`<image href="${sign.photo}" x="${sign.x - r}" y="${sign.y - r}" width="${sign.size}" height="${sign.size}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`);
      }
    });
  }
  return `${parts.join('')}</svg>`;
}

export function smoothOutline(points: Point[], closed: boolean): string {
  const n = points.length;
  if (n < 3) return `M${points.map((p) => p.join(' ')).join('L')}${closed ? 'Z' : ''}`;
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${at(0)[0]} ${at(0)[1]}`;

  const far = (p: Point) => Math.abs(p[0]) > 1500 || Math.abs(p[1]) > 1500;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    if (far(p1) || far(p2)) {
      d += `L${p2[0]} ${p2[1]}`;
      continue;
    }
    const q0 = far(p0) ? p1 : p0;
    const q3 = far(p3) ? p2 : p3;
    const c1 = [p1[0] + (p2[0] - q0[0]) / 6, p1[1] + (p2[1] - q0[1]) / 6];
    const c2 = [p2[0] - (q3[0] - p1[0]) / 6, p2[1] - (q3[1] - p1[1]) / 6];
    d += `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return closed ? `${d}Z` : d;
}
