import { describe, expect, it } from 'vitest';
import { activeStarts, buildNetwork, planJourneys, type RawRoute } from './raptor';
import { serviceDay } from './time';
import { currentStep, legStops, ridePosition, tripSteps, type TripContext } from './trip';
import type { Service, Stop } from './types';

const everyDay: Service = { days: '1111111', start: 20260101, end: 20271231, add: [], remove: [] };
const services = { a: everyDay };
const now = Date.parse('2026-11-02T08:00:00Z');
const start = serviceDay(now).startMs;
const clock = (hour: number, minute = 0) => hour * 3600 + minute * 60;
const nowS = Math.floor((now - start) / 1000);

const stop = (id: string, lat: number, lon = 23.7): Stop => ({ id, code: id, name: id, lat, lon, zone: '', city: '', lines: [] });
const route = (line: string, stops: number[], perStop: number, startsAt: number[]): RawRoute => ({
  l: line,
  h: `to ${line}`,
  s: stops,
  o: stops.map((_, i) => (i === 0 ? 0 : perStop)),
  t: [{ v: ['a'], d: startsAt.map((t, i) => (i === 0 ? t : t - startsAt[i - 1])) }],
});

const stops = [stop('Home', 61.4), stop('Middle', 61.42), stop('Market', 61.44), stop('Work', 61.46)];
const network = buildNetwork(stops, [route('3', [0, 1, 2, 3], 180, [clock(10, 5)])]);
const origin = { lat: 61.398, lon: 23.7 };
const destination = { lat: 61.4605, lon: 23.7 };
const [journey] = planJourneys(network, activeStarts(network, services, now), origin, destination, nowS);
const steps = tripSteps(journey, stops, destination);
const context = (seconds: number, location: TripContext['location']): TripContext => ({ journey, stops, now: seconds, location, delays: [0] });

describe('trip steps', () => {
  it('walks, waits, rides, walks and arrives', () => {
    expect(steps.map((step) => step.kind)).toEqual(['walk', 'wait', 'ride', 'walkEnd', 'arrived']);
  });

  it('knows every stop of the ride, with times', () => {
    const list = legStops(network, journey.legs[0]);
    expect(list.map((s) => stops[s.stop].name)).toEqual(['Home', 'Middle', 'Market', 'Work']);
    expect(list[1].time - list[0].time).toBe(180);
  });
});

describe('following the rider', () => {
  it('moves on as the rider reaches each place', () => {
    expect(currentStep(steps, 0, context(clock(10, 1), origin))).toBe(0);
    expect(currentStep(steps, 0, context(clock(10, 2), stops[0]))).toBe(1);

    expect(currentStep(steps, 1, context(clock(10, 4), stops[0]))).toBe(1);

    expect(currentStep(steps, 1, context(clock(10, 6), stops[1]))).toBe(2);
    expect(currentStep(steps, 2, context(clock(10, 13), stops[3]))).toBe(3);
    expect(currentStep(steps, 3, context(clock(10, 15), destination))).toBe(4);
  });

  it('follows the timetable when location is off', () => {
    expect(currentStep(steps, 0, context(clock(10, 0), null))).toBe(0);
    expect(currentStep(steps, 0, context(clock(10, 4), null))).toBe(1);
    expect(currentStep(steps, 0, context(clock(10, 6), null))).toBe(2);
    expect(currentStep(steps, 0, context(journey.arriveAt + 1, null))).toBe(4);
  });

  it('waits longer for a late tram', () => {
    expect(currentStep(steps, 1, { ...context(clock(10, 6), null), delays: [180] })).toBe(1);
  });

  it('counts the stops passed', () => {
    const list = legStops(network, journey.legs[0]);
    expect(ridePosition(list, stops, stops[2], 0, 0)).toBe(2);
    expect(ridePosition(list, stops, null, clock(10, 11), 0)).toBe(2);

    expect(ridePosition(list, stops, stops[0], 0, 0, 2)).toBe(2);
  });
});

describe('fare zones', () => {
  const zoned = (zone: string, lat: number): Stop => ({ ...stop(`${zone}${lat}`, lat), zone });

  it('names the run of zones a ticket must cover', async () => {
    const { journeyZones } = await import('./zones');
    const line = [zoned('A', 61.4), zoned('B', 61.42), zoned('C', 61.44), zoned('TRAFICOM', 61.46)];
    const net = buildNetwork(line, [route('3', [0, 1, 2, 3], 180, [clock(10, 5)])]);
    const [trip] = planJourneys(net, activeStarts(net, services, now), origin, destination, nowS);
    expect(journeyZones(net, trip)).toBe('ABC');
  });

  it('fills in a zone passed between two others', async () => {
    const { journeyZones } = await import('./zones');
    const line = [zoned('A', 61.4), zoned('C', 61.42), zoned('C', 61.44), zoned('C', 61.46)];
    const net = buildNetwork(line, [route('3', [0, 1, 2, 3], 180, [clock(10, 5)])]);
    const [trip] = planJourneys(net, activeStarts(net, services, now), origin, destination, nowS);
    expect(journeyZones(net, trip)).toBe('ABC');
  });

  it('shows Waltti numbers as a range, and nothing without ticket zones', async () => {
    const { journeyZones } = await import('./zones');
    const numbered = [zoned('1', 61.4), zoned('2', 61.42), zoned('3', 61.44), zoned('3', 61.46)];
    const net = buildNetwork(numbered, [route('3', [0, 1, 2, 3], 180, [clock(10, 5)])]);
    const [trip] = planJourneys(net, activeStarts(net, services, now), origin, destination, nowS);
    expect(journeyZones(net, trip)).toBe('1–3');
    const plain = buildNetwork(stops, [route('3', [0, 1, 2, 3], 180, [clock(10, 5)])]);
    const [other] = planJourneys(plain, activeStarts(plain, services, now), origin, destination, nowS);
    expect(journeyZones(plain, other)).toBeNull();
  });
});
