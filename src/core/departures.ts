import type { Departure, ScheduledDeparture, Vehicle } from './types';

const MATCH_WINDOW_MS = 120_000;

const DEPARTED_GRACE_MS = 30_000;

export const stationName = (name: string) => name.replace(/\s+[A-Z]\d?$/, '');

export function mergeDepartures(
  stopId: string,
  scheduled: ScheduledDeparture[],
  vehicles: Vehicle[],
  now: number,
  destinationName: (stopId: string) => string | undefined,
): Departure[] {
  const remaining = [...scheduled];
  const out: Departure[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.destinationStop === stopId) continue;
    const call = vehicle.onward.find((c) => c.stopId === stopId);
    if (!call || call.time < now - DEPARTED_GRACE_MS) continue;

    const delaySec = vehicle.delaySec ?? 0;
    const scheduledTime = call.time - delaySec * 1000;
    let best = -1;
    let bestGap = MATCH_WINDOW_MS;
    remaining.forEach((entry, i) => {
      const gap = Math.abs(entry.time - scheduledTime);
      if (entry.line === vehicle.line && gap <= bestGap) {
        best = i;
        bestGap = gap;
      }
    });
    const matched = best >= 0 ? remaining.splice(best, 1)[0] : undefined;
    const headsign =
      matched?.headsign ?? destinationName(vehicle.destinationStop) ?? scheduled.find((s) => s.line === vehicle.line)?.headsign;

    out.push({
      line: vehicle.line,
      headsign: headsign ?? '',
      time: call.time,
      scheduled: matched?.time ?? scheduledTime,
      live: true,
      delaySec,
      vehicleRef: vehicle.ref,
    });
  }

  for (const entry of remaining) {
    if (entry.time >= now) out.push({ ...entry, scheduled: entry.time, live: false, delaySec: 0 });
  }
  return out.sort((a, b) => a.time - b.time);
}
