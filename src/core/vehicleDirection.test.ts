import { describe, expect, it } from 'vitest';
import type { LatLon, Pattern, Vehicle } from './types';
import { vehiclePattern } from './vehicleDirection';

const stops: Record<string, LatLon> = {
  a: { lat: 61.4, lon: 23.7 },
  b: { lat: 61.42, lon: 23.7 },
  c: { lat: 61.44, lon: 23.7 },
};
const stopAt = (id: string) => stops[id];

const pattern = (id: number, dir: number, headsign: string, ids: string[], trips = 10): Pattern => ({
  id,
  line: '3',
  dir,
  headsign,
  shape: '',
  stops: ids,
  offsets: ids.map((_, i) => i),
  trips,
});
const north = pattern(1, 0, 'Pohjoinen', ['a', 'b', 'c']);
const south = pattern(2, 1, 'Etelä', ['c', 'b', 'a']);
const patterns = [north, south];

const vehicle = (extra: Partial<Vehicle>): Vehicle => ({
  ref: 'v',
  line: '3',
  mode: 'tram',
  lat: 61.41,
  lon: 23.7,
  bearing: 0,
  speedKmh: 30,
  delaySec: null,
  destinationStop: '',
  onward: [],
  ...extra,
});

describe('vehiclePattern', () => {
  it('uses the direction in the feed', () => {
    expect(vehiclePattern(patterns, vehicle({ direction: 1, bearing: 0 }), stopAt)).toBe(south);
  });

  it('uses the final stop', () => {
    expect(vehiclePattern(patterns, vehicle({ destinationStop: 'a' }), stopAt)).toBe(south);
  });

  it('uses the headsign, whatever its case', () => {
    expect(vehiclePattern(patterns, vehicle({ headsign: 'POHJOINEN', bearing: 180 }), stopAt)).toBe(north);
  });

  it('falls back to the way the vehicle is heading', () => {
    expect(vehiclePattern(patterns, vehicle({ bearing: 5 }), stopAt)).toBe(north);
    expect(vehiclePattern(patterns, vehicle({ bearing: 175 }), stopAt)).toBe(south);
  });

  it('ignores the heading of a vehicle standing still', () => {
    const busier = pattern(3, 1, 'Etelä', ['c', 'b', 'a'], 40);
    expect(vehiclePattern([north, busier], vehicle({ bearing: 5, speedKmh: 0 }), stopAt)).toBe(busier);
  });

  it('ignores clues that match nothing', () => {
    expect(vehiclePattern(patterns, vehicle({ headsign: 'Tuntematon', destinationStop: 'zzz', bearing: 175 }), stopAt)).toBe(south);
  });

  it('finds nothing for an unknown line', () => {
    expect(vehiclePattern(patterns, vehicle({ line: '99' }), stopAt)).toBeUndefined();
  });
});
