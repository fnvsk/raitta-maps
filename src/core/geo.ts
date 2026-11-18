import type { LatLon } from './types';

export const KESKUSTORI: LatLon = { lat: 61.4978, lon: 23.761 };

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export const walkMinutes = (meters: number) => Math.ceil((meters * 1.3) / 80);

export function nearest<T extends LatLon>(items: T[], from: LatLon, limit: number, maxMeters = Infinity) {
  return items
    .map((item) => ({ item, distance: distanceM(from, item) }))
    .filter((x) => x.distance <= maxMeters)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
