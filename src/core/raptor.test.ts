import { describe, expect, it } from 'vitest';
import { activeStarts, buildNetwork, laterDepartures, orderJourneys, planJourneys, walkingTime, type RawRoute } from './raptor';
import { serviceDay } from './time';
import type { Service, Stop } from './types';

const everyDay: Service = { days: '1111111', start: 20260101, end: 20271231, add: [], remove: [] };
const services = { a: everyDay };
const now = Date.parse('2026-11-02T08:00:00Z');
const start = serviceDay(now).startMs;
const clock = (hour: number, minute = 0) => hour * 3600 + minute * 60;
const nowS = Math.floor((now - start) / 1000);

const stop = (id: string, lat: number, lon = 23.7): Stop => ({
  id,
  code: id,
  name: id,
  lat,
  lon,
  zone: '',
  city: '',
  lines: [],
});

const route = (line: string, stops: number[], perStop: number, startsAt: number[]): RawRoute => ({
  l: line,
  h: `to ${line}`,
  s: stops,
  o: stops.map((_, i) => (i === 0 ? 0 : perStop)),
  t: [{ v: ['a'], d: startsAt.map((t, i) => (i === 0 ? t : t - startsAt[i - 1])) }],
});

const A = 0;
const B = 1;
const TRAM_STOP = 2;
const C = 3;
const FAR = 4;
const stops = [stop('A', 61.4), stop('B', 61.42), stop('Tram', 61.422), stop('C', 61.44), stop('Far', 61.5)];
const from = { lat: 61.4, lon: 23.7 };
const to = { lat: 61.44, lon: 23.7 };

function plan(routes: RawRoute[], origin = from, destination = to) {
  const network = buildNetwork(stops, routes);
  return planJourneys(network, activeStarts(network, services, now), origin, destination, nowS);
}

describe('planJourneys', () => {
  it('finds a direct ride at its real time', () => {
    const [best] = plan([route('5', [A, B, C], 300, [clock(9, 50), clock(10, 5), clock(10, 20)])]);
    expect(best.legs).toHaveLength(1);
    expect(best.legs[0]).toMatchObject({ line: '5', from: A, to: C, departure: clock(10, 5), arrival: clock(10, 15) });
  });

  it('changes from a bus to a tram at a stop with another name', () => {
    const [best] = plan([
      route('5', [A, B], 300, [clock(10, 2)]),
      route('T3', [TRAM_STOP, C], 300, [clock(10, 5), clock(10, 12), clock(10, 20)]),
    ]);
    expect(best.legs.map((leg) => leg.line)).toEqual(['5', 'T3']);
    expect(best.legs[1].from).toBe(TRAM_STOP);
    expect(best.legs[1].walkBefore).toBeGreaterThan(0);
  });

  it('leaves time to make the change', () => {
    const [best] = plan([
      route('5', [A, B], 300, [clock(10, 2)]),

      route('T3', [TRAM_STOP, C], 300, [clock(10, 8), clock(10, 15)]),
    ]);
    expect(best.legs[1].departure).toBe(clock(10, 15));
  });

  it('never rides against the direction of travel', () => {
    expect(plan([route('5', [C, B, A], 300, [clock(10, 5)])])).toEqual([]);
  });

  it('offers the slower direct option alongside a faster change', () => {
    const journeys = plan([
      route('9', [A, C], 2400, [clock(10, 5)]),
      route('5', [A, B], 120, [clock(10, 3)]),
      route('T3', [TRAM_STOP, C], 120, [clock(10, 12)]),
    ]);
    const shapes = journeys.map((j) => j.legs.map((leg) => leg.line).join('+'));
    expect(shapes).toContain('9');
    expect(shapes).toContain('5+T3');
  });

  it('surfaces other lines instead of repeating the same journey', () => {
    const journeys = plan([
      route('5', [A, C], 300, [clock(10, 2), clock(10, 12), clock(10, 22)]),
      route('T3', [A, C], 360, [clock(10, 3), clock(10, 13)]),
      route('8', [A, C], 420, [clock(10, 4)]),
    ]);
    expect(journeys.map((j) => j.legs[0].line).sort()).toEqual(['5', '8', 'T3']);
  });

  it('can use up to three changes when nothing simpler exists', () => {
    const chain = [stop('s0', 61.0), stop('s1', 61.1), stop('s2', 61.2), stop('s3', 61.3), stop('s4', 61.4)];
    const network = buildNetwork(chain, [
      route('a', [0, 1], 300, [clock(10, 2)]),
      route('b', [1, 2], 300, [clock(10, 10)]),
      route('c', [2, 3], 300, [clock(10, 20)]),
      route('d', [3, 4], 300, [clock(10, 30)]),
    ]);
    const [best] = planJourneys(network, activeStarts(network, services, now), { lat: 61, lon: 23.7 }, { lat: 61.4, lon: 23.7 }, nowS);
    expect(best.legs.map((leg) => leg.line)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns nothing when no service runs', () => {
    const network = buildNetwork(stops, [route('5', [A, C], 300, [clock(10, 5)])]);
    const idle = activeStarts(network, { a: { ...everyDay, days: '0000000' } }, now);
    expect(planJourneys(network, idle, from, to, nowS)).toEqual([]);
  });

  it('accounts for the walk to the first stop', () => {
    const near = { lat: 61.402, lon: 23.7 };

    const [best] = plan([route('5', [A, C], 300, [clock(10, 2), clock(10, 20)])], near);
    expect(best.legs[0].departure).toBe(clock(10, 20));
    expect(best.leaveAt).toBeLessThan(best.legs[0].departure);
  });

  it('catches trips left over from the previous service day', () => {
    const late = Date.parse('2026-11-02T22:10:00Z');
    const network = buildNetwork(stops, [route('N1', [A, C], 300, [clock(24, 30)])]);
    const lateStart = serviceDay(late).startMs;
    const [best] = planJourneys(network, activeStarts(network, services, late), from, to, Math.floor((late - lateStart) / 1000));
    expect(best.legs[0].departure).toBe(clock(0, 30));
  });
});

describe('walkingTime', () => {
  it('offers walking only for short distances', () => {
    expect(walkingTime({ lat: 61.5, lon: 23.7 }, { lat: 61.505, lon: 23.7 })).toBeGreaterThan(0);
    expect(walkingTime({ lat: 61.5, lon: 23.7 }, { lat: 61.6, lon: 23.7 })).toBeNull();
  });
});

describe('unused stops', () => {
  it('ignores stops with no routes', () => {
    expect(FAR).toBe(4);
    expect(plan([route('5', [A, C], 300, [clock(10, 5)])])[0].legs).toHaveLength(1);
  });
});

describe('journey sense', () => {
  const near = { lat: 61.4401, lon: 23.7 };

  it('prefers the line that stops at the destination over a faster one and a long walk', () => {
    const farTram = stop('FarTram', 61.4475);
    const here = [stop('Start', 61.4), stop('Hub', 61.42), stop('Dest', 61.44), farTram];
    const network = buildNetwork(here, [
      route('2', [0, 1], 300, [clock(10, 2)]),
      route('1', [1, 2], 420, [clock(10, 12)]),
      route('3', [1, 3], 300, [clock(10, 11)]),
    ]);
    const [best] = planJourneys(network, activeStarts(network, services, now), from, near, nowS);
    expect(best.legs.map((leg) => leg.line)).toEqual(['2', '1']);
  });

  it('finds the alternative for the last leg, not only the first', () => {
    const here = [stop('Start', 61.4), stop('Hub', 61.42), stop('Dest', 61.44)];
    const network = buildNetwork(here, [
      route('2', [0, 1], 300, [clock(10, 2)]),
      route('1', [1, 2], 300, [clock(10, 12)]),
      route('3', [1, 2], 300, [clock(10, 13)]),
    ]);
    const shapes = planJourneys(network, activeStarts(network, services, now), from, near, nowS).map((j) =>
      j.legs.map((leg) => leg.line).join('+'),
    );
    expect(shapes).toContain('2+1');
    expect(shapes).toContain('2+3');
  });

  it('refuses a destination beyond the network instead of walking there', () => {
    const network = buildNetwork(stops, [route('5', [A, C], 300, [clock(10, 5)])]);
    const helsinki = { lat: 60.17, lon: 24.94 };
    expect(planJourneys(network, activeStarts(network, services, now), from, helsinki, nowS)).toEqual([]);
  });

  it('refuses a departure days away', () => {
    const network = buildNetwork(stops, [route('5', [A, C], 300, [clock(23, 50)])]);
    expect(planJourneys(network, activeStarts(network, services, now), from, to, clock(2))).toEqual([]);
  });

  it('lists the next departures of the same vehicle', () => {
    const network = buildNetwork(stops, [route('5', [A, C], 300, [clock(10, 5), clock(10, 20), clock(10, 35)])]);
    const starts = activeStarts(network, services, now);
    const [best] = planJourneys(network, starts, from, to, nowS);
    expect(laterDepartures(starts, best, 2)).toEqual([clock(10, 20), clock(10, 35)]);
  });
});

describe('short trips', () => {
  it('still offers a ride when a stop is within walking distance of both ends', () => {
    const start = { lat: 61.4, lon: 23.7 };
    const end = { lat: 61.408, lon: 23.7 };
    const here = [stop('Near start', 61.4005), stop('Between', 61.404), stop('Near end', 61.4075)];
    const network = buildNetwork(here, [route('5', [0, 1, 2], 120, [clock(10, 2)])]);
    const journeys = planJourneys(network, activeStarts(network, services, now), start, end, nowS);
    expect(journeys.map((j) => j.legs[0].line)).toEqual(['5']);
  });

  it('does not count tomorrow as a later departure', () => {
    const network = buildNetwork(stops, [route('5', [A, C], 300, [clock(10, 5), clock(23, 0)])]);
    const starts = activeStarts(network, services, now);
    const [best] = planJourneys(network, starts, from, to, nowS);
    expect(laterDepartures(starts, best, 2)).toEqual([]);
  });
});

describe('rider preferences', () => {
  const here = [stop('Start', 61.4), stop('Hub', 61.42), stop('Dest', 61.44), stop('Slow start', 61.4001)];
  const network = buildNetwork(here, [
    route('A', [0, 1], 240, [clock(10, 2)]),
    route('B', [1, 2], 240, [clock(10, 8)]),
    route('C', [3, 2], 840, [clock(10, 3)]),
  ]);
  const near = { lat: 61.44, lon: 23.7 };

  it('takes the faster journey with a change by default', () => {
    const [best] = planJourneys(network, activeStarts(network, services, now), from, near, nowS);
    expect(best.legs.map((leg) => leg.line)).toEqual(['A', 'B']);
  });

  it('takes the direct journey when asked for fewer changes', () => {
    const [best] = planJourneys(network, activeStarts(network, services, now), from, near, nowS, { preference: 'fewerChanges' });
    expect(best.legs.map((leg) => leg.line)).toEqual(['C']);
  });

  it('counts a slower walk in access and whole-trip times', () => {
    const nearby = { lat: 61.3996, lon: 23.7 };
    const slow = planJourneys(network, activeStarts(network, services, now), nearby, near, nowS, { pace: 1.35 });
    const usual = planJourneys(network, activeStarts(network, services, now), nearby, near, nowS);
    expect(slow[0].walkStartS).toBeGreaterThan(usual[0].walkStartS);
    expect(walkingTime(from, to, 1.35)! > walkingTime(from, to)!).toBe(true);
  });
});

describe('sensible boarding', () => {
  it('boards at the stop next to the rider, not where the vehicle started', () => {
    const here = [stop('Terminus', 61.4045), stop('Near rider', 61.4002), stop('Dest', 61.44)];
    const network = buildNetwork(here, [route('2', [0, 1, 2], 120, [clock(10, 5)])]);
    const [best] = planJourneys(network, activeStarts(network, services, now), from, to, nowS);
    expect(best.legs[0].from).toBe(1);
  });

  it('offers no ride when walking there is quicker', () => {
    const here = [stop('Start', 61.4), stop('Next door', 61.4004)];
    const network = buildNetwork(here, [route('11', [0, 1], 60, [clock(10, 1)])]);
    expect(planJourneys(network, activeStarts(network, services, now), from, { lat: 61.4003, lon: 23.7 }, nowS)).toEqual([]);
  });
});

describe('journey list', () => {
  const here = [stop('Start', 61.4), stop('Hub', 61.42), stop('Dest', 61.44)];
  const network = buildNetwork(here, [
    route('A', [0, 1], 240, [clock(10, 2)]),
    route('B', [1, 2], 240, [clock(10, 8)]),
    route('C', [0, 2], 840, [clock(10, 3)]),
  ]);
  const near = { lat: 61.44, lon: 23.7 };

  it('keeps slower options too, for the rider to choose from', () => {
    const lines = planJourneys(network, activeStarts(network, services, now), from, near, nowS).map((j) => j.legs.map((l) => l.line).join('+'));
    expect(lines).toEqual(expect.arrayContaining(['A+B', 'C']));
  });

  it('puts the direct ride first when asked for fewer changes', () => {
    const journeys = planJourneys(network, activeStarts(network, services, now), from, near, nowS);
    expect(orderJourneys(journeys, 'fewerChanges')[0].legs.map((l) => l.line)).toEqual(['C']);
    expect(orderJourneys(journeys, 'earliest')[0].legs.map((l) => l.line)).toEqual(['A', 'B']);
  });
});

describe('arriving by a time', () => {
  const here = [stop('Start', 61.4), stop('Dest', 61.44)];

  const network = buildNetwork(here, [route('5', [0, 1], 720, [clock(9), clock(9, 15), clock(9, 30), clock(9, 45), clock(10), clock(10, 15)])]);
  const near = { lat: 61.44, lon: 23.7 };

  it('leaves as late as possible and still arrives in time', async () => {
    const { planArrivingBy } = await import('./raptor');
    const [journey] = planArrivingBy(network, activeStarts(network, services, now), from, near, clock(10, 5));
    expect(journey.legs[0].departure).toBe(clock(9, 45));
    expect(journey.arriveAt).toBeLessThanOrEqual(clock(10, 5));
  });

  it('finds nothing when no trip can make it', async () => {
    const { planArrivingBy } = await import('./raptor');
    expect(planArrivingBy(network, activeStarts(network, services, now), from, near, clock(9, 5))).toEqual([]);
  });
});

describe('around a chosen time', () => {
  const here = [stop('Start', 61.4), stop('Dest', 61.44)];

  const times = [0, 10, 20, 30, 40, 50, 60].map((m) => clock(9, 30) + m * 60);
  const network = buildNetwork(here, [route('5', [0, 1], 720, times)]);
  const near = { lat: 61.44, lon: 23.7 };

  it('shows departures from 15 minutes before to 15 minutes after', async () => {
    const { planAround } = await import('./raptor');
    const leaving = planAround(network, activeStarts(network, services, now), from, near, clock(10)).map((j) => j.legs[0].departure);
    expect(leaving).toEqual([clock(9, 50), clock(10), clock(10, 10)]);
  });
});

describe('only trips still to come', () => {
  const here = [stop('Start', 61.4), stop('Dest', 61.44)];
  const times = [0, 10, 20, 30, 40, 50, 60].map((m) => clock(9, 30) + m * 60);
  const network = buildNetwork(here, [route('5', [0, 1], 720, times)]);
  const near = { lat: 61.44, lon: 23.7 };

  it('leaves out departures before now', async () => {
    const { planAround } = await import('./raptor');
    const leaving = planAround(network, activeStarts(network, services, now), from, near, clock(10), { notBefore: clock(9, 55) }).map((j) => j.legs[0].departure);
    expect(leaving).toEqual([clock(10), clock(10, 10)]);
  });
});

describe('direct rides', () => {
  const places = [stop('Home', 61.4), stop('Hub', 61.42), stop('Work', 61.44), stop('Slow start', 61.409)];
  const network = buildNetwork(places, [
    route('1', [0, 1], 300, [clock(10, 2)]),
    route('2', [1, 2], 300, [clock(10, 10)]),
    route('14', [3, 1, 2], 900, [clock(10, 20)]),
  ]);
  const starts = activeStarts(network, services, now);

  it('keeps a bus that needs no change, even when a quicker trip with a change exists', () => {
    const lines = planJourneys(network, starts, from, to, nowS).map((journey) => journey.legs.map((leg) => leg.line).join('>'));
    expect(lines).toContain('1>2');
    expect(lines).toContain('14');
  });

  it('lists every option, the one leaving first on top', () => {
    const all = orderJourneys(planJourneys(network, starts, from, to, nowS, { all: true }), 'all');
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.map((journey) => journey.leaveAt)).toEqual([...all.map((journey) => journey.leaveAt)].sort((a, b) => a - b));
  });
});

describe('one change', () => {
  const places = [stop('Home', 61.4), stop('Hub', 61.42), stop('Work', 61.44), stop('Hub bus', 61.4205)];
  const network = buildNetwork(places, [
    route('1', [0, 1], 300, [clock(10, 2)]),
    route('2', [1, 2], 300, [clock(10, 10)]),
    route('14', [3, 2], 400, [clock(10, 12)]),
  ]);
  const starts = activeStarts(network, services, now);

  it('finds every pair of lines with one change', () => {
    const lines = planJourneys(network, starts, from, to, nowS, { all: true }).map((journey) => journey.legs.map((leg) => leg.line).join('>'));
    expect(lines).toEqual(expect.arrayContaining(['1>2', '1>14']));
  });
});

describe('leaving as late as works', () => {
  const places = [stop('Home', 61.4), stop('Hub', 61.42), stop('Work', 61.44)];
  const network = buildNetwork(places, [
    route('1', [0, 1], 300, [clock(10, 2), clock(10, 7), clock(10, 12), clock(10, 17), clock(10, 22), clock(10, 27), clock(10, 32)]),
    route('14', [1, 2], 300, [clock(10, 40)]),
  ]);
  const starts = activeStarts(network, services, now);

  it('takes the last tram that still meets the bus, not the first one', () => {
    const trip = planJourneys(network, starts, from, to, nowS).find((journey) => journey.legs.map((leg) => leg.line).join('>') === '1>14');
    expect(trip?.legs[0].departure).toBe(clock(10, 32));
    expect(trip?.arriveAt).toBeGreaterThanOrEqual(clock(10, 45));
  });
});

describe('needless changes', () => {
  const places = [stop('Home', 61.4), stop('Hub', 61.42), stop('Work', 61.44)];
  const network = buildNetwork(places, [
    route('7', [0, 1], 120, [clock(10, 2)]),
    route('14', [0, 1, 2], 400, [clock(10, 6)]),
  ]);
  const starts = activeStarts(network, services, now);

  it('drops a ride that only catches up with the bus the rider could board at home', () => {
    const lines = planJourneys(network, starts, from, to, nowS, { all: true }).map((journey) => journey.legs.map((leg) => leg.line).join('>'));
    expect(lines).toContain('14');
    expect(lines).not.toContain('7>14');
  });
});

describe('walks along the streets', () => {
  const places = [stop('Across', 61.4005), stop('Bridge side', 61.3995), stop('Work', 61.44)];
  const network = buildNetwork(places, [route('A', [0, 2], 600, [clock(10, 5)]), route('B', [1, 2], 600, [clock(10, 9)])]);
  const starts = activeStarts(network, services, now);

  it('takes the stop on its own side when the other is a long way round', () => {
    const plain = planJourneys(network, starts, from, to, nowS).map((journey) => journey.legs[0].line);
    expect(plain[0]).toBe('A');
    const walks = { from: new Map([[0, 1900], [1, 60]]) };
    const [first] = planJourneys(network, starts, from, to, nowS, { walks });
    expect(first.legs[0].line).toBe('B');
    expect(first.walkStartS).toBe(Math.ceil(60 / 1.25));
  });
});
