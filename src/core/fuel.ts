import { siteUrl } from '@/platform';
import { distanceM } from './geo';
import type { LatLon } from './types';

const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const DETAILS_URL = siteUrl('/api/station');
const REPORT_URL = siteUrl('/api/report-price');

const REPORTS = 'https://f1yoxxxx0uttckpp.public.blob.vercel-storage.com/prices';
const REPORT_LIFETIME_MS = 7 * 24 * 3600 * 1000;
const LOWEST_PRICE = 1;
const HIGHEST_PRICE = 4;
const SEARCH_RADIUS_KM = 25;
const MAX_STATIONS = 20;

export interface FuelStation extends LatLon {
  id: string;
  name: string;
  address: string;
  meters: number;

  osm?: string;
}

export interface StationDetails {
  brand?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  fuels: string[];
}

const OSM_TYPES: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };
const FUEL_LABELS: Record<string, string> = {
  octane_95: '95',
  octane_98: '98',
  diesel: 'Diesel',
  e85: 'E85',
  hvo100: 'HVO100',
  lpg: 'LPG',
  cng: 'CNG',
  adblue: 'AdBlue',
};

export interface FuelPrices {
  petrol95: number;
  diesel: number;
  updated: string;
}

export interface ReportedPrices {
  petrol95?: number;
  diesel?: number;
  updated: number;
}

export function parsePrice(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const price = Number(trimmed.replace(',', '.'));
  return price >= LOWEST_PRICE && price <= HIGHEST_PRICE ? price : null;
}

export async function fetchReportedPrices(stationId: string, signal?: AbortSignal): Promise<ReportedPrices | null> {
  const res = await fetch(`${REPORTS}/${encodeURIComponent(stationId)}.json`, { signal });
  if (!res.ok) return null;
  const report = (await res.json()) as ReportedPrices;
  return Date.now() - report.updated <= REPORT_LIFETIME_MS ? report : null;
}

export async function reportPrices(stationId: string, prices: { petrol95?: number; diesel?: number }): Promise<ReportedPrices> {
  const res = await fetch(REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationId, ...prices }),
  });
  if (!res.ok) throw new Error(`Price report failed: ${res.status}`);
  return (await res.json()) as ReportedPrices;
}

interface PhotonFuel {
  geometry: { coordinates: [number, number] };
  properties: { osm_type?: string; osm_id?: number; name?: string; brand?: string; street?: string; housenumber?: string; city?: string; district?: string };
}

export function toStation(feature: PhotonFuel, near: LatLon): FuelStation {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  return {
    id: String(p.osm_id ?? `${lat},${lon}`),
    name: p.name ?? p.brand ?? street,
    address: [street, p.city ?? p.district].filter(Boolean).join(', '),
    lat,
    lon,
    meters: distanceM(near, { lat, lon }),
    osm: p.osm_type && p.osm_id ? `${OSM_TYPES[p.osm_type]}(${p.osm_id})` : undefined,
  };
}

export function toDetails(tags: Record<string, string>): StationDetails {
  return {
    brand: tags.brand,
    phone: tags.phone ?? tags['contact:phone'],
    website: tags.website ?? tags['contact:website'],
    openingHours: tags.opening_hours,
    fuels: Object.entries(FUEL_LABELS)
      .filter(([key]) => tags[`fuel:${key}`] === 'yes')
      .map(([, label]) => label),
  };
}

export async function fetchStationDetails(osm: string, signal?: AbortSignal): Promise<StationDetails> {
  const res = await fetch(`${DETAILS_URL}?${new URLSearchParams({ osm })}`, { signal });
  if (!res.ok) throw new Error(`Station details failed: ${res.status}`);
  return toDetails((await res.json()) as Record<string, string>);
}

export async function fetchFuelStations(near: LatLon, signal?: AbortSignal): Promise<FuelStation[]> {
  const params = new URLSearchParams({
    lat: String(near.lat),
    lon: String(near.lon),
    osm_tag: 'amenity:fuel',
    radius: String(SEARCH_RADIUS_KM),
    limit: String(MAX_STATIONS),
  });
  const res = await fetch(`${PHOTON_REVERSE}?${params}`, { signal });
  if (!res.ok) throw new Error(`Station search failed: ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFuel[] };
  return (json.features ?? [])
    .map((feature) => toStation(feature, near))
    .filter((station) => station.name)
    .sort((a, b) => a.meters - b.meters);
}
