import { parseDelay } from './time';
import type { Mode, OnwardCall, Vehicle } from './types';

const BASE = 'https://data.itsfactory.fi/journeys/api/1';

const TRAM_OPERATOR = '56920';

interface RawCall {
  stopPointRef?: string;
  expectedArrivalTime?: string;
  expectedDepartureTime?: string;
  order?: string;
}

interface RawJourney {
  lineRef?: string;
  vehicleRef?: string;
  operatorRef?: string;
  vehicleLocation?: { latitude?: string; longitude?: string };
  bearing?: string;
  speed?: string;
  delay?: string;
  destinationShortName?: string;
  onwardCalls?: RawCall[];
}

function parseCall(raw: RawCall): OnwardCall | null {
  const stopId = raw.stopPointRef?.split('/').pop();
  const time = Date.parse(raw.expectedDepartureTime ?? raw.expectedArrivalTime ?? '');
  if (!stopId || Number.isNaN(time)) return null;
  return { stopId, time, order: Number(raw.order ?? 0) };
}

export function parseVehicle(raw: RawJourney, modeOf: (line: string) => Mode | undefined): Vehicle | null {
  const lat = Number(raw.vehicleLocation?.latitude);
  const lon = Number(raw.vehicleLocation?.longitude);
  if (!raw.vehicleRef || !raw.lineRef || !lat || !lon) return null;
  return {
    ref: raw.vehicleRef,
    line: raw.lineRef,
    mode: modeOf(raw.lineRef) ?? (raw.operatorRef === TRAM_OPERATOR ? 'tram' : 'bus'),
    lat,
    lon,
    bearing: Number(raw.bearing) || 0,
    speedKmh: Number(raw.speed) || 0,
    delaySec: parseDelay(raw.delay),
    destinationStop: raw.destinationShortName ?? '',
    onward: (raw.onwardCalls ?? []).map(parseCall).filter((c): c is OnwardCall => c !== null),
  };
}

export interface VehicleQuery {
  lines?: string[];
  vehicle?: string;

  withCalls?: boolean;
}

export async function fetchVehicles(
  query: VehicleQuery,
  modeOf: (line: string) => Mode | undefined,
  signal?: AbortSignal,
): Promise<Vehicle[]> {
  const params = new URLSearchParams();
  if (query.lines?.length) params.set('lineRef', query.lines.join(','));
  if (query.vehicle) params.set('vehicleRef', query.vehicle);
  if (!query.withCalls) params.set('exclude-fields', 'monitoredVehicleJourney.onwardCalls,recordedAtTime');
  const res = await fetch(`${BASE}/vehicle-activity?${params}`, { signal });
  if (!res.ok) throw new Error(`vehicle-activity ${res.status}`);
  const json = (await res.json()) as { body?: { monitoredVehicleJourney: RawJourney }[] };
  return (json.body ?? [])
    .map((entry) => parseVehicle(entry.monitoredVehicleJourney, modeOf))
    .filter((v): v is Vehicle => v !== null);
}
