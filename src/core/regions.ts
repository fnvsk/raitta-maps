import raw from './regions.json';
import { distanceM } from './geo';
import type { LatLon } from './types';

export type RealtimeSource = { kind: 'itsfactory' } | { kind: 'hsl' } | { kind: 'digitransit'; feed: string };

export interface RegionConfig {
  id: string;
  name: string;
  sv: string;
  ru: string;
  gtfs: string;
  realtime: RealtimeSource;
}

export interface RegionInfo {
  id: string;
  center: LatLon;

  bbox: [number, number, number, number];
  stops: number;
  lines: number;
  shapeShards: number;
  timetableShards: number;
  generatedAt: string;
  validTo: number;
}

export const REGIONS = raw as RegionConfig[];
export const DEFAULT_REGION = 'tampere';

export const regionConfig = (id: string) => REGIONS.find((r) => r.id === id) ?? REGIONS[0];

export function regionName(region: RegionConfig, language: string) {
  if (language === 'sv') return region.sv;
  if (language === 'ru') return region.ru;
  return region.name;
}

export function shardOf(id: string, shards: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % shards;
}

export const IN_CITY_MARGIN_DEG = 0.12;

export function inBounds(info: RegionInfo, point: LatLon, marginDeg = 0) {
  const [west, south, east, north] = info.bbox;
  return (
    point.lon >= west - marginDeg &&
    point.lon <= east + marginDeg &&
    point.lat >= south - marginDeg &&
    point.lat <= north + marginDeg
  );
}

export function regionAt(regions: RegionInfo[], point: LatLon): RegionInfo | undefined {
  return regions
    .filter((r) => inBounds(r, point))
    .sort((a, b) => distanceM(a.center, point) - distanceM(b.center, point))[0];
}
