import { describe, expect, it } from 'vitest';
import type { CarRoute, LonLat } from './driving';
import { alongRoute } from './roadReports';
import { encodePolyline6, isSpeeding, limitAt } from './speedLimits';
import { decodePolyline6 } from './driving';

const path: LonLat[] = Array.from({ length: 30 }, (_, i) => [23.7 + i * 0.002, 61.5] as LonLat);
path.push([23.7 + 29 * 0.002 + 0.0375, 61.5]);
const k = 111_320 * Math.cos((61.5 * Math.PI) / 180);
const along = path.map(([lon]) => (lon - 23.7) * k);
const route = { path, along, meters: along.at(-1)!, seconds: 0, maneuvers: [], via: [], toll: false, ferry: false } as unknown as CarRoute;

describe('cameras and reports along a route', () => {
  it('finds what lies on the road, in order, and leaves the rest', () => {
    const found = alongRoute(
      route,
      [
        [23.73, 61.50005, 60],
        [23.71, 61.51, 80],
        [23.778, 61.5, 0],
      ],
      [{ id: 'p1', kind: 'police', lat: 61.5, lon: 23.705, seen: 0 }],
    );
    expect(found.map((f) => f.key)).toEqual(['p1', 'fixed:23.73,61.50005', 'fixed:23.778,61.5']);
    expect(found[1].limit).toBe(60);
    expect(found[1].along).toBeCloseTo(0.03 * k, -1);
  });
});

describe('speed limits', () => {
  it('encodes shapes the way the server decodes them', () => {
    const back = decodePolyline6(encodePolyline6(path.slice(0, 3)));
    back.forEach(([lon, lat], i) => {
      expect(lon).toBeCloseTo(path[i][0], 6);
      expect(lat).toBeCloseTo(path[i][1], 6);
    });
  });

  it('knows the limit at any point and when it is broken', () => {
    const limits = { from: [0, 500, 2000], limit: [50, 0, 80] };
    expect(limitAt(limits, 10)).toBe(50);
    expect(limitAt(limits, 700)).toBe(0);
    expect(limitAt(limits, 5000)).toBe(80);
    expect(isSpeeding(54, 50)).toBe(true);
    expect(isSpeeding(52, 50)).toBe(false);
    expect(isSpeeding(120, 0)).toBe(false);
  });
});
