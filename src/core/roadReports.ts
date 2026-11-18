import { siteUrl } from '@/platform';
import { nearestOnRoute, type CarRoute } from './driving';

export const REPORT_KINDS = ['camera', 'police', 'accident', 'hazard'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export interface RoadReport {
  id: string;
  kind: ReportKind;
  lat: number;
  lon: number;

  seen: number;
}

export type FixedCamera = [number, number, number];

export async function fetchRoadReports(signal?: AbortSignal): Promise<RoadReport[]> {
  const res = await fetch(siteUrl('/api/road-reports'), { signal });
  if (!res.ok) throw new Error(`road-reports ${res.status}`);
  return ((await res.json()).reports ?? []) as RoadReport[];
}

async function post(body: object) {
  const res = await fetch(siteUrl('/api/road-reports'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`road-reports ${res.status}`);
}

export const sendRoadReport = (kind: ReportKind, at: { lat: number; lon: number }) => post({ kind, lat: Number(at.lat.toFixed(5)), lon: Number(at.lon.toFixed(5)) });
export const voteRoadReport = (id: string, there: boolean) => post({ id, vote: there ? 'yes' : 'no' });

export interface OnRoute {
  kind: ReportKind;
  along: number;

  limit?: number;

  id?: string;
  key: string;
}

const ON_ROUTE_M = 25;
const CELL = 0.01;

export function alongRoute(route: CarRoute, cameras: FixedCamera[], reports: RoadReport[]): OnRoute[] {
  const cells = new Map<string, number[]>();
  const cellOf = (lon: number, lat: number) => `${Math.floor(lon / (CELL * 2))}:${Math.floor(lat / CELL)}`;
  route.path.forEach(([lon, lat], index) => {
    const key = cellOf(lon, lat);
    const list = cells.get(key);
    if (list) list.push(index);
    else cells.set(key, [index]);
  });

  for (let i = 0; i < route.path.length - 1; i++) {
    const length = route.along[i + 1] - route.along[i];
    const steps = Math.floor(length / 400);
    for (let s = 1; s <= steps; s++) {
      const t = s / (steps + 1);
      const key = cellOf(route.path[i][0] + (route.path[i + 1][0] - route.path[i][0]) * t, route.path[i][1] + (route.path[i + 1][1] - route.path[i][1]) * t);
      const list = cells.get(key);
      if (list) list.push(i);
      else cells.set(key, [i]);
    }
  }
  const place = (lon: number, lat: number) => {
    const cx = Math.floor(lon / (CELL * 2));
    const cy = Math.floor(lat / CELL);
    let best: { along: number; off: number } | null = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const index of cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
          const near = nearestOnRoute(route, { lat, lon }, Math.max(0, index - 1), Math.min(route.path.length - 1, index + 1));
          if (!best || near.off < best.off) best = near;
        }
      }
    }
    return best && best.off < ON_ROUTE_M ? best.along : null;
  };
  const found: OnRoute[] = [];
  for (const [lon, lat, limit] of cameras) {
    const along = place(lon, lat);
    if (along !== null) found.push({ kind: 'camera', along, limit: limit || undefined, key: `fixed:${lon},${lat}` });
  }
  for (const report of reports) {
    const along = place(report.lon, report.lat);
    if (along !== null) found.push({ kind: report.kind, along, id: report.id, key: report.id });
  }
  return found.sort((a, b) => a.along - b.along);
}
