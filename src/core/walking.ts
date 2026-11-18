import { decodePolyline6, ROUTE_SERVER } from './driving';
import type { LatLon } from './types';

const FOOT_ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

export interface WalkingRoute {
  meters: number;
  seconds: number;
  path: [number, number][];
}

async function fromValhalla(from: LatLon, to: LatLon, signal?: AbortSignal): Promise<WalkingRoute> {
  const res = await fetch(`${ROUTE_SERVER}/route`, {
    method: 'POST',
    body: JSON.stringify({
      locations: [
        { lat: from.lat, lon: from.lon },
        { lat: to.lat, lon: to.lon },
      ],
      costing: 'pedestrian',
      directions_type: 'none',
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Walking route failed: ${res.status}`);
  const { trip } = (await res.json()) as { trip: { summary: { length: number; time: number }; legs: { shape: string }[] } };
  return { meters: trip.summary.length * 1000, seconds: trip.summary.time, path: trip.legs.flatMap((leg) => decodePolyline6(leg.shape)) };
}

async function fromFossgis(from: LatLon, to: LatLon, signal?: AbortSignal): Promise<WalkingRoute> {
  const points = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const res = await fetch(`${FOOT_ROUTER}/${points}?overview=full&geometries=geojson&steps=false`, { signal });
  if (!res.ok) throw new Error(`Walking route failed: ${res.status}`);
  const json = (await res.json()) as {
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const route = json.routes?.[0];
  if (json.code !== 'Ok' || !route) throw new Error(`Walking route failed: ${json.code}`);
  return { meters: route.distance, seconds: route.duration, path: route.geometry.coordinates };
}

export async function fetchWalkDistances(from: LatLon, to: LatLon[], signal?: AbortSignal): Promise<(number | null)[]> {
  if (!to.length) return [];
  try {
    const res = await fetch(`${ROUTE_SERVER}/sources_to_targets`, {
      method: 'POST',
      body: JSON.stringify({ sources: [{ lat: from.lat, lon: from.lon }], targets: to.map(({ lat, lon }) => ({ lat, lon })), costing: 'pedestrian' }),
      signal,
    });
    if (!res.ok) throw new Error(`Walk distances failed: ${res.status}`);
    const { sources_to_targets: rows } = (await res.json()) as { sources_to_targets: { distance: number | null }[][] };
    return rows[0].map((cell) => (cell.distance == null ? null : cell.distance * 1000));
  } catch (error) {
    if (signal?.aborted) throw error;
    const points = [from, ...to].map(({ lat, lon }) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
    const res = await fetch(`${FOOT_ROUTER.replace('/route/', '/table/')}/${points}?sources=0&annotations=distance`, { signal });
    if (!res.ok) throw new Error(`Walk distances failed: ${res.status}`);
    const json = (await res.json()) as { code: string; distances?: (number | null)[][] };
    if (json.code !== 'Ok' || !json.distances) throw new Error(`Walk distances failed: ${json.code}`);
    return json.distances[0].slice(1);
  }
}

export async function fetchWalkingRoute(from: LatLon, to: LatLon, signal?: AbortSignal): Promise<WalkingRoute> {
  try {
    return await fromValhalla(from, to, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    return fromFossgis(from, to, signal);
  }
}
