import { distanceM } from './geo';
import type { Journey } from './raptor';
import type { LatLon, Mode, Pattern, Stop } from './types';

export type PathPoint = [number, number];

export interface JourneyRide {
  line: string;
  path: PathPoint[];
  
  mode?: Mode;
}

export interface JourneyMarker extends LatLon {
  id: string;
  name: string;
  line: string;
  
  pass?: boolean;
}

export interface JourneyShape {
  rides: JourneyRide[];
  walks: PathPoint[][];
  markers: JourneyMarker[];
  lines: string[];
  
  directions?: Record<string, number>;
}

export interface WalkRequest {
  from: LatLon;
  to: LatLon;
}

const point = ({ lon, lat }: LatLon): PathPoint => [lon, lat];

interface ShapePosition {
  segment: number;
  
  along: number;
  point: PathPoint;
  distance: number;
}

const METRES_PER_DEG_LAT = 110_540;

const ON_SHAPE_M = 80;

const LEFT_STOP_M = 150;

const MIN_SHAPE_RATIO = 0.8;
const MAX_SHAPE_RATIO = 2.5;
const SHAPE_SLACK_M = 800;

function locate(shape: PathPoint[], target: LatLon, from: ShapePosition): ShapePosition {
  const metresPerDegLon = METRES_PER_DEG_LAT * Math.cos((target.lat * Math.PI) / 180);
  const x = (point: PathPoint) => (point[0] - target.lon) * metresPerDegLon;
  const y = (point: PathPoint) => (point[1] - target.lat) * METRES_PER_DEG_LAT;
  let best = from;
  let bestDistance = Infinity;

  for (let segment = from.segment; segment < shape.length - 1; segment++) {
    const [a, b] = [shape[segment], shape[segment + 1]];
    const [ax, ay, dx, dy] = [x(a), y(a), x(b) - x(a), y(b) - y(a)];
    const length = dx * dx + dy * dy;
    const minimum = segment === from.segment ? from.along : 0;
    const along = length ? Math.max(minimum, Math.min(1, -(ax * dx + ay * dy) / length)) : minimum;
    const distance = Math.hypot(ax + dx * along, ay + dy * along);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { segment, along, distance, point: [a[0] + (b[0] - a[0]) * along, a[1] + (b[1] - a[1]) * along] };
    } else if (bestDistance < ON_SHAPE_M && distance > bestDistance + LEFT_STOP_M) {
      break;
    }
  }
  return best;
}

export function sliceShape(shape: PathPoint[], stops: LatLon[], boardIndex: number): PathPoint[] {
  let position: ShapePosition = { segment: 0, along: 0, point: shape[0], distance: 0 };
  let start = position;
  stops.forEach((stop, i) => {
    position = locate(shape, stop, position);
    if (i === boardIndex) start = position;
  });
  return [
    point(stops[boardIndex]),
    start.point,
    ...shape.slice(start.segment + 1, position.segment + 1),
    position.point,
    point(stops[stops.length - 1]),
  ];
}

const pathLength = (path: LatLon[]) => path.slice(1).reduce((total, place, i) => total + distanceM(path[i], place), 0);

export function ridePath(shape: PathPoint[] | undefined, stops: LatLon[], boardIndex: number): PathPoint[] {
  const ridden = stops.slice(boardIndex).map(point);
  if (!shape || shape.length < 2) return ridden;
  const slice = sliceShape(shape, stops, boardIndex);
  const direct = pathLength(stops.slice(boardIndex));
  const drawn = pathLength(slice.map(([lon, lat]) => ({ lat, lon })));
  return drawn >= direct * MIN_SHAPE_RATIO && drawn <= direct * MAX_SHAPE_RATIO + SHAPE_SLACK_M ? slice : ridden;
}

function patternFor(patterns: Pattern[], line: string, headsign: string, from: string, to: string) {
  const fits = (pattern: Pattern) => {
    const start = pattern.stops.indexOf(from);
    return start >= 0 && pattern.stops.indexOf(to, start + 1) > start;
  };
  const ofLine = patterns.filter((p) => p.line === line && fits(p));
  return ofLine.find((p) => p.headsign === headsign) ?? ofLine[0];
}

export function journeyWalks(journey: Journey, stops: Stop[], origin: LatLon, destination: LatLon): WalkRequest[] {
  const walks: WalkRequest[] = [];
  const first = journey.legs[0];
  const last = journey.legs[journey.legs.length - 1];
  if (journey.walkStartS > 0) walks.push({ from: origin, to: stops[first.from] });
  journey.legs.forEach((leg, i) => {
    if (i > 0 && leg.walkBefore > 0) walks.push({ from: stops[journey.legs[i - 1].to], to: stops[leg.from] });
  });
  if (journey.walkEndS > 0) walks.push({ from: stops[last.to], to: destination });
  return walks;
}

export function buildJourneyShape(
  journey: Journey,
  stops: Stop[],
  patterns: Pattern[],
  shapeOf: (line: string, shapeId: string) => PathPoint[] | undefined,
  walks: PathPoint[][],
): JourneyShape {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const directions: Record<string, number> = {};
  const passed: JourneyMarker[] = [];
  const rides = journey.legs.map((leg): JourneyRide => {
    const from = stops[leg.from];
    const to = stops[leg.to];
    const pattern = patternFor(patterns, leg.line, leg.headsign, from.id, to.id);
    if (!pattern) return { line: leg.line, path: [point(from), point(to)] };
    directions[leg.line] = pattern.dir;
    const start = pattern.stops.indexOf(from.id);
    const end = pattern.stops.indexOf(to.id, start + 1);
    const tripStops = pattern.stops.slice(0, end + 1).flatMap((id) => byId.get(id) ?? []);
    if (tripStops.length !== end + 1) return { line: leg.line, path: [point(from), point(to)] };
    
    for (const stop of tripStops.slice(start + 1, end)) passed.push({ id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon, line: leg.line, pass: true });
    return { line: leg.line, path: ridePath(shapeOf(leg.line, pattern.shape), tripStops, start) };
  });

  const markers = [
    ...passed,
    ...journey.legs.flatMap((leg): JourneyMarker[] =>
      [stops[leg.from], stops[leg.to]].map((stop) => ({ id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon, line: leg.line })),
    ),
  ];

  return { rides, walks, markers, lines: [...new Set(journey.legs.map((leg) => leg.line))], directions };
}
