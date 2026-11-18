import { describe, expect, it } from 'vitest';
import { parseVehicle } from './api';
import { mergeDepartures, stationName } from './departures';
import { fold, searchLines, searchStops } from './search';
import { formatClock, parseDelay, serviceDay } from './time';
import { runsOn, upcomingDepartures } from './timetable';
import type { Line, ScheduledDeparture, Service, Stop, TimetableGroup, Vehicle } from './types';

const at = (iso: string) => Date.parse(iso);
const everyDay: Service = { days: '1111111', start: 20260101, end: 20271231, add: [], remove: [] };

describe('parseDelay', () => {
  it('reads late, early and on-time values', () => {
    expect(parseDelay('P0Y0M0DT0H1M51.000S')).toBe(111);
    expect(parseDelay('-P0Y0M0DT0H0M16.000S')).toBe(-16);
    expect(parseDelay('P0Y0M0DT0H0M0.000S')).toBe(0);
    expect(parseDelay(undefined)).toBe(0);
    expect(parseDelay('nonsense')).toBe(0);
  });
});

describe('serviceDay', () => {
  it('starts at Helsinki midnight in winter and summer', () => {
    expect(serviceDay(at('2026-11-01T12:00:00Z')).startMs).toBe(at('2026-10-31T22:00:00Z'));
    expect(serviceDay(at('2026-07-01T12:00:00Z')).startMs).toBe(at('2026-06-30T21:00:00Z'));
  });

  it('uses the Helsinki date, not the UTC date', () => {
    const day = serviceDay(at('2026-10-31T22:30:00Z'));
    expect(day.date).toBe(20261101);
    expect(day.weekday).toBe(6);
  });

  it('crosses month boundaries with an offset', () => {
    expect(serviceDay(at('2026-12-31T12:00:00Z'), 1).date).toBe(20270101);
    expect(serviceDay(at('2026-03-01T12:00:00Z'), -1).date).toBe(20260228);
  });

  it('follows the GTFS noon-minus-12h rule when clocks change', () => {
    const day = serviceDay(at('2026-10-25T12:00:00Z'));
    expect(day.startMs).toBe(at('2026-10-24T22:00:00Z'));
    expect(formatClock(day.startMs + 12 * 3600 * 1000)).toBe('12:00');
  });
});

describe('runsOn', () => {
  const day = serviceDay(at('2026-11-02T10:00:00Z'));
  it('respects weekdays, range and exceptions', () => {
    expect(runsOn(everyDay, day)).toBe(true);
    expect(runsOn({ ...everyDay, days: '0111111' }, day)).toBe(false);
    expect(runsOn({ ...everyDay, days: '0000000', add: [20261102] }, day)).toBe(true);
    expect(runsOn({ ...everyDay, remove: [20261102] }, day)).toBe(false);
    expect(runsOn({ ...everyDay, end: 20261101 }, day)).toBe(false);
    expect(runsOn(undefined, day)).toBe(false);
  });
});

describe('upcomingDepartures', () => {
  const groups: TimetableGroup[] = [
    { line: '3', headsign: 'Hervanta', services: ['a'], times: [28800, 600, 58800] },
  ];

  it('decodes deltas and limits to the horizon', () => {
    const from = at('2026-11-02T06:05:00Z');
    const result = upcomingDepartures(groups, { a: everyDay }, from, 3600_000);
    expect(result.map((d) => formatClock(d.time))).toEqual(['08:10']);
  });

  it("includes yesterday's after-midnight trips", () => {
    const from = at('2026-11-02T22:10:00Z');
    const result = upcomingDepartures(groups, { a: everyDay }, from, 3600_000);
    expect(result).toHaveLength(1);
    expect(formatClock(result[0].time)).toBe('00:30');
  });

  it('ignores services that do not run', () => {
    const from = at('2026-11-02T06:05:00Z');
    expect(upcomingDepartures(groups, { a: { ...everyDay, days: '0000000' } }, from, 3600_000)).toEqual([]);
  });
});

const vehicle = (over: Partial<Vehicle>): Vehicle => ({
  ref: 'v1',
  line: '3',
  mode: 'tram',
  lat: 61.5,
  lon: 23.7,
  bearing: 0,
  speedKmh: 20,
  delaySec: 0,
  destinationStop: '9999',
  onward: [],
  ...over,
});

describe('mergeDepartures', () => {
  const now = at('2026-11-02T08:00:00Z');
  const min = 60_000;
  const scheduled: ScheduledDeparture[] = [
    { line: '3', headsign: 'Hervanta', time: now + 5 * min },
    { line: '3', headsign: 'Hervanta', time: now + 15 * min },
    { line: '5', headsign: 'Vuores', time: now + 7 * min },
  ];
  const noName = () => undefined;

  it('replaces the matching timetable entry with the live prediction', () => {
    const late = vehicle({ delaySec: 120, onward: [{ stopId: 'S', time: now + 7 * min, order: 3 }] });
    const result = mergeDepartures('S', scheduled, [late], now, noName);
    expect(result).toHaveLength(3);
    const live = result.filter((d) => d.line === '3' && d.live);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ time: now + 7 * min, scheduled: now + 5 * min, delaySec: 120, headsign: 'Hervanta' });
  });

  it('does not match a vehicle of another line', () => {
    const other = vehicle({ line: '5', onward: [{ stopId: 'S', time: now + 15 * min, order: 3 }] });
    const result = mergeDepartures('S', scheduled, [other], now, noName);
    expect(result.filter((d) => d.line === '3')).toHaveLength(2);
    expect(result.filter((d) => d.line === '5')).toHaveLength(2);
  });

  it('keeps a very late vehicle after its scheduled time has passed', () => {
    const past: ScheduledDeparture[] = [{ line: '3', headsign: 'Hervanta', time: now - 4 * min }];
    const late = vehicle({ delaySec: 300, onward: [{ stopId: 'S', time: now + min, order: 2 }] });
    const result = mergeDepartures('S', past, [late], now, noName);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ live: true, headsign: 'Hervanta' });
  });

  it('skips vehicles ending their trip at this stop or already gone', () => {
    const terminating = vehicle({ destinationStop: 'S', onward: [{ stopId: 'S', time: now + min, order: 9 }] });
    const gone = vehicle({ ref: 'v2', onward: [{ stopId: 'S', time: now - 5 * min, order: 9 }] });
    expect(mergeDepartures('S', [], [terminating, gone], now, noName)).toEqual([]);
  });

  it('drops scheduled trips in the past and sorts by time', () => {
    const result = mergeDepartures('S', [{ line: '1', headsign: 'A', time: now - min }, ...scheduled], [], now, noName);
    expect(result.map((d) => d.time)).toEqual([now + 5 * min, now + 7 * min, now + 15 * min]);
  });

  it('names a vehicle with no timetable match after its destination', () => {
    const extra = vehicle({ line: '99', onward: [{ stopId: 'S', time: now + min, order: 1 }] });
    expect(mergeDepartures('S', [], [extra], now, () => 'Rauhaniemi')[0].headsign).toBe('Rauhaniemi');
  });
});

describe('stationName', () => {
  it('strips only platform suffixes', () => {
    expect(stationName('Keskustori H')).toBe('Keskustori');
    expect(stationName('Sorin aukio D')).toBe('Sorin aukio');
    expect(stationName('Hervannan kampus A1')).toBe('Hervannan kampus');
    expect(stationName('Tampere-talo')).toBe('Tampere-talo');
  });
});

describe('search', () => {
  const stop = (id: string, name: string): Stop => ({
    id, code: id, name, lat: 61.5, lon: 23.7, zone: 'A', city: 'Tampere', lines: [],
  });
  const stops = [stop('0001', 'Keskustori H'), stop('0002', 'Näsilinnankatu'), stop('0003', 'Vanha Keskustori')];

  it('folds Finnish letters', () => {
    expect(fold(' Näsilinna ')).toBe('nasilinna');
    expect(searchStops(stops, 'nasi').map((s) => s.id)).toEqual(['0002']);
  });

  it('ranks prefix matches first and matches stop codes', () => {
    expect(searchStops(stops, 'kesk').map((s) => s.id)).toEqual(['0001', '0003']);
    expect(searchStops(stops, '0002').map((s) => s.id)).toEqual(['0002']);
    expect(searchStops(stops, '  ')).toEqual([]);
  });

  it('puts an exact line number first', () => {
    const lines: Line[] = [
      { id: '13', name: 'Lintuhytti - Tays', mode: 'bus' },
      { id: '3', name: 'Hervanta - Sorin aukio', mode: 'tram' },
    ];
    expect(searchLines(lines, '3').map((l) => l.id)).toEqual(['3']);
    expect(searchLines(lines, 'herv').map((l) => l.id)).toEqual(['3']);
  });
});

describe('parseVehicle', () => {
  const raw = {
    lineRef: '3',
    vehicleRef: '56920_12',
    operatorRef: '56920',
    vehicleLocation: { latitude: '61.5', longitude: '23.7' },
    bearing: '21.0',
    speed: '0.5',
    delay: '-P0Y0M0DT0H0M6.000S',
    destinationShortName: '0840',
    onwardCalls: [
      { stopPointRef: 'https://x/stop-points/0024', expectedDepartureTime: '2026-11-01T17:52:06Z', order: '1' },
      { stopPointRef: 'https://x/stop-points/0025', expectedArrivalTime: '2026-11-01T17:53:00Z', order: '2' },
      { stopPointRef: 'https://x/stop-points/0026', order: '3' },
    ],
  };

  it('normalises the feed, keeping calls that have a time', () => {
    const v = parseVehicle(raw, () => undefined)!;
    expect(v).toMatchObject({ ref: '56920_12', mode: 'tram', delaySec: -6, bearing: 21 });
    expect(v.onward.map((c) => c.stopId)).toEqual(['0024', '0025']);
  });

  it('prefers the mode from static data', () => {
    expect(parseVehicle(raw, () => 'bus')!.mode).toBe('bus');
  });

  it('rejects records without a usable position', () => {
    expect(parseVehicle({ ...raw, vehicleLocation: {} }, () => undefined)).toBeNull();
  });
});
