import { distanceM } from './geo';
import type { Journey, JourneyLeg, Network } from './raptor';
import type { LatLon, Stop, Vehicle } from './types';

export const AT_STOP_M = 60;

export const ARRIVED_M = 40;

const LEFT_STOP_M = 120;

const BOARD_GRACE_S = 90;

const AT_STOP_BEFORE_S = 120;

const ALIGHT_WINDOW_S = 180;

const ON_BOARD_M = 250;

export type TripStep =
  | { kind: 'walk'; leg: number; target: LatLon }
  | { kind: 'walkEnd'; target: LatLon }
  | { kind: 'wait'; leg: number }
  | { kind: 'ride'; leg: number }
  | { kind: 'arrived' };

export interface LegStop {
  stop: number;

  time: number;
}

export function legStops(network: Network, leg: JourneyLeg): LegStop[] {
  const route = leg.routeIndex === undefined ? undefined : network.routes[leg.routeIndex];
  if (!route || leg.boardIndex === undefined || leg.alightIndex === undefined || leg.boardOffset === undefined) {
    return [
      { stop: leg.from, time: leg.departure },
      { stop: leg.to, time: leg.arrival },
    ];
  }
  const start = leg.departure - leg.boardOffset;
  const result: LegStop[] = [];
  for (let i = leg.boardIndex; i <= leg.alightIndex; i++) result.push({ stop: route.stops[i], time: start + route.offsets[i] });
  return result;
}

export function tripSteps(journey: Journey, stops: Stop[], destination: LatLon): TripStep[] {
  const steps: TripStep[] = [];
  journey.legs.forEach((leg, i) => {
    steps.push({ kind: 'walk', leg: i, target: stops[leg.from] }, { kind: 'wait', leg: i }, { kind: 'ride', leg: i });
  });
  steps.push({ kind: 'walkEnd', target: destination }, { kind: 'arrived' });
  return steps;
}

export interface TripContext {
  journey: Journey;
  stops: Stop[];

  now: number;
  location: LatLon | null;

  delays: number[];
}

function done(step: TripStep, { journey, stops, now, location, delays }: TripContext): boolean {
  switch (step.kind) {
    case 'walk': {
      const leg = journey.legs[step.leg];
      const departs = leg.departure + delays[step.leg];
      if (location) return distanceM(location, step.target) <= AT_STOP_M;
      return now >= departs - AT_STOP_BEFORE_S;
    }
    case 'wait': {
      const leg = journey.legs[step.leg];
      const departs = leg.departure + delays[step.leg];
      if (now < departs) return false;
      return !location || distanceM(location, stops[leg.from]) > LEFT_STOP_M || now >= departs + BOARD_GRACE_S;
    }
    case 'ride': {
      const leg = journey.legs[step.leg];
      const arrives = leg.arrival + delays[step.leg];
      if (location && distanceM(location, stops[leg.to]) <= AT_STOP_M && now >= arrives - ALIGHT_WINDOW_S) return true;
      return now >= arrives + (location ? ALIGHT_WINDOW_S : 0);
    }
    case 'walkEnd': {
      if (location) return distanceM(location, step.target) <= ARRIVED_M;
      const last = journey.legs.length - 1;
      return now >= journey.arriveAt + delays[last];
    }
    case 'arrived':
      return false;
  }
}

export function currentStep(steps: TripStep[], from: number, context: TripContext): number {
  let step = from;
  while (step < steps.length - 1 && done(steps[step], context)) step++;
  return step;
}

export function ridePosition(list: LegStop[], stops: Stop[], location: LatLon | null, now: number, delay: number, from = 0): number {
  if (location) {
    let best = from;
    let bestDistance = Infinity;
    for (let i = from; i < list.length; i++) {
      const distance = distanceM(location, stops[list[i].stop]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }
  let position = from;
  while (position < list.length - 1 && list[position + 1].time + delay <= now) position++;
  return position;
}

export function legVehicle(vehicles: Vehicle[] | undefined, leg: JourneyLeg, boardStop: Stop, rider: LatLon | null, riding: boolean): Vehicle | undefined {
  const sameTrip = (vehicle: Vehicle) =>
    vehicle.line === leg.line && (!vehicle.headsign || !leg.headsign || vehicle.headsign.toLowerCase() === leg.headsign.toLowerCase());
  const candidates = (vehicles ?? []).filter(sameTrip);
  if (riding) {
    if (!rider) return undefined;
    const nearest = candidates.reduce<{ vehicle?: Vehicle; distance: number }>(
      (best, vehicle) => {
        const distance = distanceM(rider, vehicle);
        return distance < best.distance ? { vehicle, distance } : best;
      },
      { distance: ON_BOARD_M },
    );
    return nearest.vehicle;
  }
  return candidates.sort((a, b) => distanceM(a, boardStop) - distanceM(b, boardStop))[0];
}
