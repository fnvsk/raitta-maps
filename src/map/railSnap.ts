export type LonLat = [number, number];

const CELL_DEG = 0.01;
const M_PER_DEG = 111_320;

const MAX_DETOUR = 3;
const DETOUR_SLACK_M = 60;

interface OnLine {
  segment: number;
  t: number;
  point: LonLat;
  metres: number;
}

const metresBetween = (a: LonLat, b: LonLat) => Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * M_PER_DEG;

export function railSnapper(lines: LonLat[][], maxOffM = 150) {
  const grid = new Map<string, [number, number][]>();
  const cellOf = ([lon, lat]: LonLat) => `${Math.floor(lon / CELL_DEG)},${Math.floor(lat / CELL_DEG)}`;
  lines.forEach((line, l) => {
    for (let s = 0; s + 1 < line.length; s++) {
      for (const key of new Set([cellOf(line[s]), cellOf(line[s + 1])])) {
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push([l, s]);
      }
    }
  });

  function nearestByLine(at: LonLat) {
    const k = Math.cos((at[1] * Math.PI) / 180);
    const cx = Math.floor(at[0] / CELL_DEG);
    const cy = Math.floor(at[1] / CELL_DEG);
    const best = new Map<number, OnLine>();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const [l, s] of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          const [ax, ay] = lines[l][s];
          const [bx, by] = lines[l][s + 1];
          const vx = (bx - ax) * k;
          const vy = by - ay;
          const length = vx * vx + vy * vy;
          const t = length ? Math.max(0, Math.min(1, (((at[0] - ax) * k) * vx + (at[1] - ay) * vy) / length)) : 0;
          const px = ax + (bx - ax) * t;
          const py = ay + (by - ay) * t;
          const metres = Math.hypot((at[0] - px) * k, at[1] - py) * M_PER_DEG;
          const known = best.get(l);
          if (metres < maxOffM && (!known || metres < known.metres)) best.set(l, { segment: s, t, point: [px, py], metres });
        }
    return best;
  }

  return (from: LonLat, to: LonLat): LonLat[] | null => {
    const starts = nearestByLine(from);
    if (!starts.size) return null;
    const ends = nearestByLine(to);

    let chosen = -1;
    let closest = Infinity;
    for (const [l, a] of starts) {
      const b = ends.get(l);
      if (b && a.metres + b.metres < closest) [chosen, closest] = [l, a.metres + b.metres];
    }
    if (chosen < 0) return null;
    const a = starts.get(chosen)!;
    const b = ends.get(chosen)!;
    const line = lines[chosen];
    const forward = a.segment < b.segment || (a.segment === b.segment && a.t <= b.t);
    const [first, last] = forward ? [a, b] : [b, a];
    const path: LonLat[] = [first.point];
    for (let s = first.segment + 1; s <= last.segment; s++) path.push(line[s]);
    path.push(last.point);
    let length = 0;
    for (let i = 1; i < path.length; i++) length += metresBetween(path[i - 1], path[i]);
    if (length > metresBetween(from, to) * MAX_DETOUR + DETOUR_SLACK_M) return null;
    return forward ? path : path.reverse();
  };
}
