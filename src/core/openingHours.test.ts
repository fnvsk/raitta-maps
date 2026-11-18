import { describe, expect, it } from 'vitest';
import { openNow, parseOpeningHours } from './openingHours';

const at = (clock: string) => new Date(`2026-11-04T${clock}:00`);

describe('opening hours', () => {
  it('reads days and hours', () => {
    const rules = parseOpeningHours('Mo,Tu 17:00-22:00; We-Su 12:00-22:00')!;
    expect(rules).toEqual([
      { days: [0, 1], spans: [[1020, 1320]] },
      { days: [2, 3, 4, 5, 6], spans: [[720, 1320]] },
    ]);
    expect(openNow(rules, at('13:00'))).toEqual({ open: true, until: 1320 });
    expect(openNow(rules, at('10:00'))).toEqual({ open: false, from: 720 });
  });

  it('knows round the clock and past midnight', () => {
    expect(openNow(parseOpeningHours('24/7')!, at('03:00')).open).toBe(true);
    const late = parseOpeningHours('Mo-Su 06:00-24:00')!;
    expect(openNow(late, at('23:30'))).toEqual({ open: true, until: 0 });
    const bar = parseOpeningHours('Tu 20:00-02:00')!;
    expect(openNow(bar, at('01:00')).open).toBe(true);
  });

  it('gives up on what it cannot read', () => {
    expect(parseOpeningHours('sunrise-sunset')).toBeNull();
    expect(parseOpeningHours('Mo-Fr 08:00-17:00; Dec 24 off')).toBeNull();
  });
});

describe('week rows', () => {
  it('joins days with the same hours', async () => {
    const { weekRows } = await import('./openingHours');
    expect(weekRows(parseOpeningHours('Mo-Fr 08:00-21:00; Sa 10:00-18:00')!)).toEqual([
      { from: 0, to: 4, spans: [[480, 1260]] },
      { from: 5, to: 5, spans: [[600, 1080]] },
      { from: 6, to: 6, spans: [] },
    ]);
  });
});

describe('rules apart with commas', () => {
  it('reads "Mo-Th 10:00-20:00, Fr-Sa 10:00-20:30, Su 11:00-19:30"', () => {
    const rules = parseOpeningHours('Mo-Th 10:00-20:00, Fr-Sa 10:00-20:30, Su 11:00-19:30');
    expect(rules).toEqual([
      { days: [0, 1, 2, 3], spans: [[600, 1200]] },
      { days: [4, 5], spans: [[600, 1230]] },
      { days: [6], spans: [[660, 1170]] },
    ]);
  });

  it('keeps day lists with commas as they are', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-21:00; Sa,Su 10:00-18:00')?.[1].days).toEqual([5, 6]);
  });

  it('leaves public holidays out rather than giving up', () => {
    expect(parseOpeningHours('Mo-Fr 09:00-17:00; PH off')).toEqual([{ days: [0, 1, 2, 3, 4], spans: [[540, 1020]] }]);
  });
});

describe('seasons', () => {
  const sauna = 'Jan-Apr, Oct-Dec Mo-Fr 14:00-21:00; Sa, Su 12:00-21:00';

  it('reads the winter hours in winter', () => {
    expect(parseOpeningHours(sauna, new Date(2026, 10, 10))).toEqual([
      { days: [0, 1, 2, 3, 4], spans: [[840, 1260]] },
      { days: [5, 6], spans: [[720, 1260]] },
    ]);
  });

  it('leaves them out in summer', () => {
    expect(parseOpeningHours(sauna, new Date(2026, 6, 1))).toEqual([{ days: [5, 6], spans: [[720, 1260]] }]);
  });

  it('knows a season over New Year and a closed season', () => {
    expect(parseOpeningHours('Nov-Feb 10:00-16:00', new Date(2027, 0, 5))?.[0].spans).toEqual([[600, 960]]);
    expect(parseOpeningHours('Mo-Su 09:00-18:00; Jun-Aug: off', new Date(2026, 6, 1))).toEqual([{ days: [0, 1, 2, 3, 4, 5, 6], spans: [] }]);
  });
});
