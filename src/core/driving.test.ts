import { describe, expect, it } from 'vitest';
import { nextAnnouncement, roundForVoice } from './driveVoice';
import { closurePolygons, decodePolyline6, eventsAlong, progressOn, toCarRoute, type LonLat } from './driving';
import type { RoadEvent } from './roadEvents';

function encode(points: LonLat[]) {
  let out = '';
  let last = [0, 0];
  for (const [lon, lat] of points) {
    for (const [i, value] of [Math.round(lat * 1e6), Math.round(lon * 1e6)].entries()) {
      let delta = value - last[i];
      last[i] = value;
      delta = delta < 0 ? ~(delta << 1) : delta << 1;
      while (delta >= 0x20) {
        out += String.fromCharCode((0x20 | (delta & 0x1f)) + 63);
        delta >>= 5;
      }
      out += String.fromCharCode(delta + 63);
    }
  }
  return out;
}

const path: LonLat[] = [
  [23.76, 61.5],
  [23.769, 61.5],
  [23.779, 61.5],
  [23.779, 61.505],
  [23.779, 61.509],
];
const route = toCarRoute({
  summary: { length: 2.06, time: 240 },
  legs: [
    {
      shape: encode(path),
      maneuvers: [
        { type: 2, instruction: 'Drive east on Hämeenkatu.', street_names: ['Hämeenkatu'], length: 1.06, time: 120, begin_shape_index: 0, end_shape_index: 2 },
        {
          type: 15,
          instruction: 'Turn left onto Satakunnankatu.',
          verbal_transition_alert_instruction: 'Turn left onto Satakunnankatu.',
          verbal_pre_transition_instruction: 'Turn left onto Satakunnankatu.',
          street_names: ['Satakunnankatu'],
          length: 1,
          time: 120,
          begin_shape_index: 2,
          end_shape_index: 4,
        },
        { type: 4, instruction: 'You have arrived.', length: 0, time: 0, begin_shape_index: 4, end_shape_index: 4 },
      ],
    },
  ],
});

describe('car routes', () => {
  it('decodes the shape and measures it', () => {
    expect(decodePolyline6(encode(path))[3]).toEqual([23.779, 61.505]);
    expect(route.along[2]).toBeGreaterThan(1000);
    expect(route.via).toEqual(['Hämeenkatu', 'Satakunnankatu']);
  });

  it('finds the car on the route and the next turn', () => {
    const progress = progressOn(route, { lat: 61.50003, lon: 23.774 });
    expect(progress.off).toBeLessThan(5);
    expect(progress.next).toBe(1);
    expect(progress.toNext).toBeGreaterThan(200);
    expect(progress.toNext).toBeLessThan(300);
  });

  it('notices a wrong turn', () => {
    expect(progressOn(route, { lat: 61.497, lon: 23.774 }).off).toBeGreaterThan(300);
  });

  it('warns ahead, then says the turn', () => {
    const said = new Set<string>();
    const far = nextAnnouncement(route, progressOn(route, { lat: 61.5, lon: 23.774 }), 13, said);
    expect(far?.cue).toBe('far');
    said.add(far!.key);
    expect(nextAnnouncement(route, progressOn(route, { lat: 61.5, lon: 23.776 }), 13, said)).toBeNull();
    expect(nextAnnouncement(route, progressOn(route, { lat: 61.5, lon: 23.7778 }), 13, said)?.cue).toBe('near');
  });

  it('rounds distances the way people say them', () => {
    expect([roundForVoice(1234), roundForVoice(470), roundForVoice(180), roundForVoice(20)]).toEqual([1200, 450, 200, 50]);
  });
});

const closed: RoadEvent = {
  id: 'c',
  kind: 'closure',
  towns: [],
  r: [{ t: 'ROAD_CLOSED' }],
  sev: 2,
  lines: [
    [
      [23.769, 61.5],
      [23.774, 61.5],
      [23.779, 61.5],
    ],
  ],
};

describe('closures', () => {
  it('boxes the closed road between its ends, not at them', () => {
    const boxes = closurePolygons([closed]);
    expect(boxes).toHaveLength(2);
    const [west] = boxes;
    expect(Math.min(...west.map((p) => p[0]))).toBeGreaterThan(23.769);
  });

  it('leaves out lines with only their ends known, and roads that are open', () => {
    expect(closurePolygons([{ ...closed, rough: true }, { ...closed, r: [{ t: 'SINGLE_LANE_CLOSED' }] }])).toEqual([]);
  });

  it('finds the events on the way', () => {
    const elsewhere: RoadEvent = { ...closed, id: 'far', lines: [[[24.5, 60.2], [24.51, 60.2]]] };
    expect(eventsAlong(route, [elsewhere, closed]).map((e) => e.id)).toEqual(['c']);
  });
});
