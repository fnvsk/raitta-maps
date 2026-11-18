import { distanceM } from './geo';
import type { LatLon, Pattern, Vehicle } from './types';

const MIN_MOVING_KMH = 3;

const headingOf = (from: LatLon, to: LatLon) => (Math.atan2(to.lon - from.lon, to.lat - from.lat) * 180) / Math.PI;

function angleBetween(a: number, b: number) {
  const difference = Math.abs(a - b) % 360;
  return difference > 180 ? 360 - difference : difference;
}

function headingError(pattern: Pattern, vehicle: Vehicle, stopAt: (id: string) => LatLon | undefined) {
  const points = pattern.stops.map(stopAt).filter((point) => !!point);
  if (points.length < 2) return Infinity;
  let closest = 0;
  points.forEach((point, i) => {
    if (distanceM(point, vehicle) < distanceM(points[closest], vehicle)) closest = i;
  });
  const start = Math.min(closest, points.length - 2);

  const scale = Math.cos((vehicle.lat * Math.PI) / 180);
  const flatten = ({ lat, lon }: LatLon) => ({ lat, lon: lon * scale });
  return angleBetween(headingOf(flatten(points[start]), flatten(points[start + 1])), vehicle.bearing);
}

export function vehiclePattern(patterns: Pattern[], vehicle: Vehicle, stopAt: (id: string) => LatLon | undefined) {
  let candidates = patterns.filter((pattern) => pattern.line === vehicle.line);
  const narrow = (matches: (pattern: Pattern) => boolean) => {
    const kept = candidates.filter(matches);
    if (kept.length) candidates = kept;
  };

  if (vehicle.destinationStop) narrow((pattern) => pattern.stops.at(-1) === vehicle.destinationStop);
  const upcoming = vehicle.onward.map((call) => call.stopId);
  if (upcoming.length) narrow((pattern) => upcoming.every((id) => pattern.stops.includes(id)));
  if (vehicle.headsign) narrow((pattern) => pattern.headsign.toLowerCase() === vehicle.headsign?.toLowerCase());
  if (vehicle.direction !== undefined) narrow((pattern) => pattern.dir === vehicle.direction);
  if (vehicle.nextStop) narrow((pattern) => pattern.stops.includes(vehicle.nextStop ?? ''));

  if (new Set(candidates.map((pattern) => pattern.dir)).size > 1 && vehicle.speedKmh >= MIN_MOVING_KMH) {
    const errors = new Map(candidates.map((pattern) => [pattern, headingError(pattern, vehicle, stopAt)]));
    const best = Math.min(...errors.values());
    narrow((pattern) => errors.get(pattern) === best);
  }
  return candidates.reduce<Pattern | undefined>((most, pattern) => (!most || pattern.trips > most.trips ? pattern : most), undefined);
}
