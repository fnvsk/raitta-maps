import type { LatLon } from './types';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const NEAR_DEG = 0.08;

export interface AreaOutline {
  name: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;

  bbox: [number, number, number, number];
}

interface NominatimResult {
  display_name: string;
  boundingbox: [string, string, string, string];
  geojson?: GeoJSON.Geometry;
}

export async function fetchAreaOutline(name: string, at: LatLon, signal?: AbortSignal): Promise<AreaOutline | null> {
  const viewbox = [at.lon - NEAR_DEG * 2, at.lat + NEAR_DEG, at.lon + NEAR_DEG * 2, at.lat - NEAR_DEG].map((v) => v.toFixed(4)).join(',');
  const params = new URLSearchParams({ q: name, format: 'jsonv2', polygon_geojson: '1', polygon_threshold: '0.00005', limit: '6', countrycodes: 'fi', viewbox, bounded: '1' });
  const res = await fetch(`${NOMINATIM}?${params}`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = (await res.json()) as NominatimResult[];

  const area = results.find((result) => result.geojson?.type === 'Polygon' || result.geojson?.type === 'MultiPolygon');
  if (!area?.geojson) return null;
  const [south, north, west, east] = area.boundingbox.map(Number);
  return { name, geometry: area.geojson as GeoJSON.Polygon | GeoJSON.MultiPolygon, bbox: [west, south, east, north] };
}
