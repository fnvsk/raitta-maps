import type { RoadEvent } from './roadEvents';
import type { LatLon } from './types';

export const ROUTE_SERVER: string = import.meta.env.VITE_ROUTE_SERVER ?? 'https://route.raitta.fi';

const VALHALLA_LANGUAGES: Record<string, string> = { en: 'en-US', fi: 'fi-FI', sv: 'sv-SE', ru: 'ru-RU', et: 'et-EE' };
const M_PER_DEG = 111_320;

const metresBetween = (a: LonLat, b: LonLat) => Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * M_PER_DEG;

export type LonLat = [number, number];

export interface Maneuver {
  type: number;
  instruction: string;
  
  alert?: string;
  pre?: string;
  post?: string;
  streets: string[];
  
  meters: number;
  seconds: number;
  begin: number;
  end: number;
  exit?: number;
  
  stop?: number;
}

export interface CarRoute {
  meters: number;
  seconds: number;
  path: LonLat[];
  
  along: number[];
  maneuvers: Maneuver[];
  
  via: string[];
  toll: boolean;
  ferry: boolean;
}

export function decodePolyline6(text: string): LonLat[] {
  const points: LonLat[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < text.length) {
    for (let axis = 0; axis < 2; axis++) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = text.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lon += delta;
    }
    points.push([lon / 1e6, lat / 1e6]);
  }
  return points;
}

interface ValhallaManeuver {
  type: number;
  instruction: string;
  verbal_transition_alert_instruction?: string;
  verbal_pre_transition_instruction?: string;
  verbal_post_transition_instruction?: string;
  street_names?: string[];
  begin_street_names?: string[];
  length: number;
  time: number;
  begin_shape_index: number;
  end_shape_index: number;
  roundabout_exit_count?: number;
}

interface ValhallaTrip {
  summary: { length: number; time: number; has_toll?: boolean; has_ferry?: boolean };
  legs: { shape: string; maneuvers: ValhallaManeuver[] }[];
}

const VIA_ROADS = 2;

export function toCarRoute(trip: ValhallaTrip): CarRoute {
  const path: LonLat[] = [];
  const raw: (ValhallaManeuver & { stop?: number })[] = [];
  trip.legs.forEach((leg, legIndex) => {
    const offset = path.length ? path.length - 1 : 0;
    const points = decodePolyline6(leg.shape);
    path.push(...(path.length ? points.slice(1) : points));
    const last = leg.maneuvers.length - 1;
    leg.maneuvers.forEach((m, i) =>
      raw.push({
        ...m,
        begin_shape_index: m.begin_shape_index + offset,
        end_shape_index: m.end_shape_index + offset,
        stop: legIndex < trip.legs.length - 1 && i === last ? legIndex + 1 : undefined,
      }),
    );
  });
  const along = [0];
  for (let i = 1; i < path.length; i++) along.push(along[i - 1] + metresBetween(path[i - 1], path[i]));
  const maneuvers = raw.map(
    (m): Maneuver => ({
      type: m.type,
      instruction: m.instruction,
      alert: m.verbal_transition_alert_instruction,
      pre: m.verbal_pre_transition_instruction,
      post: m.verbal_post_transition_instruction,
      streets: m.street_names ?? m.begin_street_names ?? [],
      meters: m.length * 1000,
      seconds: m.time,
      begin: m.begin_shape_index,
      end: m.end_shape_index,
      exit: m.roundabout_exit_count,
      stop: m.stop,
    }),
  );
  
  const byRoad = new Map<string, number>();
  for (const m of maneuvers) for (const street of m.streets.slice(0, 1)) byRoad.set(street, (byRoad.get(street) ?? 0) + m.meters);
  const longest = [...byRoad.entries()].sort((a, b) => b[1] - a[1]).slice(0, VIA_ROADS).map(([road]) => road);
  const via = [...byRoad.keys()].filter((road) => longest.includes(road));
  return {
    meters: trip.summary.length * 1000,
    seconds: trip.summary.time,
    path,
    along,
    maneuvers,
    via,
    toll: !!trip.summary.has_toll,
    ferry: !!trip.summary.has_ferry,
  };
}

export interface CarRouteRequest {
  from: LatLon;
  to: LatLon;
  language: string;
  
  avoid?: LonLat[][];
  
  heading?: number;
  alternates?: number;
  
  via?: LatLon[];
}

export async function fetchCarRoutes(request: CarRouteRequest, signal?: AbortSignal): Promise<CarRoute[]> {
  const body = {
    locations: [
      { lat: request.from.lat, lon: request.from.lon, type: 'break', ...(request.heading !== undefined ? { heading: Math.round(request.heading), heading_tolerance: 60 } : {}) },
      ...(request.via ?? []).map((stop) => ({ lat: stop.lat, lon: stop.lon, type: 'break' })),
      { lat: request.to.lat, lon: request.to.lon, type: 'break' },
    ],
    costing: 'auto',
    
    costing_options: { auto: { service_penalty: 0, service_factor: 1, use_living_streets: 0.5 } },
    
    alternates: request.via?.length ? 0 : (request.alternates ?? 2),
    ...(request.avoid?.length ? { exclude_polygons: request.avoid } : {}),
    directions_options: { language: VALHALLA_LANGUAGES[request.language] ?? 'en-US', units: 'kilometers' },
  };
  
  const res = await fetch(`${ROUTE_SERVER}/route`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
  
  if (res.status === 400 && request.avoid?.length) return fetchCarRoutes({ ...request, avoid: undefined }, signal);
  if (!res.ok) throw new Error(`Car route failed: ${res.status}`);
  const json = (await res.json()) as { trip: ValhallaTrip; alternates?: { trip: ValhallaTrip }[] };
  return [json.trip, ...(json.alternates ?? []).map((alternate) => alternate.trip)].map(toCarRoute);
}

const WALK_GAP_M = 15;

export function walksToRoute(route: CarRoute, from: LatLon | null, to: LatLon | null): LonLat[][] {
  const walks: LonLat[][] = [];
  const first = route.path[0];
  const last = route.path[route.path.length - 1];
  if (from && metresBetween([from.lon, from.lat], first) > WALK_GAP_M) walks.push([[from.lon, from.lat], first]);
  if (to && metresBetween(last, [to.lon, to.lat]) > WALK_GAP_M) walks.push([last, [to.lon, to.lat]]);
  return walks;
}

const BOX_M = 9;
const MAX_BOXES = 400;

function box([lon, lat]: LonLat): LonLat[] {
  const dLat = BOX_M / M_PER_DEG;
  const dLon = BOX_M / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
}

export const isClosure = (event: RoadEvent) => event.r.some((r) => r.t === 'ROAD_CLOSED');

export function closurePolygons(events: RoadEvent[]): LonLat[][] {
  const boxes: LonLat[][] = [];
  for (const event of events) {
    if (!isClosure(event) || event.rough) continue;
    if (event.point && !event.lines) boxes.push(box(event.point));
    for (const line of event.lines ?? []) {
      for (let i = 1; i < line.length; i++) {
        const [a, b] = [line[i - 1], line[i]];
        boxes.push(box([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
      }
    }
  }
  return boxes.slice(0, MAX_BOXES);
}

export interface RouteProgress {
  segment: number;
  along: number;
  
  off: number;
  
  next: number;
  toNext: number;
  remaining: number;
}

const SEARCH_BACK = 5;
const SEARCH_AHEAD = 400;

export function nearestOnRoute(route: CarRoute, at: LatLon, from: number, to: number) {
  const k = Math.cos((at.lat * Math.PI) / 180);
  let best = { segment: 0, along: 0, off: Infinity };
  for (let s = from; s < to; s++) {
    const [ax, ay] = route.path[s];
    const [bx, by] = route.path[s + 1];
    const vx = (bx - ax) * k;
    const vy = by - ay;
    const length = vx * vx + vy * vy;
    const t = length ? Math.max(0, Math.min(1, ((at.lon - ax) * k * vx + (at.lat - ay) * vy) / length)) : 0;
    const off = Math.hypot((at.lon - (ax + (bx - ax) * t)) * k, at.lat - (ay + (by - ay) * t)) * M_PER_DEG;
    if (off < best.off) best = { segment: s, along: route.along[s] + (route.along[s + 1] - route.along[s]) * t, off };
  }
  return best;
}

export function progressOn(route: CarRoute, at: LatLon, lastSegment = 0): RouteProgress {
  const best = nearestOnRoute(route, at, Math.max(0, lastSegment - SEARCH_BACK), Math.min(route.path.length - 1, lastSegment + SEARCH_AHEAD));
  const next = route.maneuvers.findIndex((m) => route.along[m.begin] > best.along + 1);
  const index = next < 0 ? route.maneuvers.length - 1 : next;
  const total = route.along[route.along.length - 1];
  return {
    ...best,
    next: index,
    toNext: Math.max(0, route.along[route.maneuvers[index].begin] - best.along),
    remaining: Math.max(0, total - best.along),
  };
}

export function bearingAt(route: CarRoute, segment: number) {
  const a = route.path[segment];
  const b = route.path[Math.min(segment + 1, route.path.length - 1)];
  const y = Math.sin(((b[0] - a[0]) * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180);
  const x =
    Math.cos((a[1] * Math.PI) / 180) * Math.sin((b[1] * Math.PI) / 180) -
    Math.sin((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.cos(((b[0] - a[0]) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const ALONG_ROUTE_M = 30;

export function eventsAlong(route: CarRoute, events: RoadEvent[]): RoadEvent[] {
  const lons = route.path.map((p) => p[0]);
  const lats = route.path.map((p) => p[1]);
  const pad = 0.003;
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons) - pad, Math.max(...lons) + pad, Math.min(...lats) - pad, Math.max(...lats) + pad];
  const found: { event: RoadEvent; along: number }[] = [];
  for (const event of events) {
    const points = event.point ? [event.point] : (event.lines ?? []).flat();
    const near = points.filter(([lon, lat]) => lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat);
    if (!near.length || event.rough) continue;
    
    const step = Math.max(1, Math.floor(near.length / 6));
    for (let i = 0; i < near.length; i += step) {
      const progress = nearestOnRoute(route, { lon: near[i][0], lat: near[i][1] }, 0, route.path.length - 1);
      if (progress.off <= ALONG_ROUTE_M) {
        found.push({ event, along: progress.along });
        break;
      }
    }
  }
  return found.sort((a, b) => a.along - b.along).map(({ event }) => event);
}

export function pointAlong(route: CarRoute, along: number): LatLon {
  const { path, along: at } = route;
  if (along <= 0) return { lon: path[0][0], lat: path[0][1] };
  let lo = 0;
  let hi = at.length - 1;
  if (along >= at[hi]) return { lon: path[hi][0], lat: path[hi][1] };

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at[mid] <= along) lo = mid;
    else hi = mid;
  }
  const t = at[hi] > at[lo] ? (along - at[lo]) / (at[hi] - at[lo]) : 0;
  return { lon: path[lo][0] + (path[hi][0] - path[lo][0]) * t, lat: path[lo][1] + (path[hi][1] - path[lo][1]) * t };
}

export function bearingFromTo(a: LatLon, b: LatLon) {
  const y = Math.sin(((b.lon - a.lon) * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  const x =
    Math.cos((a.lat * Math.PI) / 180) * Math.sin((b.lat * Math.PI) / 180) -
    Math.sin((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.cos(((b.lon - a.lon) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function headingAhead(route: CarRoute, along: number, ahead = 40) {
  const here = pointAlong(route, along);
  const there = pointAlong(route, along + ahead);
  return here.lat === there.lat && here.lon === there.lon ? bearingAt(route, Math.max(0, route.path.length - 2)) : bearingFromTo(here, there);
}

export function blendBearing(from: number, to: number, t: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}
