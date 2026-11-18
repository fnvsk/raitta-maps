import { describe, expect, it } from 'vitest';
import { pinchZoomLevel } from './pinchZoom';

describe('pinchZoomLevel', () => {
  it('zooms out further than the fingers alone would', () => {
    expect(pinchZoomLevel(13, 200, 100)).toBeCloseTo(11.2);
  });

  it('zooms in just as readily', () => {
    expect(pinchZoomLevel(13, 100, 200)).toBeCloseTo(14.8);
  });

  it('does nothing until the fingers move', () => {
    expect(pinchZoomLevel(13, 150, 150)).toBe(13);
  });
});
