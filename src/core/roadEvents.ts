import { siteUrl } from '@/platform';

export type RoadEventKind = 'closure' | 'accident' | 'roadwork' | 'notice';

export interface RoadRestriction {
  t: string;
  v?: number;
  u?: string;
}

export interface RoadEvent {
  id: string;
  kind: RoadEventKind;

  road?: number;
  name?: string;
  towns: string[];

  where?: string;
  r: RoadRestriction[];

  sev: number;

  now?: boolean;
  start?: string;
  end?: string;

  rough?: boolean;

  fi?: string;
  lines?: [number, number][][];
  point?: [number, number];
}

export interface RoadEvents {
  updated: string;
  events: RoadEvent[];
}

export async function fetchRoadEvents(signal?: AbortSignal): Promise<RoadEvents> {
  const res = await fetch(siteUrl('/api/road-events'), { signal });
  if (!res.ok) throw new Error(`Road events failed: ${res.status}`);
  return (await res.json()) as RoadEvents;
}

export function signPoint(event: RoadEvent): [number, number] | null {
  if (event.point) return event.point;
  const longest = (event.lines ?? []).reduce<[number, number][]>((best, line) => (line.length > best.length ? line : best), []);
  return longest.length ? longest[Math.floor(longest.length / 2)] : null;
}

export function eventRank(event: RoadEvent) {
  const base = { closure: 40, accident: 50, roadwork: 20, notice: 10 }[event.kind];
  return base + event.sev * 3 + (event.now === false ? -15 : 0);
}

export const KNOWN_RESTRICTIONS = [
  'ROAD_CLOSED',
  'INTERMITTENT_SHORT_TERM_CLOSURE',
  'SINGLE_LANE_CLOSED',
  'MULTIPLE_LANES_CLOSED',
  'NARROW_LANES',
  'SINGLE_ALTERNATE_LINE_TRAFFIC',
  'INTERMITTENT_SHORT_TERM_STOPS',
  'INTERMITTENT_STOPS_AND_CLOSURE_EFFECTIVE',
  'TRAFFIC_LIGHTS',
  'DETOUR',
  'DETOUR_LENGTH',
  'SPEED_LIMIT',
  'SLOW_MOVING_MAINTENANCE_VEHICLE',
  'ESTIMATED_DELAY',
  'ESTIMATED_DELAY_DURING_RUSH_HOUR',
  'QUEUE',
  'FERRY_STOPPED',
  'CHANGED_ARRANGEMENTS',
];
const VALUED = new Set(['DETOUR_LENGTH', 'SPEED_LIMIT', 'ESTIMATED_DELAY', 'ESTIMATED_DELAY_DURING_RUSH_HOUR']);

export const shownRestrictions = (event: RoadEvent) =>
  event.r.filter((r) => KNOWN_RESTRICTIONS.includes(r.t) && (!VALUED.has(r.t) || r.v !== undefined));
