import { describe, expect, it } from 'vitest';
import { stopsOf, trainProgress } from './longTrains';

const row = (code: string, type: 'ARRIVAL' | 'DEPARTURE', time: string, extra: object = {}) => ({
  stationShortCode: code,
  type,
  scheduledTime: `2026-11-04T${time}:00.000Z`,
  commercialStop: true,
  ...extra,
});

describe('long-distance trains', () => {
  it('pairs arrivals and departures into one stop per station', () => {
    const stops = stopsOf([row('HKI', 'DEPARTURE', '10:00'), row('PSL', 'ARRIVAL', '10:05'), row('PSL', 'DEPARTURE', '10:06'), row('TPE', 'ARRIVAL', '11:40')]);
    expect(stops.map((s) => s.code)).toEqual(['HKI', 'PSL', 'TPE']);
    expect(stops[1].arrival?.scheduled).toBe(Date.parse('2026-11-04T10:05:00.000Z'));
    expect(stops[1].departure?.scheduled).toBe(Date.parse('2026-11-04T10:06:00.000Z'));
    expect(stops[2].departure).toBeUndefined();
  });

  it('finds the next stop and its delay', () => {
    const stops = stopsOf([
      row('HKI', 'DEPARTURE', '10:00', { actualTime: '2026-11-04T10:01:00.000Z', differenceInMinutes: 1 }),
      row('PSL', 'ARRIVAL', '10:05', { liveEstimateTime: '2026-11-04T10:09:00.000Z', differenceInMinutes: 4 }),
      row('PSL', 'DEPARTURE', '10:06', { liveEstimateTime: '2026-11-04T10:10:00.000Z', differenceInMinutes: 4 }),
      row('TPE', 'ARRIVAL', '11:40'),
    ]);
    expect(trainProgress(stops)).toEqual({ next: 1, delay: 4 });
  });

  it('stays on the last stop once the train has arrived', () => {
    const stops = stopsOf([
      row('HKI', 'DEPARTURE', '10:00', { actualTime: '2026-11-04T10:00:00.000Z', differenceInMinutes: 0 }),
      row('TPE', 'ARRIVAL', '11:40', { actualTime: '2026-11-04T11:42:00.000Z', differenceInMinutes: 2 }),
    ]);
    expect(trainProgress(stops)).toEqual({ next: 1, delay: 2 });
  });
});
