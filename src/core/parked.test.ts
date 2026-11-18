import { describe, expect, it } from 'vitest';
import { movingOnly } from './parked';
import type { Vehicle } from './types';

const vehicle = (ref: string, lat: number): Vehicle => ({ ref, line: '1', mode: 'bus', lat, lon: 23.76, bearing: 0, speedKmh: 0, delaySec: null, destinationStop: '', onward: [] });
const MINUTE = 60_000;

describe('parked vehicles', () => {
  it('hides a vehicle that has not moved for five minutes, until it moves', () => {
    const start = 1_000_000;
    expect(movingOnly([vehicle('a', 61.5)], start)).toHaveLength(1);
    expect(movingOnly([vehicle('a', 61.50001)], start + 4 * MINUTE)).toHaveLength(1);
    expect(movingOnly([vehicle('a', 61.50001)], start + 6 * MINUTE)).toHaveLength(0);

    expect(movingOnly([vehicle('a', 61.501)], start + 7 * MINUTE)).toHaveLength(1);
  });

  it('keeps a moving vehicle', () => {
    const start = 2_000_000;
    for (let i = 0; i < 10; i++) expect(movingOnly([vehicle('b', 61.4 + i * 0.001)], start + i * MINUTE)).toHaveLength(1);
  });
});
