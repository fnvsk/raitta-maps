import { ROUTE_SERVER, type CarRoute, type LonLat } from './driving';

const PIECE_M = 150_000;

export interface SpeedLimits {
  from: number[];
  limit: number[];
}

export function encodePolyline6(points: LonLat[]): string {
  let out = '';
  let lastLat = 0;
  let lastLon = 0;
  const put = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lon, lat] of points) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lon * 1e6);
    put(la - lastLat);
    put(lo - lastLon);
    lastLat = la;
    lastLon = lo;
  }
  return out;
}

interface TracedEdge {
  speed_limit?: number | string;
  begin_shape_index?: number;
  end_shape_index?: number;
}

async function tracePiece(route: CarRoute, first: number, last: number, signal?: AbortSignal) {
  const body = {
    encoded_polyline: encodePolyline6(route.path.slice(first, last + 1)),
    shape_match: 'edge_walk',
    costing: 'auto',
    filters: { attributes: ['edge.speed_limit', 'edge.begin_shape_index', 'edge.end_shape_index'], action: 'include' },
  };
  const res = await fetch(`${ROUTE_SERVER}/trace_attributes`, { method: 'POST', body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(`trace_attributes ${res.status}`);
  return ((await res.json()).edges ?? []) as TracedEdge[];
}

export async function fetchSpeedLimits(route: CarRoute, signal?: AbortSignal): Promise<SpeedLimits> {
  const limits: SpeedLimits = { from: [], limit: [] };
  let first = 0;
  while (first < route.path.length - 1) {
    let last = first + 1;
    while (last < route.path.length - 1 && route.along[last + 1] - route.along[first] < PIECE_M) last++;
    try {
      for (const edge of await tracePiece(route, first, last, signal)) {
        const begin = first + (edge.begin_shape_index ?? 0);

        const limit = typeof edge.speed_limit === 'number' ? edge.speed_limit : 0;
        const at = route.along[Math.min(begin, route.along.length - 1)];
        if (limits.limit.at(-1) === limit) continue;
        limits.from.push(at);
        limits.limit.push(limit);
      }
    } catch (error) {
      if (signal?.aborted) throw error;

      limits.from.push(route.along[first]);
      limits.limit.push(0);
    }
    first = last;
  }
  return limits;
}

export function limitAt(limits: SpeedLimits, along: number): number {
  let low = 0;
  let high = limits.from.length - 1;
  if (high < 0 || along < limits.from[0]) return 0;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (limits.from[mid] <= along) low = mid;
    else high = mid - 1;
  }
  return limits.limit[low];
}

export const isSpeeding = (kmh: number, limit: number) => limit > 0 && kmh > limit + Math.max(3, limit * 0.05);
