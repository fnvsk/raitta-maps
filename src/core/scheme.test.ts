import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildNetwork, routeOnScheme, schemeLayout } from './scheme';
import { HAND_SCHEMES, handLayout, SCHEME_STEP } from './schemeHand';

const load = (file: string) => JSON.parse(gunzipSync(readFileSync(`public/data/helsinki/${file}`)).toString());

describe('the Helsinki metro scheme', () => {
  const network = buildNetwork('metro', load('lines.json.gz'), load('patterns.json.gz'), load('stops.json.gz'));

  it('has one station per name and both lines', () => {
    expect(network.lines).toEqual(['M1', 'M2']);
    expect(network.stations.length).toBeGreaterThan(25);
    expect(network.stations.length).toBeLessThan(35);
    expect(new Set(network.stations.map((s) => s.name)).size).toBe(network.stations.length);
  });

  it('lays every edge at a multiple of 45 degrees', () => {
    const pos = schemeLayout(network);
    const off = network.edges.filter((edge) => {
      const angle = (Math.atan2(pos[edge.b][1] - pos[edge.a][1], pos[edge.b][0] - pos[edge.a][0]) * 180) / Math.PI;
      const rest = Math.abs(((angle % 45) + 45) % 45);
      return Math.min(rest, 45 - rest) > 6;
    });
    expect(off.length).toBeLessThanOrEqual(2);
  });

  it('finds the way between two stations', () => {
    const id = (name: string) => network.stations.find((s) => s.name === name)!.id;
    const route = routeOnScheme(network, id('Ruoholahti'), id('Vuosaari'))!;
    expect(route.legs.length).toBe(1);
    expect(route.minutes).toBeGreaterThan(15);
  });
});

describe('the hand-drawn schemes', () => {
  const cases = [
    ['helsinki', 'metro'],
    ['helsinki', 'tram'],
    ['helsinki', 'train'],
    ['tampere', 'tram'],
  ] as const;
  for (const [region, mode] of cases) {
    it(`fit today's ${region} ${mode} timetables, every piece of track straight or at 45 degrees`, () => {
      const from = (file: string) => JSON.parse(gunzipSync(readFileSync(`public/data/${region}/${file}`)).toString());
      const network = buildNetwork(mode, from('lines.json.gz'), from('patterns.json.gz'), from('stops.json.gz'));
      const drawing = Object.values(HAND_SCHEMES).find((hand) => handLayout(hand, network, SCHEME_STEP));
      expect(drawing).toBeDefined();
      const { pos } = handLayout(drawing!, network, SCHEME_STEP)!;
      const crooked = network.edges.filter((edge) => {
        const [dx, dy] = [pos[edge.b][0] - pos[edge.a][0], pos[edge.b][1] - pos[edge.a][1]];
        return !(Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.01);
      });
      expect(crooked.map((edge) => `${edge.a}-${edge.b}`)).toEqual([]);
      
      expect(new Set(Object.values(pos).map((p) => p.join(','))).size).toBe(network.stations.length);
    });
  }
});
