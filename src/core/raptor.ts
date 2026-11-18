import { distanceM } from './geo';
import { runsOn } from './timetable';
import { serviceDay } from './time';
import type { LatLon, Services, Stop } from './types';

const MAX_RIDES = 4;
const WALK_SPEED_MPS = 1.25;

const WALK_DETOUR = 1.3;
const ACCESS_RADIUS_M = 900;
const MIN_ACCESS_STOPS = 4;

const TRANSFER_RADIUS_M = 350;
const CHANGE_MARGIN_S = 90;
const WALK_ONLY_LIMIT_S = 110 * 60;
const GRID_DEG = 0.01;
const INFINITE = 0x7fffffff;

const DIVERSITY_RUNS = 10;
const CHANGE_PENALTY_S = 300;

const WALK_PENALTY = 1;
const MAX_EXTRA_S = 60 * 60;

const MAX_ACCESS_FALLBACK_M = 2_500;
const MAX_WAIT_S = 10 * 3600;
const MAX_JOURNEY_S = 5 * 3600;

const WALK_INSTEAD_S = 8 * 60;
const SLOWER_THAN_WALK_S = 10 * 60;
const LATER_WINDOW_S = 2 * 3600;

const DIRECT_RADIUS_M = 1_200;
const DIRECT_EXTRA = 4;

const ALL_EXTRA_S = 60 * 60;
const ALL_LIMIT = 40;

const NEEDLESS_CHANGE_WALK_S = 5 * 60;

export interface RawRoute {
  l: string;

  h: string;

  s: number[];

  o: number[];

  t: { v: string[]; d: number[] }[];
}

interface Route {
  line: string;
  headsign: string;
  stops: Int32Array;
  offsets: Int32Array;
  raw: RawRoute;
}

export interface Network {
  stops: Stop[];
  routes: Route[];

  stopRoutes: Int32Array[];

  transfers: Int32Array[];
}

export type WalkingPace = 'slow' | 'normal' | 'fast';
export type RoutePreference = 'best' | 'fewerChanges' | 'lessWalking';

export const PACE_FACTORS: Record<WalkingPace, number> = { slow: 1.35, normal: 1, fast: 0.8 };

const PREFERENCES: Record<RoutePreference, { change: number; walk: number }> = {
  best: { change: CHANGE_PENALTY_S, walk: WALK_PENALTY },
  fewerChanges: { change: CHANGE_PENALTY_S * 3, walk: WALK_PENALTY },
  lessWalking: { change: CHANGE_PENALTY_S, walk: WALK_PENALTY * 3 },
};

export const walkSeconds = (meters: number, pace = 1) => Math.ceil(((meters * WALK_DETOUR) / WALK_SPEED_MPS) * pace);

export type StreetWalks = Map<number, number>;

export interface TripWalks {
  from?: StreetWalks;
  to?: StreetWalks;
}

const STREET_STRETCH = 1.6;
const STREET_STOPS_MAX = 60;

export function stopsAround(stops: Stop[], place: LatLon): number[] {
  const within = stops
    .map((stop, i): [number, number] => [i, distanceM(place, stop)])
    .sort((a, b) => a[1] - b[1]);
  const close = within.filter(([, meters]) => meters <= DIRECT_RADIUS_M);
  const usable = close.length ? close : within.slice(0, MIN_ACCESS_STOPS).filter(([, meters]) => meters <= MAX_ACCESS_FALLBACK_M);
  return usable.slice(0, STREET_STOPS_MAX).map(([i]) => i);
}

export function buildNetwork(stops: Stop[], rawRoutes: RawRoute[], pace = 1): Network {
  const routes: Route[] = rawRoutes.map((raw) => {
    const offsets = new Int32Array(raw.o.length);
    let total = 0;
    raw.o.forEach((delta, i) => {
      total += delta;
      offsets[i] = total;
    });
    return { line: raw.l, headsign: raw.h, stops: Int32Array.from(raw.s), offsets, raw };
  });

  const byStop: number[][] = stops.map(() => []);
  routes.forEach((route, r) => route.stops.forEach((stop, position) => byStop[stop]?.push(r, position)));

  const cells = new Map<string, number[]>();
  const cellOf = (lat: number, lon: number) => `${Math.floor(lat / GRID_DEG)}:${Math.floor(lon / (GRID_DEG * 2))}`;
  stops.forEach((stop, i) => {
    const key = cellOf(stop.lat, stop.lon);
    const cell = cells.get(key);
    if (cell) cell.push(i);
    else cells.set(key, [i]);
  });

  const transfers = stops.map((stop, i) => {
    const found: number[] = [];
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) {
        const cell = cells.get(cellOf(stop.lat + dLat * GRID_DEG, stop.lon + dLon * GRID_DEG * 2));
        for (const other of cell ?? []) {
          if (other === i) continue;
          const meters = distanceM(stop, stops[other]);
          if (meters <= TRANSFER_RADIUS_M) found.push(other, walkSeconds(meters, pace));
        }
      }
    }
    return Int32Array.from(found);
  });

  return { stops, routes, stopRoutes: byStop.map((list) => Int32Array.from(list)), transfers };
}

export function activeStarts(network: Network, services: Services, now: number): Int32Array[] {
  const days = [-1, 0, 1].map((offset) => ({ offset, day: serviceDay(now, offset), running: new Map<string, boolean>() }));
  return network.routes.map(({ raw }) => {
    const starts: number[] = [];
    for (const { offset, day, running } of days) {
      const runs = (id: string) => {
        let known = running.get(id);
        if (known === undefined) {
          known = runsOn(services[id], day);
          running.set(id, known);
        }
        return known;
      };
      for (const group of raw.t) {
        if (!group.v.some(runs)) continue;
        let seconds = offset * 86400;
        for (const delta of group.d) {
          seconds += delta;
          starts.push(seconds);
        }
      }
    }
    return Int32Array.from(starts.sort((a, b) => a - b));
  });
}

export interface JourneyLeg {
  line: string;
  headsign: string;
  from: number;
  to: number;
  departure: number;
  arrival: number;

  walkBefore: number;

  routeIndex?: number;
  boardOffset?: number;

  boardIndex?: number;
  alightIndex?: number;
}

export interface Journey {
  legs: JourneyLeg[];
  walkStartS: number;
  walkEndS: number;
  leaveAt: number;
  arriveAt: number;
}

type Parent =
  | { kind: 'ride'; route: number; board: number; alight: number; start: number }
  | { kind: 'walk'; from: number; seconds: number };

function accessStops(stops: Stop[], place: LatLon, pace: number, radius = ACCESS_RADIUS_M, streets?: StreetWalks) {
  const within: [number, number][] = stops
    .map((stop, i): [number, number] => [i, distanceM(place, stop)])
    .sort((a, b) => a[1] - b[1]);

  const street = (i: number) => streets?.get(i);
  const near = ([i, meters]: [number, number], limit: number) => meters <= limit && (street(i) ?? 0) <= limit * STREET_STRETCH;
  const close = within.filter((entry) => near(entry, radius));

  const usable = close.length ? close : within.slice(0, MIN_ACCESS_STOPS).filter((entry) => near(entry, MAX_ACCESS_FALLBACK_M));
  const seconds = (i: number, meters: number) => {
    const known = street(i);
    return known === undefined ? walkSeconds(meters, pace) : Math.ceil((known / WALK_SPEED_MPS) * pace);
  };
  return new Map(usable.map(([i, meters]) => [i, seconds(i, meters)]));
}

function lowerBound(starts: Int32Array, target: number) {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (starts[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function search(
  network: Network,
  starts: Int32Array[],
  access: Map<number, number>,
  egress: Map<number, number>,
  now: number,
  banned: Set<string>,
): Journey[] {
  const count = network.stops.length;
  const rounds: Int32Array[] = [new Int32Array(count).fill(INFINITE)];
  const parents: Map<number, Parent>[] = [new Map()];
  const best = new Int32Array(count).fill(INFINITE);
  let marked = new Set<number>();

  for (const [stop, walk] of access) {
    rounds[0][stop] = now + walk;
    best[stop] = now + walk;
    marked.add(stop);
  }

  for (let k = 1; k <= MAX_RIDES && marked.size; k++) {
    const previous = rounds[k - 1];
    const current = previous.slice();
    const parent = new Map<number, Parent>();
    rounds.push(current);
    parents.push(parent);

    const queue = new Map<number, number>();
    for (const stop of marked) {
      const list = network.stopRoutes[stop];
      for (let i = 0; i < list.length; i += 2) {
        const known = queue.get(list[i]);
        if (known === undefined || list[i + 1] < known) queue.set(list[i], list[i + 1]);
      }
    }

    const improved = new Set<number>();
    for (const [r, from] of queue) {
      const route = network.routes[r];
      if (banned.has(route.line)) continue;
      const times = starts[r];
      if (!times.length) continue;
      let trip = -1;
      let board = -1;
      let boardReady = INFINITE;
      for (let i = from; i < route.stops.length; i++) {
        const stop = route.stops[i];
        if (trip >= 0) {
          const arrival = trip + route.offsets[i];
          if (arrival < best[stop]) {
            current[stop] = arrival;
            best[stop] = arrival;
            parent.set(stop, { kind: 'ride', route: r, board, alight: i, start: trip });
            improved.add(stop);
          }
        }
        const ready = previous[stop];
        if (ready === INFINITE || i === route.stops.length - 1) continue;

        const earliest = ready + (k > 1 ? CHANGE_MARGIN_S : 0) - route.offsets[i];
        const index = lowerBound(times, earliest);
        if (index >= times.length) continue;
        if (trip < 0 || times[index] < trip) {
          trip = times[index];
          board = i;
          boardReady = ready;
        } else if (times[index] === trip && ready < boardReady) {
          board = i;
          boardReady = ready;
        }
      }
    }

    marked = new Set(improved);
    for (const stop of improved) {
      const list = network.transfers[stop];
      for (let i = 0; i < list.length; i += 2) {
        const arrival = current[stop] + list[i + 1];
        if (arrival < best[list[i]]) {
          current[list[i]] = arrival;
          best[list[i]] = arrival;
          parent.set(list[i], { kind: 'walk', from: stop, seconds: list[i + 1] });
          marked.add(list[i]);
        }
      }
    }
  }

  const journeys: Journey[] = [];
  for (let k = 1; k < rounds.length; k++) {
    let target = -1;
    let arriveAt = INFINITE;
    for (const [stop, walk] of egress) {
      const arrival = rounds[k][stop];

      if (arrival !== INFINITE && arrival !== rounds[0][stop] && arrival + walk < arriveAt) {
        arriveAt = arrival + walk;
        target = stop;
      }
    }
    if (target < 0) continue;
    const journey = reconstruct(network, parents, access, target, k, arriveAt, egress.get(target) ?? 0);
    if (journey) journeys.push(journey);
  }
  return journeys;
}

function reconstruct(
  network: Network,
  parents: Map<number, Parent>[],
  access: Map<number, number>,
  target: number,
  round: number,
  arriveAt: number,
  walkEndS: number,
): Journey | null {
  const legs: JourneyLeg[] = [];
  let stop = target;
  let k = round;
  let walkAfter = 0;
  while (k > 0) {
    const step = parents[k].get(stop);
    if (!step) {
      k--;
      continue;
    }
    if (step.kind === 'walk') {
      walkAfter += step.seconds;
      stop = step.from;
      continue;
    }
    const route = network.routes[step.route];
    if (legs[0]) legs[0].walkBefore = walkAfter;
    legs.unshift({
      line: route.line,
      headsign: route.headsign,
      from: route.stops[step.board],
      to: route.stops[step.alight],
      departure: step.start + route.offsets[step.board],
      arrival: step.start + route.offsets[step.alight],
      walkBefore: 0,
      routeIndex: step.route,
      boardOffset: route.offsets[step.board],
      boardIndex: step.board,
      alightIndex: step.alight,
    });
    walkAfter = 0;
    stop = route.stops[step.board];
    k--;
  }
  if (!legs.length) return null;
  const walkStartS = access.get(legs[0].from) ?? 0;
  return { legs, walkStartS, walkEndS, leaveAt: legs[0].departure - walkStartS, arriveAt };
}

export function directJourneys(network: Network, starts: Int32Array[], origin: LatLon, destination: LatLon, now: number, pace = 1, walks: TripWalks = {}): Journey[] {
  const access = accessStops(network.stops, origin, pace, DIRECT_RADIUS_M, walks.from);
  const egress = accessStops(network.stops, destination, pace, DIRECT_RADIUS_M, walks.to);
  const routes = new Set<number>();
  for (const stop of access.keys()) {
    const list = network.stopRoutes[stop];
    for (let i = 0; i < list.length; i += 2) routes.add(list[i]);
  }
  const byLine = new Map<string, Journey>();
  for (const r of routes) {
    const route = network.routes[r];
    const times = starts[r];
    if (!times.length) continue;
    let best: { trip: number; board: number; alight: number; total: number; walk: number } | null = null;
    for (let i = 0; i < route.stops.length - 1; i++) {
      const walkIn = access.get(route.stops[i]);
      if (walkIn === undefined) continue;
      const index = lowerBound(times, now + walkIn - route.offsets[i]);
      if (index >= times.length) continue;
      const trip = times[index];
      for (let j = i + 1; j < route.stops.length; j++) {
        const walkOut = egress.get(route.stops[j]);
        if (walkOut === undefined || route.stops[j] === route.stops[i]) continue;
        const total = trip + route.offsets[j] + walkOut;
        const walk = walkIn + walkOut;
        if (!best || total < best.total || (total === best.total && walk < best.walk)) best = { trip, board: i, alight: j, total, walk };
      }
    }
    if (!best) continue;
    const departure = best.trip + route.offsets[best.board];
    const walkStartS = access.get(route.stops[best.board]) ?? 0;
    const journey: Journey = {
      legs: [
        {
          line: route.line,
          headsign: route.headsign,
          from: route.stops[best.board],
          to: route.stops[best.alight],
          departure,
          arrival: best.trip + route.offsets[best.alight],
          walkBefore: 0,
          routeIndex: r,
          boardOffset: route.offsets[best.board],
          boardIndex: best.board,
          alightIndex: best.alight,
        },
      ],
      walkStartS,
      walkEndS: egress.get(route.stops[best.alight]) ?? 0,
      leaveAt: departure - walkStartS,
      arriveAt: best.total,
    };
    const known = byLine.get(route.line);
    if (!known || journey.arriveAt < known.arriveAt) byLine.set(route.line, journey);
  }
  return [...byLine.values()];
}

interface FirstRide {
  route: number;
  board: number;
  alight: number;
  trip: number;

  ready: number;
  walk: number;
}

export function oneChangeJourneys(network: Network, starts: Int32Array[], origin: LatLon, destination: LatLon, now: number, pace = 1, walks: TripWalks = {}): Journey[] {
  const access = accessStops(network.stops, origin, pace, ACCESS_RADIUS_M, walks.from);
  const egress = accessStops(network.stops, destination, pace, ACCESS_RADIUS_M, walks.to);

  const ready = new Map<number, Map<string, FirstRide>>();
  const offer = (stop: number, line: string, ride: FirstRide) => {
    let byLine = ready.get(stop);
    if (!byLine) ready.set(stop, (byLine = new Map()));
    const known = byLine.get(line);
    if (!known || ride.ready < known.ready) byLine.set(line, ride);
  };
  const firstRoutes = new Set<number>();
  for (const stop of access.keys()) {
    const list = network.stopRoutes[stop];
    for (let i = 0; i < list.length; i += 2) firstRoutes.add(list[i]);
  }
  for (const r of firstRoutes) {
    const route = network.routes[r];
    const times = starts[r];
    if (!times.length) continue;

    let trip = INFINITE;
    let board = -1;
    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      if (trip !== INFINITE && i > board) {
        const arrival = trip + route.offsets[i];
        const ride = { route: r, board, alight: i, trip, ready: arrival + CHANGE_MARGIN_S, walk: 0 };
        offer(stop, route.line, ride);
        const near = network.transfers[stop];
        for (let n = 0; n < near.length; n += 2) offer(near[n], route.line, { ...ride, ready: ride.ready + near[n + 1], walk: near[n + 1] });
      }
      const walkIn = access.get(stop);
      if (walkIn === undefined || i === route.stops.length - 1) continue;
      const index = lowerBound(times, now + walkIn - route.offsets[i]);
      if (index < times.length && times[index] < trip) {
        trip = times[index];
        board = i;
      } else if (index < times.length && times[index] === trip && walkIn < (access.get(route.stops[board]) ?? INFINITE)) {
        board = i;
      }
    }
  }

  const secondRoutes = new Set<number>();
  for (const stop of egress.keys()) {
    const list = network.stopRoutes[stop];
    for (let i = 0; i < list.length; i += 2) secondRoutes.add(list[i]);
  }
  const byPair = new Map<string, Journey>();
  for (const r of secondRoutes) {
    const route = network.routes[r];
    const times = starts[r];
    if (!times.length) continue;

    const after = new Array<{ at: number; cost: number }>(route.stops.length);
    let best = { at: -1, cost: INFINITE };
    for (let j = route.stops.length - 1; j >= 0; j--) {
      after[j] = best;
      const walkOut = egress.get(route.stops[j]);
      if (walkOut !== undefined && route.offsets[j] + walkOut < best.cost) best = { at: j, cost: route.offsets[j] + walkOut };
    }
    for (let i = 0; i < route.stops.length - 1; i++) {
      const getOff = after[i];
      if (getOff.at < 0) continue;
      const byLine = ready.get(route.stops[i]);
      if (!byLine) continue;
      for (const [line, first] of byLine) {
        if (line === route.line) continue;
        const index = lowerBound(times, first.ready - route.offsets[i]);
        if (index >= times.length) continue;
        const trip = times[index];
        const arriveAt = trip + getOff.cost;
        const key = `${line}>${route.line}`;
        const known = byPair.get(key);

        if (known && (known.arriveAt < arriveAt || (known.arriveAt === arriveAt && known.legs[1].walkBefore <= first.walk))) continue;
        const firstRoute = network.routes[first.route];
        const walkStartS = access.get(firstRoute.stops[first.board]) ?? 0;
        const departure = first.trip + firstRoute.offsets[first.board];
        byPair.set(key, {
          legs: [
            {
              line,
              headsign: firstRoute.headsign,
              from: firstRoute.stops[first.board],
              to: firstRoute.stops[first.alight],
              departure,
              arrival: first.trip + firstRoute.offsets[first.alight],
              walkBefore: 0,
              routeIndex: first.route,
              boardOffset: firstRoute.offsets[first.board],
              boardIndex: first.board,
              alightIndex: first.alight,
            },
            {
              line: route.line,
              headsign: route.headsign,
              from: route.stops[i],
              to: route.stops[getOff.at],
              departure: trip + route.offsets[i],
              arrival: trip + route.offsets[getOff.at],
              walkBefore: first.walk,
              routeIndex: r,
              boardOffset: route.offsets[i],
              boardIndex: i,
              alightIndex: getOff.at,
            },
          ],
          walkStartS,
          walkEndS: egress.get(route.stops[getOff.at]) ?? 0,
          leaveAt: departure - walkStartS,
          arriveAt,
        });
      }
    }
  }
  return [...byPair.values()];
}

export function leaveLatest(network: Network, starts: Int32Array[], journey: Journey): Journey {
  if (journey.legs.length < 2) return journey;
  const legs = journey.legs.map((leg) => ({ ...leg }));
  for (let i = legs.length - 2; i >= 0; i--) {
    const leg = legs[i];
    const next = legs[i + 1];
    if (leg.routeIndex === undefined || leg.boardIndex === undefined || leg.alightIndex === undefined) return journey;
    const route = network.routes[leg.routeIndex];
    const times = starts[leg.routeIndex];

    const deadline = next.departure - next.walkBefore - CHANGE_MARGIN_S - route.offsets[leg.alightIndex];
    const latest = lowerBound(times, deadline + 1) - 1;
    if (latest < 0) continue;
    const start = times[latest];
    const current = leg.departure - route.offsets[leg.boardIndex];
    if (start <= current) continue;
    leg.departure = start + route.offsets[leg.boardIndex];
    leg.arrival = start + route.offsets[leg.alightIndex];
  }
  return { ...journey, legs, leaveAt: legs[0].departure - journey.walkStartS };
}

export const journeySignature = (journey: Journey) => journey.legs.map((leg) => leg.line).join('>');

function score(journey: Journey, preference: RoutePreference) {
  const { change, walk } = PREFERENCES[preference];
  const walking =
    journey.walkStartS + journey.walkEndS + journey.legs.reduce((total, leg) => total + leg.walkBefore, 0);
  return journey.arriveAt + (journey.legs.length - 1) * change + walking * walk;
}

export function planJourneys(
  network: Network,
  starts: Int32Array[],
  origin: LatLon,
  destination: LatLon,
  now: number,
  {
    preference = 'best',
    pace = 1,
    limit = 8,
    all = false,
    walks = {},
  }: { preference?: RoutePreference; pace?: number; limit?: number; all?: boolean; walks?: TripWalks } = {},
): Journey[] {
  const walk = walkingTime(origin, destination, pace);
  if (walk !== null && walk <= WALK_INSTEAD_S) return [];
  const access = accessStops(network.stops, origin, pace, ACCESS_RADIUS_M, walks.from);
  const egress = accessStops(network.stops, destination, pace, ACCESS_RADIUS_M, walks.to);
  const found = new Map<string, Journey>();
  const queue: string[][] = [[]];
  const tried = new Set(['']);
  const sensible = (journey: Journey) =>
    journey.legs[0].departure - now <= MAX_WAIT_S && journey.arriveAt - journey.leaveAt <= MAX_JOURNEY_S;

  for (let run = 0; run < DIVERSITY_RUNS && queue.length; run++) {
    const banned = queue.shift()!;
    const journeys = search(network, starts, access, egress, now, new Set(banned)).filter(sensible);
    if (!journeys.length) continue;
    for (const journey of journeys) {
      const key = journeySignature(journey);
      const known = found.get(key);
      if (!known || journey.arriveAt < known.arriveAt) found.set(key, journey);
    }
    const best = journeys.reduce((a, b) => (score(b, preference) < score(a, preference) ? b : a));
    for (const leg of best.legs) {
      const next = [...new Set([...banned, leg.line])].sort();
      const key = next.join(',');
      if (!tried.has(key)) {
        tried.add(key);
        queue.push(next);
      }
    }
  }

  const enumerated = [
    ...directJourneys(network, starts, origin, destination, now, pace, walks),
    ...oneChangeJourneys(network, starts, origin, destination, now, pace, walks),
  ];
  for (const journey of enumerated.filter(sensible)) {
    const key = journeySignature(journey);
    const known = found.get(key);
    if (!known || journey.arriveAt < known.arriveAt) found.set(key, journey);
  }

  for (const [key, journey] of found) found.set(key, leaveLatest(network, starts, journey));

  const ranked = [...found.values()]
    .filter((journey) => walk === null || journey.arriveAt < now + walk + SLOWER_THAN_WALK_S)
    .sort((a, b) => score(a, preference) - score(b, preference));
  const quickest = ranked.length ? Math.min(...ranked.map((journey) => journey.arriveAt)) : 0;
  const cutoff = ranked.length ? (all ? quickest + ALL_EXTRA_S : ranked[0].arriveAt + MAX_EXTRA_S) : 0;
  const kept = withoutNeedless(ranked.filter((journey) => journey.arriveAt <= cutoff));

  if (all) return kept.sort((x, y) => x.arriveAt - y.arriveAt).slice(0, Math.max(limit, ALL_LIMIT));
  const shown = kept.slice(0, limit);

  const extra = kept
    .filter((journey) => journey.legs.length === 1 && !shown.includes(journey))
    .sort((a, b) => a.arriveAt - b.arriveAt)
    .slice(0, DIRECT_EXTRA);
  return [...shown, ...extra];
}

const lastRide = (journey: Journey) => {
  const leg = journey.legs[journey.legs.length - 1];
  return `${leg.line}@${leg.departure - (leg.boardOffset ?? 0)}`;
};

function withoutNeedless(journeys: Journey[]): Journey[] {
  const walking = new Map(journeys.map((journey) => [journey, walkingOf(journey)]));
  const needless = (x: Journey, xi: number) =>
    journeys.some((y, yi) => {
      if (y === x || y.legs.length > x.legs.length || y.leaveAt < x.leaveAt || y.arriveAt > x.arriveAt) return false;
      const walkX = walking.get(x)!;
      const walkY = walking.get(y)!;
      if (walkY > walkX + NEEDLESS_CHANGE_WALK_S) return false;
      if (y.legs.length < x.legs.length) return true;
      if (lastRide(y) !== lastRide(x)) return false;
      if (y.leaveAt > x.leaveAt || y.arriveAt < x.arriveAt) return true;

      return walkY < walkX || (walkY === walkX && yi < xi);
    });
  return journeys.filter((journey, i) => !needless(journey, i));
}

export type JourneyOrder = 'best' | 'fewerChanges' | 'lessWalking' | 'earliest' | 'all';

const walkingOf = (journey: Journey) =>
  journey.walkStartS + journey.walkEndS + journey.legs.reduce((total, leg) => total + leg.walkBefore, 0);

export function orderJourneys(journeys: Journey[], order: JourneyOrder): Journey[] {
  if (order === 'best') return journeys;

  if (order === 'all') return [...journeys].sort((a, b) => a.leaveAt - b.leaveAt || a.arriveAt - b.arriveAt);
  const key = (journey: Journey) =>
    order === 'fewerChanges' ? journey.legs.length : order === 'lessWalking' ? walkingOf(journey) : journey.arriveAt;
  return [...journeys].sort((a, b) => key(a) - key(b) || a.arriveAt - b.arriveAt);
}

export const AROUND_S = 15 * 60;

const AROUND_STARTS_S = [-AROUND_S, -5 * 60, 5 * 60];
const AROUND_LIMIT = 12;

const beats = (a: Journey, b: Journey) =>
  a !== b &&
  a.leaveAt >= b.leaveAt &&
  a.arriveAt <= b.arriveAt &&
  a.legs.length <= b.legs.length &&
  (a.leaveAt > b.leaveAt || a.arriveAt < b.arriveAt || a.legs.length < b.legs.length);

export function planAround(
  network: Network,
  starts: Int32Array[],
  origin: LatLon,
  destination: LatLon,
  at: number,
  { pace = 1, notBefore = 0, all = false, walks = {} }: { pace?: number; notBefore?: number; all?: boolean; walks?: TripWalks } = {},
): Journey[] {
  const found = new Map<string, Journey>();
  const earliest = Math.max(at - AROUND_S, notBefore);
  const searchFrom = [...new Set(AROUND_STARTS_S.map((offset) => Math.max(0, earliest, at + offset)))];
  for (const leave of searchFrom) {
    for (const journey of planJourneys(network, starts, origin, destination, leave, { pace, limit: 20, all, walks })) {
      if (journey.leaveAt >= earliest && journey.leaveAt <= at + AROUND_S) found.set(`${journeySignature(journey)}@${journey.leaveAt}`, journey);
    }
  }
  const options = [...found.values()];
  return options
    .filter((journey) => all || !options.some((other) => beats(other, journey)))
    .sort((x, y) => x.leaveAt - y.leaveAt || x.arriveAt - y.arriveAt)
    .slice(0, all ? ALL_LIMIT : AROUND_LIMIT);
}

const ARRIVE_LOOKBACK_S = [60 * 60, 2 * 3600, 4 * 3600];
const ARRIVE_LATER_TRIES = 4;
const ARRIVE_STEP_S = 60;

export function planArrivingBy(
  network: Network,
  starts: Int32Array[],
  origin: LatLon,
  destination: LatLon,
  arriveBy: number,
  {
    pace = 1,
    limit = 8,
    notBefore = 0,
    all = false,
    walks = {},
  }: { pace?: number; limit?: number; notBefore?: number; all?: boolean; walks?: TripWalks } = {},
): Journey[] {
  const best = new Map<string, Journey>();
  for (const lookback of ARRIVE_LOOKBACK_S) {
    let leave = Math.max(0, notBefore, arriveBy - lookback);
    for (let attempt = 0; attempt < ARRIVE_LATER_TRIES; attempt++) {
      const inTime = planJourneys(network, starts, origin, destination, leave, { pace, limit: 20, all, walks }).filter((journey) => journey.arriveAt <= arriveBy);
      if (!inTime.length) break;
      for (const journey of inTime) {
        const key = journeySignature(journey);
        if ((best.get(key)?.leaveAt ?? -1) < journey.leaveAt) best.set(key, journey);
      }
      leave = Math.max(...inTime.map((journey) => journey.leaveAt)) + ARRIVE_STEP_S;
    }
    if (best.size) break;
  }
  return [...best.values()].sort((a, b) => b.leaveAt - a.leaveAt || a.arriveAt - b.arriveAt).slice(0, all ? ALL_LIMIT : limit);
}

export function laterDepartures(starts: Int32Array[], journey: Journey, count: number): number[] {
  const { routeIndex, boardOffset, departure } = journey.legs[0];
  if (routeIndex === undefined || boardOffset === undefined) return [];
  const times = starts[routeIndex];
  const first = lowerBound(times, departure - boardOffset + 1);
  return Array.from(times.subarray(first, first + count))
    .map((start) => start + boardOffset)
    .filter((time) => time - departure <= LATER_WINDOW_S);
}

export function walkingTime(origin: LatLon, destination: LatLon, pace = 1): number | null {
  const seconds = walkSeconds(distanceM(origin, destination), pace);
  return seconds <= WALK_ONLY_LIMIT_S ? seconds : null;
}

export function planOnLines(
  network: Network,
  starts: Int32Array[],
  origin: LatLon,
  destination: LatLon,
  now: number,
  legs: string[][],
  { pace = 1, count = 3, walks = {} }: { pace?: number; count?: number; walks?: TripWalks } = {},
): Journey[] {
  const allowed = new Set(legs.flat());
  const banned = new Set(network.routes.map((route) => route.line).filter((line) => !allowed.has(line)));
  const access = accessStops(network.stops, origin, pace, ACCESS_RADIUS_M, walks.from);
  const egress = accessStops(network.stops, destination, pace, ACCESS_RADIUS_M, walks.to);

  const follows = (journey: Journey) => {
    let at = 0;
    for (const leg of journey.legs) {
      while (at < legs.length && !legs[at].includes(leg.line)) at++;
      if (at >= legs.length) return false;
    }
    return journey.legs.length <= legs.length;
  };
  const out: Journey[] = [];
  let from = now;
  for (let round = 0; round < count; round++) {
    const found = search(network, starts, access, egress, from, banned)
      .filter(follows)
      .filter((journey) => journey.legs[0].departure - now <= MAX_WAIT_S)
      .sort((a, b) => a.arriveAt - b.arriveAt);
    const next = found.find((journey) => !out.some((known) => known.leaveAt === journey.leaveAt && journeySignature(known) === journeySignature(journey)));
    if (!next) break;
    out.push(next);
    from = next.legs[0].departure + 60;
  }
  return out;
}
