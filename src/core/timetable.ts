import { serviceDay, type ServiceDay } from './time';
import type { ScheduledDeparture, Service, Services, TimetableGroup } from './types';

export function runsOn(service: Service | undefined, day: ServiceDay): boolean {
  if (!service) return false;
  if (service.add.includes(day.date)) return true;
  if (service.remove.includes(day.date)) return false;
  return day.date >= service.start && day.date <= service.end && service.days[day.weekday] === '1';
}

export function upcomingDepartures(
  groups: TimetableGroup[],
  services: Services,
  from: number,
  horizonMs: number,
): ScheduledDeparture[] {
  const out: ScheduledDeparture[] = [];
  const until = from + horizonMs;

  for (const offset of [-1, 0, 1]) {
    const day = serviceDay(from, offset);
    for (const group of groups) {
      if (!group.services.some((id) => runsOn(services[id], day))) continue;
      let seconds = 0;
      for (const delta of group.times) {
        seconds += delta;
        const time = day.startMs + seconds * 1000;
        if (time >= from && time < until) out.push({ line: group.line, headsign: group.headsign, time });
      }
    }
  }
  return out.sort((a, b) => a.time - b.time);
}
