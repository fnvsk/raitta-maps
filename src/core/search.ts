import type { Line, Stop } from './types';

export const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();

const folded = new WeakMap<Stop[], { name: string; words: string[] }[]>();
function foldedNames(stops: Stop[]) {
  let names = folded.get(stops);
  if (!names) {
    names = stops.map((stop) => {
      const name = fold(stop.name);
      return { name, words: name.split(/[\s-]+/) };
    });
    folded.set(stops, names);
  }
  return names;
}

export function searchStops(stops: Stop[], query: string, limit = 30): Stop[] {
  const q = fold(query);
  if (!q) return [];
  const names = foldedNames(stops);
  const scored: { stop: Stop; score: number }[] = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const { name, words } = names[i];
    let score = -1;
    if (stop.code === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (words.some((word) => word.startsWith(q))) score = 2;
    else if (name.includes(q)) score = 3;
    if (score >= 0) scored.push({ stop, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.stop.name.localeCompare(b.stop.name, 'fi'))
    .slice(0, limit)
    .map((s) => s.stop);
}

export function searchLines(lines: Line[], query: string, limit = 30): Line[] {
  const q = fold(query);
  if (!q) return lines.slice(0, limit);
  const exact = lines.filter((l) => l.id.toLowerCase() === q);
  const rest = lines.filter((l) => l.id.toLowerCase() !== q && (l.id.toLowerCase().startsWith(q) || fold(l.name).includes(q)));
  return [...exact, ...rest].slice(0, limit);
}
