import { describe, expect, it } from 'vitest';
import { connectorGroups, finnishClock, matches, NO_FILTER, priceNow, summarize, type ChargerSite, type ChargerStatus, type Tariff } from './charging';

const tesla: Tariff = {
  e: [
    { c: [['C', 0]], r: { maxD: 5 } },
    { c: [['C', 37.65]] },
    { c: [['E', 0.4393]], r: { st: '00:00', et: '16:00' } },
    { c: [['E', 0.5146]], r: { st: '16:00', et: '20:00' } },
    { c: [['E', 0.4393]], r: { st: '20:00', et: '00:00' } },
    { c: [['E', 0.4393]] },
  ],
};

const parking: Tariff = {
  e: [{ c: [['E', 0.3]] }, { c: [['P', 0]], r: { maxD: 60 } }, { c: [['P', 3]] }],
};

const EVENING = new Date('2026-11-04T16:00:00Z');
const NOON = new Date('2026-11-04T10:00:00Z');

describe('charging prices', () => {
  it('reads the Finnish clock', () => {
    expect(finnishClock(EVENING)).toEqual({ day: 2, time: '18:00' });
  });

  it('picks the price of the hour', () => {
    expect(priceNow(tesla, 250, EVENING).energy).toBe(0.5146);
    expect(priceNow(tesla, 250, NOON).energy).toBe(0.4393);
  });

  it('shows when a fee starts during the session', () => {
    expect(priceNow(tesla, 250, NOON).congestion).toEqual([
      { fromMin: 0, price: 0 },
      { fromMin: 5, price: 37.65 },
    ]);
    expect(priceNow(parking, 22, NOON).parking).toEqual([
      { fromMin: 0, price: 0 },
      { fromMin: 60, price: 3 },
    ]);
    expect(priceNow(parking, 22, NOON).time).toBeUndefined();
  });
});

const site: ChargerSite = {
  id: 's',
  n: 'Prisma',
  o: 0,
  a: 'Katu 1, Tampere',
  x: 23.76,
  y: 61.5,
  e: [
    ['E1', [['ccs', 150, 0], ['chademo', 50, 0]]],
    ['E2', [['ccs', 150, 0]]],
    ['E3', [['t2', 22, -1]]],
  ],
};

describe('charger sites', () => {
  const status: ChargerStatus = { updated: '', busy: { E1: 'C', E3: 'O' } };

  it('counts free charge points', () => {
    expect(summarize(site, status)).toMatchObject({ maxKw: 150, total: 3, free: 1, state: 'free' });
    expect(summarize(site).state).toBe('unknown');
    expect(summarize(site, { updated: '', busy: { E1: 'C', E2: 'C', E3: 'O' } }).state).toBe('busy');
  });

  it('groups connectors by plug and power', () => {
    const groups = connectorGroups(site, status);
    expect(groups.map((g) => [g.plug, g.kw, g.total, g.free])).toEqual([
      ['ccs', 150, 2, 1],
      ['chademo', 50, 1, 0],
      ['t2', 22, 1, 0],
    ]);
  });

  it('filters by plug, power and what is free', () => {
    expect(matches(site, { ...NO_FILTER, plug: 'chademo' }, status)).toBe(true);
    expect(matches(site, { ...NO_FILTER, plug: 'chademo', freeOnly: true }, status)).toBe(false);
    expect(matches(site, { ...NO_FILTER, plug: 'type2', fastOnly: true }, status)).toBe(false);
  });
});
