import { describe, expect, it } from 'vitest';
import { railSnapper, type LonLat } from './railSnap';

const track: LonLat[] = [
  [25.0, 61.0],
  [25.01, 61.0],
  [25.01, 61.01],
];

describe('rail snapping', () => {
  const along = railSnapper([track]);

  it('follows the bend between two reports', () => {
    const path = along([25.002, 61.0001], [25.0101, 61.008])!;
    expect(path[0][0]).toBeCloseTo(25.002, 4);
    expect(path).toContainEqual([25.01, 61.0]);
    expect(path[path.length - 1][1]).toBeCloseTo(61.008, 4);
  });

  it('runs the other way too', () => {
    const path = along([25.0101, 61.008], [25.002, 61.0001])!;
    expect(path[0][1]).toBeCloseTo(61.008, 4);
    expect(path[path.length - 1][0]).toBeCloseTo(25.002, 4);
  });

  it('takes both ends from the same of several shapes', () => {
    const short: LonLat[] = [
      [25.0, 61.0],
      [25.01, 61.0],
    ];
    const both = railSnapper([short, track], 60);
    const path = both([25.002, 61.0], [25.01, 61.006])!;
    expect(path).toContainEqual([25.01, 61.0]);
    expect(path[path.length - 1][1]).toBeCloseTo(61.006, 4);
  });

  it('gives up off the track', () => {
    expect(along([25.002, 61.0001], [25.2, 61.3])).toBeNull();
  });
});
