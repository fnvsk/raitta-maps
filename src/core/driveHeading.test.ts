import { describe, expect, it } from 'vitest';
import { blendBearing, headingAhead, pointAlong, type CarRoute } from './driving';

const east = 1000 / (111_320 * Math.cos((61 * Math.PI) / 180));
const north = 1000 / 111_320;
const route = {
  meters: 2000,
  seconds: 200,
  path: [
    [23.7, 61],
    [23.7 + east, 61],
    [23.7 + east, 61 + north],
  ],
  along: [0, 1000, 2000],
  maneuvers: [],
  via: [],
  toll: false,
  ferry: false,
} as unknown as CarRoute;

describe('driving heading', () => {
  it('finds points along the route', () => {
    expect(pointAlong(route, 500).lon).toBeCloseTo(23.7 + east / 2, 6);
    expect(pointAlong(route, 1500).lat).toBeCloseTo(61 + north / 2, 6);
    expect(pointAlong(route, 5000).lat).toBeCloseTo(61 + north, 6);
  });

  it('looks a little way ahead, so it turns before the corner', () => {
    expect(headingAhead(route, 200)).toBeCloseTo(90, 0);
    expect(headingAhead(route, 1500)).toBeCloseTo(0, 0);

    const nearCorner = headingAhead(route, 980);
    expect(nearCorner).toBeGreaterThan(10);
    expect(nearCorner).toBeLessThan(80);
  });

  it('turns the short way round', () => {
    expect(blendBearing(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(blendBearing(10, 350, 0.5)).toBeCloseTo(0, 6);
    expect(blendBearing(90, 180, 0.5)).toBeCloseTo(135, 6);
  });
});
