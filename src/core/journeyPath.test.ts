import { describe, expect, it } from 'vitest';
import { buildJourneyShape, journeyWalks, ridePath, sliceShape, type PathPoint } from './journeyPath';
import type { Journey } from './raptor';
import type { Pattern, Stop } from './types';

const stop = (id: string, lat: number): Stop => ({ id, code: id, name: id, lat, lon: 23.7, zone: '', city: '', lines: [] });
const stops = [stop('a', 61.4), stop('b', 61.42), stop('c', 61.44)];
const shape: PathPoint[] = [61.39, 61.4, 61.41, 61.42, 61.43, 61.44, 61.45].map((lat) => [23.7, lat]);

const pattern: Pattern = { id: 0, line: '3', dir: 0, headsign: 'c', shape: 's1', stops: ['a', 'b', 'c'], offsets: [0, 5, 10], trips: 1 };

const journey: Journey = {
  legs: [
    { line: '3', headsign: 'c', from: 0, to: 1, departure: 100, arrival: 200, walkBefore: 0 },
    { line: '5', headsign: 'x', from: 2, to: 2, departure: 300, arrival: 400, walkBefore: 60 },
  ],
  walkStartS: 120,
  walkEndS: 0,
  leaveAt: 0,
  arriveAt: 400,
};

describe('sliceShape', () => {
  it('keeps only the ridden part, ending exactly at the stops', () => {
    const part = sliceShape(shape, [stops[0], stops[1]], 0);
    expect(part[0]).toEqual([23.7, 61.4]);
    expect(part[part.length - 1]).toEqual([23.7, 61.42]);
    expect(part.every(([, lat]) => lat >= 61.4 && lat <= 61.42)).toBe(true);
  });

  it('does not overshoot a stop on a long straight with few points', () => {
    const sparse: PathPoint[] = [
      [23.7, 61.4],
      [23.7, 61.5],
    ];
    const part = sliceShape(sparse, [stop('x', 61.42), stop('y', 61.44)], 0);
    expect(part.every(([, lat]) => lat >= 61.42 - 1e-9 && lat <= 61.44 + 1e-9)).toBe(true);
  });

  it('cuts a there-and-back line at the visit that belongs to the trip', () => {
    const outAndBack: PathPoint[] = [
      [23.7, 61.4],
      [23.7, 61.5],
      [23.7001, 61.5],
      [23.7001, 61.4],
    ];
    const trip = [stop('start', 61.4), stop('far', 61.5), stop('back', 61.45)];
    const part = sliceShape(outAndBack, trip, 1);

    expect(part.slice(1, -1).every(([lon]) => lon >= 23.7)).toBe(true);
    expect(part[part.length - 2][0]).toBeCloseTo(23.7001, 4);
  });
});

describe('ridePath', () => {
  const near = [stop('a', 61.4), stop('b', 61.405)];

  it('uses the shape when it agrees with the stops', () => {
    expect(ridePath(shape, [stops[0], stops[1]], 0).length).toBeGreaterThan(2);
  });

  it('follows the stops when a shape would draw far more than the ride', () => {
    const wandering: PathPoint[] = [
      [23.7, 61.4],
      [23.9, 61.6],
      [23.7, 61.405],
    ];
    expect(ridePath(wandering, near, 0)).toEqual([
      [23.7, 61.4],
      [23.7, 61.405],
    ]);
  });

  it('follows the stops when there is no shape', () => {
    expect(ridePath(undefined, near, 0)).toHaveLength(2);
  });
});

describe('journeyWalks', () => {
  it('lists the walk to the start and between legs, and skips an empty one', () => {
    const walks = journeyWalks(journey, stops, { lat: 61.39, lon: 23.7 }, stops[2]);
    expect(walks).toHaveLength(2);
    expect(walks[0].to).toBe(stops[0]);
    expect(walks[1].from).toBe(stops[1]);
    expect(walks[1].to).toBe(stops[2]);
  });
});

describe('buildJourneyShape', () => {
  it('follows the route shape when there is one', () => {
    const result = buildJourneyShape(journey, stops, [pattern], () => shape, []);
    expect(result.rides[0].path.length).toBeGreaterThan(2);
    expect(result.lines).toEqual(['3', '5']);
  });

  it('falls back to the stops, then to a straight line', () => {
    const result = buildJourneyShape(journey, stops, [pattern], () => undefined, []);
    expect(result.rides[0].path).toEqual([
      [23.7, 61.4],
      [23.7, 61.42],
    ]);
    expect(result.rides[1].path).toHaveLength(2);
  });

  it('marks where to board and get off', () => {
    const result = buildJourneyShape(journey, stops, [pattern], () => shape, []);
    expect(result.markers.map((m) => m.id)).toEqual(['a', 'b', 'c', 'c']);
  });
});
