import { siteUrl } from '@/platform';
import { distanceM } from './geo';
import type { LatLon } from './types';

export type Plug = 'ccs' | 't2' | 't2c' | 'chademo' | 'schuko' | 'mcs' | 'other';

export type Connector = [plug: Plug, kw: number, tariff: number];

export type Evse = [id: string, connectors: Connector[]];

export interface ChargerSite {
  id: string;

  n: string;
  o: number;
  a: string;
  x: number;
  y: number;
  e: Evse[];

  p?: string;

  h?: [number, string, string][];

  ph?: string;

  d?: string;
}

export type PriceKind = 'E' | 'T' | 'P' | 'C' | 'F';

export interface TariffElement {
  c: [kind: PriceKind, price: number][];
  r?: {
    st?: string;
    et?: string;
    dw?: number[];

    minD?: number;
    maxD?: number;
    minP?: number;
    maxP?: number;
    rsv?: 1;
  };
}

export interface Tariff {
  e: TariffElement[];

  alt?: Record<string, string>;
  url?: string;
}

export interface ChargersData {
  updated: string;
  operators: { name: string; web?: string }[];
  tariffs: Tariff[];
  sites: ChargerSite[];
}

export type EvseStatus = 'A' | 'C' | 'B' | 'R' | 'O' | 'P' | 'U';

export interface ChargerStatus {
  updated: string;

  busy: Record<string, EvseStatus>;
}

export async function fetchChargers(signal?: AbortSignal): Promise<ChargersData> {
  const res = await fetch(siteUrl('/api/chargers'), { signal });
  if (!res.ok) throw new Error(`Chargers failed: ${res.status}`);
  return (await res.json()) as ChargersData;
}

export async function fetchChargerStatus(signal?: AbortSignal): Promise<ChargerStatus> {
  const res = await fetch(siteUrl('/api/charger-status'), { signal });
  if (!res.ok) throw new Error(`Charger status failed: ${res.status}`);
  return (await res.json()) as ChargerStatus;
}

export const statusOf = (evse: Evse, status?: ChargerStatus): EvseStatus | undefined =>
  status ? (status.busy[evse[0]] ?? 'A') : undefined;

export const FAST_KW = 50;

export type SiteState = 'free' | 'busy' | 'down' | 'unknown';

export interface SiteSummary {
  maxKw: number;
  plugs: Plug[];
  total: number;
  free: number;
  state: SiteState;
}

export function summarize(site: ChargerSite, status?: ChargerStatus): SiteSummary {
  let maxKw = 0;
  let free = 0;
  let working = 0;
  const plugs = new Set<Plug>();
  for (const evse of site.e) {
    for (const [plug, kw] of evse[1]) {
      plugs.add(plug);
      maxKw = Math.max(maxKw, kw);
    }
    const state = statusOf(evse, status);
    if (state === 'A') free++;
    if (state === 'A' || state === 'C' || state === 'B' || state === 'R') working++;
  }
  const state: SiteState = !status ? 'unknown' : free ? 'free' : working ? 'busy' : 'down';
  return { maxKw, plugs: [...plugs], total: site.e.length, free, state };
}

export interface ConnectorGroup {
  plug: Plug;
  kw: number;
  total: number;
  free: number;
  tariff: number;
}

export function connectorGroups(site: ChargerSite, status?: ChargerStatus): ConnectorGroup[] {
  const groups = new Map<string, ConnectorGroup>();
  for (const evse of site.e) {
    const free = statusOf(evse, status) === 'A';
    for (const [plug, kw, tariff] of evse[1]) {
      const key = `${plug}|${kw}|${tariff}`;
      const group = groups.get(key) ?? { plug, kw, total: 0, free: 0, tariff };
      group.total++;
      if (free) group.free++;
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.kw - a.kw || a.plug.localeCompare(b.plug));
}

export interface ChargerFilter {
  plug: 'all' | 'ccs' | 'type2' | 'chademo';
  fastOnly: boolean;
  freeOnly: boolean;
}

export const NO_FILTER: ChargerFilter = { plug: 'all', fastOnly: false, freeOnly: false };

const PLUG_FILTER: Record<ChargerFilter['plug'], Plug[]> = {
  all: [],
  ccs: ['ccs'],
  type2: ['t2', 't2c'],
  chademo: ['chademo'],
};

export function matches(site: ChargerSite, filter: ChargerFilter, status?: ChargerStatus) {
  const plugs = PLUG_FILTER[filter.plug];
  return site.e.some(
    (evse) =>
      (!filter.freeOnly || !status || statusOf(evse, status) === 'A') &&
      evse[1].some(([plug, kw]) => (!plugs.length || plugs.includes(plug)) && (!filter.fastOnly || kw >= FAST_KW)),
  );
}

export interface NearbySite {
  site: ChargerSite;
  meters: number;
}

export function nearestSites(sites: ChargerSite[], near: LatLon, limit: number): NearbySite[] {
  return sites
    .map((site) => ({ site, meters: distanceM(near, { lat: site.y, lon: site.x }) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

export interface PriceStep {
  fromMin: number;
  price: number;
}

export interface PriceNow {
  energy?: number;
  time?: PriceStep[];
  parking?: PriceStep[];

  congestion?: PriceStep[];
  flat?: number;
}

const HELSINKI_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Helsinki',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function finnishClock(at: Date) {
  const parts = Object.fromEntries(HELSINKI_CLOCK.formatToParts(at).map((part) => [part.type, part.value]));
  return { day: WEEKDAYS.indexOf(parts.weekday), time: `${parts.hour}:${parts.minute}` };
}

function inTime(clock: string, start?: string, end?: string) {
  if (!start && !end) return true;
  if (start && !end) return clock >= start;
  if (!start && end) return clock < end || end === '00:00';

  if (end === '00:00' || start! > end!) return clock >= start! || clock < end!;
  return clock >= start! && clock < end!;
}

function applies(element: TariffElement, kw: number, day: number, time: string, minutes: number) {
  const r = element.r;
  if (!r) return true;
  if (r.rsv) return false;
  if (r.dw && !r.dw.includes(day)) return false;
  if (!inTime(time, r.st, r.et)) return false;
  if (r.minP !== undefined && kw < r.minP) return false;
  if (r.maxP !== undefined && kw >= r.maxP) return false;
  if (r.minD !== undefined && minutes < r.minD) return false;
  if (r.maxD !== undefined && minutes >= r.maxD) return false;
  return true;
}

function priceAt(tariff: Tariff, kind: PriceKind, kw: number, day: number, time: string, minutes: number) {
  for (const element of tariff.e) {
    const component = element.c.find(([k]) => k === kind);
    if (component && applies(element, kw, day, time, minutes)) return component[1];
  }
  return undefined;
}

function steps(tariff: Tariff, kind: PriceKind, kw: number, day: number, time: string): PriceStep[] | undefined {
  const marks = new Set([0]);
  for (const element of tariff.e) {
    if (element.r?.minD) marks.add(element.r.minD);
    if (element.r?.maxD) marks.add(element.r.maxD);
  }
  const result: PriceStep[] = [];
  for (const fromMin of [...marks].sort((a, b) => a - b)) {
    const price = priceAt(tariff, kind, kw, day, time, fromMin) ?? 0;
    if (!result.length || result[result.length - 1].price !== price) result.push({ fromMin, price });
  }
  return result.some((step) => step.price > 0) ? result : undefined;
}

export function priceNow(tariff: Tariff, kw: number, at = new Date()): PriceNow {
  const { day, time } = finnishClock(at);
  const price: PriceNow = {};
  const energy = priceAt(tariff, 'E', kw, day, time, 0);
  if (energy !== undefined) price.energy = energy;
  const flat = priceAt(tariff, 'F', kw, day, time, 0);
  if (flat) price.flat = flat;
  const time_ = steps(tariff, 'T', kw, day, time);
  if (time_) price.time = time_;
  const parking = steps(tariff, 'P', kw, day, time);
  if (parking) price.parking = parking;
  const congestion = steps(tariff, 'C', kw, day, time);
  if (congestion) price.congestion = congestion;
  return price;
}

export function variesByTime(tariff: Tariff) {
  const prices = new Set(tariff.e.filter((element) => element.r?.st || element.r?.dw).flatMap((element) => element.c.filter(([k]) => k === 'E').map(([, p]) => p)));
  return prices.size > 1;
}

export function tariffText(tariff: Tariff, language: string) {
  const alt = tariff.alt;
  if (!alt) return undefined;
  return alt[language] ?? alt.en ?? alt.fi ?? Object.values(alt)[0];
}

export const PLUG_LABELS: Record<Plug, string> = {
  ccs: 'CCS',
  t2: 'Type 2',
  t2c: 'Type 2',
  chademo: 'CHAdeMO',
  schuko: 'Schuko',
  mcs: 'MCS',
  other: '—',
};
