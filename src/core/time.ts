const TIME_ZONE = 'Europe/Helsinki';

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

function zonedParts(ms: number) {
  const out: Record<string, number> = {};
  for (const p of partsFormat.formatToParts(ms)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

function zoneOffsetMs(ms: number): number {
  const p = zonedParts(ms);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

export interface ServiceDay {
  date: number;

  weekday: number;

  startMs: number;
}

export function serviceDay(ms: number, dayOffset = 0): ServiceDay {
  const p = zonedParts(ms);
  const noonUtc = Date.UTC(p.year, p.month - 1, p.day + dayOffset, 12);
  const d = new Date(noonUtc);
  const noonInstant = noonUtc - zoneOffsetMs(noonUtc);
  return {
    date: d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(),
    weekday: (d.getUTCDay() + 6) % 7,
    startMs: noonInstant - 12 * 3600 * 1000,
  };
}

export function parseDelay(value: string | undefined): number {
  const m = value?.match(/^(-)?P.*?T(\d+)H(\d+)M([\d.]+)S$/);
  if (!m) return 0;
  const seconds = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]);
  return m[1] ? -seconds : seconds;
}

export function formatClock(ms: number): string {
  const p = zonedParts(ms);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export const minutesUntil = (time: number, now: number) => Math.max(0, Math.floor((time - now) / 60000));
