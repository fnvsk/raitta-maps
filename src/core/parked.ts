import { distanceM } from './geo';
import type { Vehicle } from './types';

const PARKED_MS = 5 * 60 * 1000;

const MOVED_M = 40;

const lastMoved = new Map<string, { lat: number; lon: number; at: number }>();

export function movingOnly(vehicles: Vehicle[], now = Date.now()): Vehicle[] {
  const seen = new Set<string>();
  const moving = vehicles.filter((vehicle) => {
    seen.add(vehicle.ref);
    const last = lastMoved.get(vehicle.ref);
    if (!last || distanceM(last, vehicle) > MOVED_M) {
      lastMoved.set(vehicle.ref, { lat: vehicle.lat, lon: vehicle.lon, at: now });
      return true;
    }
    return now - last.at < PARKED_MS;
  });

  for (const ref of lastMoved.keys()) if (!seen.has(ref)) lastMoved.delete(ref);
  return moving;
}
