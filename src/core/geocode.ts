import type { LatLon } from './types';

const PHOTON = 'https://photon.komoot.io/api/';
const FINLAND_BBOX = '19.0,59.5,31.6,70.1';

export type PlaceKind = 'street' | 'address' | 'school' | 'university' | 'shop' | 'food' | 'landmark' | 'place' | 'station' | 'airport';

export interface Place extends LatLon {
  id: string;
  name: string;
  detail: string;
  kind: PlaceKind;

  cashIn?: boolean | null;
}

interface PhotonProperties {
  osm_id?: number;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  district?: string;
  county?: string;
  countrycode?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProperties;
}

function kindOf({ osm_key: key, osm_value: value, housenumber, name }: PhotonProperties): PlaceKind {
  if (key === 'aeroway') return 'airport';
  if (key === 'railway' || value === 'bus_station' || value === 'ferry_terminal' || (key === 'public_transport' && value === 'station')) return 'station';
  if (key === 'highway') return 'street';
  if (value === 'university' || value === 'college') return 'university';
  if (value === 'school' || value === 'kindergarten') return 'school';
  if (key === 'shop') return 'shop';
  if (value === 'restaurant' || value === 'cafe' || value === 'fast_food' || value === 'bar' || value === 'pub') return 'food';
  if (key === 'tourism' || key === 'historic' || key === 'man_made' || key === 'leisure') return 'landmark';
  if (housenumber && !name) return 'address';
  return 'place';
}

export function toPlace(feature: PhotonFeature): Place | null {
  const p = feature.properties;
  if (p.countrycode && p.countrycode !== 'FI') return null;

  if (p.osm_value === 'bus_stop' || p.osm_value === 'tram_stop' || p.osm_value === 'platform') return null;
  const [lon, lat] = feature.geometry.coordinates;
  const address = p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : '';

  const name = p.name?.split(';')[0].trim() || address;
  if (!name) return null;
  const city = p.city ?? p.district ?? p.county ?? '';
  const detail = [address !== name ? address : '', city].filter(Boolean).join(', ');
  return { id: `${p.osm_id ?? name}-${lat}`, name, detail, kind: kindOf(p), lat, lon };
}

const HOUSE_NUMBER = /\s(\d+\s?[a-zA-Z]?)$/;
const foldText = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '');

export function addressesFor(query: string, features: PhotonFeature[]): Place[] {
  const number = HOUSE_NUMBER.exec(query.trim())?.[1];
  if (!number) return [];
  const street = foldText(query.trim().slice(0, -number.length));
  const found = new Map<string, Place>();
  for (const feature of features) {
    const p = feature.properties;
    if (!p.street || !p.housenumber || (p.countrycode && p.countrycode !== 'FI')) continue;
    if (foldText(p.housenumber) !== foldText(number) || !foldText(p.street).startsWith(street)) continue;
    const name = `${p.street} ${p.housenumber}`;
    const city = p.city ?? p.district ?? p.county ?? '';
    const key = `${name}|${city}`;
    if (found.has(key)) continue;
    const [lon, lat] = feature.geometry.coordinates;
    found.set(key, { id: `address-${key}`, name, detail: city, kind: 'address', lat, lon });
  }
  return [...found.values()];
}

export async function nameOfPoint(point: LatLon, signal?: AbortSignal): Promise<string> {
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lon), limit: '1' });
  const res = await fetch(`https://photon.komoot.io/reverse?${params}`, { signal });
  if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.status}`);
  const [feature] = ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
  const p = feature?.properties;
  if (!p) throw new Error('Nothing here');
  const address = p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : '';
  return address || p.name || [p.district, p.city].filter(Boolean).join(', ');
}

export function dedupePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = `${place.kind === 'street' ? 'street' : place.id}|${place.name}|${place.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchPlaces(query: string, near: LatLon, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '12',
    bbox: FINLAND_BBOX,
    lat: String(near.lat),
    lon: String(near.lon),
  });
  const res = await fetch(`${PHOTON}?${params}`, { signal });
  if (!res.ok) throw new Error(`Place search failed: ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  const features = json.features ?? [];
  return dedupePlaces([...addressesFor(query, features), ...features.flatMap((f) => toPlace(f) ?? [])]).slice(0, 7);
}

export async function searchCategory(tags: string[], center: LatLon, radiusKm: number, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ lat: String(center.lat), lon: String(center.lon), limit: '40', radius: String(Math.round(radiusKm * 10) / 10) });
  for (const tag of tags) params.append('osm_tag', tag);
  const res = await fetch(`https://photon.komoot.io/reverse?${params}`, { signal });
  if (!res.ok) throw new Error(`Category search failed: ${res.status}`);
  const features = ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
  return dedupePlaces(features.flatMap((feature) => toPlace(feature) ?? []));
}

export async function searchBrand(brand: { name: string; match: string[] }, center: LatLon, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: brand.name, lat: String(center.lat), lon: String(center.lon), limit: '50', location_bias_scale: '0.1', zoom: '12', bbox: FINLAND_BBOX });
  const res = await fetch(`${PHOTON}?${params}`, { signal });
  if (!res.ok) throw new Error(`Brand search failed: ${res.status}`);
  const features = ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
  const ours = (name: string) => {
    const lower = `${name.toLowerCase()} `;
    return brand.match.some((start) => lower.startsWith(start));
  };
  const away = (place: Place) => (place.lat - center.lat) ** 2 + ((place.lon - center.lon) * Math.cos((center.lat * Math.PI) / 180)) ** 2;
  return dedupePlaces(features.flatMap((feature) => toPlace(feature) ?? []).filter((place) => ours(place.name))).sort((a, b) => away(a) - away(b));
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function searchAtms(center: LatLon, radiusKm: number, signal?: AbortSignal): Promise<Place[]> {
  const radius = Math.round(Math.min(radiusKm, 15) * 1000);
  const query = `[out:json][timeout:20];nwr["amenity"="atm"](around:${radius},${center.lat.toFixed(5)},${center.lon.toFixed(5)});out tags center 80;`;
  let elements: OverpassElement[] | null = null;
  for (const mirror of OVERPASS) {
    try {
      const res = await fetch(mirror, { method: 'POST', body: new URLSearchParams({ data: query }), signal });
      if (!res.ok) continue;
      elements = ((await res.json()) as { elements: OverpassElement[] }).elements;
      break;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  if (!elements) throw new Error('ATM search failed');
  const away = (p: LatLon) => (p.lat - center.lat) ** 2 + ((p.lon - center.lon) * Math.cos((center.lat * Math.PI) / 180)) ** 2;
  return elements
    .flatMap((element): Place[] => {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat === undefined || lon === undefined) return [];
      const name = (tags.name ?? tags.brand ?? tags.operator ?? '').split(';')[0].replace(/\.$/, '').trim() || 'ATM';

      const deposits = tags.cash_in === 'yes' || /talletus|deposit/i.test(`${tags.name ?? ''} ${tags.operator ?? ''}`) ? true : tags.cash_in === 'no' ? false : null;
      const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
      return [{ id: `atm-${element.type}-${element.id}`, name, detail: [street, tags['addr:city']].filter(Boolean).join(', '), kind: 'place', lat, lon, cashIn: deposits }];
    })
    .sort((a, b) => away(a) - away(b));
}
