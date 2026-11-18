const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export interface HoursRule {
  days: number[];

  spans: [number, number][];
}

const minutes = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

function daysOf(text: string): number[] | null {
  const days = new Set<number>();
  for (const part of text.split(',')) {
    const [from, to] = part.trim().split('-');
    const a = DAYS.indexOf(from);
    const b = to ? DAYS.indexOf(to) : a;
    if (a < 0 || b < 0) return null;
    for (let d = a; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === b) break;
    }
  }
  return [...days].sort((x, y) => x - y);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)';

const SEASON = new RegExp(`^(${MONTH}(?:-${MONTH})?(?:\\s*,\\s*${MONTH}(?:-${MONTH})?)*)\\s*:?\\s+`, 'i');

function monthsOf(text: string): number[] {
  const months = new Set<number>();
  for (const part of text.toLowerCase().split(',')) {
    const [from, to] = part.trim().split('-');
    const a = MONTHS.indexOf(from);
    const b = to ? MONTHS.indexOf(to) : a;
    for (let m = a; ; m = (m + 1) % 12) {
      months.add(m);
      if (m === b) break;
    }
  }
  return [...months];
}

export function parseOpeningHours(text: string, at: Date = new Date()): HoursRule[] | null {
  const trimmed = text.trim();
  if (trimmed === '24/7') return [{ days: [0, 1, 2, 3, 4, 5, 6], spans: [[0, 24 * 60]] }];
  const rules: HoursRule[] = [];

  const separated = trimmed.replace(/(\d:\d\d)\s*,\s*(?=[A-Za-z])/g, '$1;');
  for (const raw of separated.split(';')) {
    let rule = raw.trim();
    if (!rule || /^PH(\s|$)/i.test(rule)) continue;
    const season = SEASON.exec(rule);
    if (season) rule = rule.slice(season[0].length);
    const match = /^(?:([A-Za-z,\- ]+?)\s+)?((?:\d{1,2}:\d\d-\d{1,2}:\d\d,?\s*)+|off|closed)$/i.exec(rule);
    if (!match) return null;

    if (season && !monthsOf(season[1]).includes(at.getMonth())) continue;
    const days = match[1] ? daysOf(match[1].replace(/\s/g, '')) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    const spans: [number, number][] = /^(off|closed)$/i.test(match[2])
      ? []
      : match[2].split(',').map((span) => {
          const [from, to] = span.trim().split('-');
          const start = minutes(from);
          let end = minutes(to);
          if (end <= start) end += 24 * 60;
          return [start, end];
        });

    for (const existing of rules) existing.days = existing.days.filter((day) => !days.includes(day));
    rules.push({ days, spans });
  }
  return rules.filter((rule) => rule.days.length);
}

export function openNow(rules: HoursRule[], at: Date): { open: boolean; until?: number; from?: number } {
  const day = (at.getDay() + 6) % 7;
  const now = at.getHours() * 60 + at.getMinutes();
  const today = rules.find((rule) => rule.days.includes(day))?.spans ?? [];
  const yesterday = rules.find((rule) => rule.days.includes((day + 6) % 7))?.spans ?? [];
  for (const [, end] of yesterday) if (end > 24 * 60 && now < end - 24 * 60) return { open: true, until: end - 24 * 60 };
  for (const [start, end] of today) if (now >= start && now < end) return { open: true, until: end % (24 * 60) };
  const next = today.find(([start]) => start > now);
  return { open: false, from: next?.[0] };
}

export const clockOf = (total: number) => `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

export function weekRows(rules: HoursRule[]): { from: number; to: number; spans: [number, number][] }[] {
  const spansOf = (day: number) => rules.find((rule) => rule.days.includes(day))?.spans ?? [];
  const rows: { from: number; to: number; spans: [number, number][] }[] = [];
  for (let day = 0; day < 7; day++) {
    const spans = spansOf(day);
    const last = rows.at(-1);
    if (last && JSON.stringify(last.spans) === JSON.stringify(spans)) last.to = day;
    else rows.push({ from: day, to: day, spans });
  }
  return rows;
}
