import { ROUTE_SERVER } from './driving';
import type { Place } from './geocode';
import type { LatLon } from './types';

export interface Airport extends LatLon {
  iata: string;
  name: string;

  page: string;

  major?: boolean;
}

const finavia = (slug: string) => `https://www.finavia.fi/en/airports/${slug}/flights`;

export const AIRPORTS: Airport[] = [
  { iata: 'HEL', name: 'Helsinki-Vantaa', lat: 60.3172, lon: 24.9633, page: finavia('helsinki-airport'), major: true },
  { iata: 'TMP', name: 'Tampere-Pirkkala', lat: 61.4141, lon: 23.6044, page: finavia('tampere-pirkkala'), major: true },
  { iata: 'TKU', name: 'Turku', lat: 60.5141, lon: 22.2628, page: finavia('turku'), major: true },
  { iata: 'OUL', name: 'Oulu', lat: 64.9301, lon: 25.3546, page: finavia('oulu'), major: true },
  { iata: 'RVN', name: 'Rovaniemi', lat: 66.5648, lon: 25.8304, page: finavia('rovaniemi'), major: true },
  { iata: 'KTT', name: 'Kittilä', lat: 67.701, lon: 24.8468, page: finavia('kittila') },
  { iata: 'IVL', name: 'Ivalo', lat: 68.6073, lon: 27.4053, page: finavia('ivalo') },
  { iata: 'KUO', name: 'Kuopio', lat: 63.0071, lon: 27.7978, page: finavia('kuopio') },
  { iata: 'JOE', name: 'Joensuu', lat: 62.6629, lon: 29.6075, page: finavia('joensuu') },
  { iata: 'VAA', name: 'Vaasa', lat: 63.0507, lon: 21.7622, page: finavia('vaasa') },
  { iata: 'JYV', name: 'Jyväskylä', lat: 62.3995, lon: 25.6783, page: finavia('jyvaskyla') },
  { iata: 'KAJ', name: 'Kajaani', lat: 64.2855, lon: 27.6924, page: finavia('kajaani') },
  { iata: 'KEM', name: 'Kemi-Tornio', lat: 65.7787, lon: 24.5821, page: finavia('kemi-tornio') },
  { iata: 'KOK', name: 'Kokkola-Pietarsaari', lat: 63.7212, lon: 23.1431, page: finavia('kokkola-pietarsaari') },
  { iata: 'KAO', name: 'Kuusamo', lat: 65.9876, lon: 29.2394, page: finavia('kuusamo') },
  { iata: 'POR', name: 'Pori', lat: 61.4617, lon: 21.7997, page: finavia('pori') },
  { iata: 'SVL', name: 'Savonlinna', lat: 61.9431, lon: 28.9451, page: finavia('savonlinna') },
  { iata: 'ENF', name: 'Enontekiö', lat: 68.3626, lon: 23.4243, page: finavia('enontekio') },
  { iata: 'MHQ', name: 'Mariehamn', lat: 60.1222, lon: 19.8982, page: finavia('mariehamn') },
];

export type FlightState = 'departed' | 'landed' | 'estimated' | 'cancelled' | 'approaching' | 'finalCall' | 'gateClosed' | 'gateOpen' | 'boarding' | 'delayed';

export interface Flight {
  number: string;

  place: string;
  placeCode?: string;

  scheduled: number;
  expected?: number;
  gate?: string;

  belt?: string;
  state?: FlightState;

  status?: string;
}

export interface AirportFlights {
  updated: number;

  departures: Flight[] | null;
  arrivals: Flight[] | null;
}

const STATES: Record<string, FlightState> = {
  DEP: 'departed', D: 'departed', LAN: 'landed', A: 'landed', EST: 'estimated', E: 'estimated', DLU: 'estimated', NEW: 'estimated',
  CNL: 'cancelled', C: 'cancelled', ETA: 'approaching', FIN: 'finalCall', RMV: 'gateClosed', GCL: 'gateClosed', GTC: 'gateClosed', GTO: 'gateOpen',
  GOP: 'gateOpen', BBR: 'boarding', BRD: 'boarding', DEL: 'delayed',
};

const unescape = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();

export function parseFinavia(xml: string, language: string): { updated: number; flights: Flight[] } {
  const timestamp = /<timestamp>([^<]+)<\/timestamp>/.exec(xml)?.[1];
  const flights: Flight[] = [];
  for (const [, body] of xml.matchAll(/<flight>([\s\S]*?)<\/flight>/g)) {
    const field = (name: string) => {
      const value = new RegExp(`<${name}>([^<]*)</${name}>`).exec(body)?.[1];
      return value ? unescape(value) : undefined;
    };
    const scheduled = Date.parse(field('sdt') ?? '');
    const number = field('fltnr');
    if (!number || !Number.isFinite(scheduled)) continue;
    const names: string[] = [];
    const codes: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const name = (language === 'fi' && field(`route_n_fi_${i}`)) || field(`route_n_${i}`);
      const code = field(`route_${i}`);
      if (name || code) names.push(name ?? code!);
      if (code) codes.push(code);
    }
    const expected = Date.parse(field('act_d') ?? field('est_d') ?? '');
    const status = language === 'fi' ? field('prt_f') : language === 'sv' ? field('prt_s') : field('prt');
    flights.push({
      number: number.replace(/^([A-Z0-9]{2})(\d)/, '$1 $2'),
      place: names.join(' – ') || '—',
      placeCode: codes.length === 1 ? codes[0] : undefined,
      scheduled,
      expected: Number.isFinite(expected) ? expected : undefined,
      gate: field('gate'),
      belt: field('bltarea'),
      state: STATES[field('prm') ?? ''],
      status: status ?? field('prt'),
    });
  }
  flights.sort((a, b) => a.scheduled - b.scheduled);
  return { updated: timestamp ? Date.parse(timestamp) : Date.now(), flights };
}

export async function fetchFlights(iata: string, language: string, signal?: AbortSignal): Promise<AirportFlights | null> {
  const board = async (kind: 'dep' | 'arr') => {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      try {
        const res = await fetch(`${ROUTE_SERVER}/flights/${kind}/${iata}`, { signal, cache: attempt ? 'no-store' : 'default' });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes('<flights')) return parseFinavia(text, language);
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
    return null;
  };
  const [departures, arrivals] = await Promise.all([board('dep'), board('arr')]);
  if (!departures && !arrivals) throw new Error('flights: no answer');
  return {
    updated: Math.min(departures?.updated ?? Infinity, arrivals?.updated ?? Infinity),
    departures: departures?.flights ?? null,
    arrivals: arrivals?.flights ?? null,
  };
}

const fold = (text: string) => text.toLocaleLowerCase('fi').normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matchAirports(query: string, asked: boolean, near: LatLon | null): Place[] {
  const text = fold(query.trim());
  const hits = asked
    ? AIRPORTS
    : text.length < 3
      ? []
      : AIRPORTS.filter((airport) => fold(airport.iata) === text || fold(airport.name).split(/[\s-]+/).some((word) => word.startsWith(text)) || fold(airport.name).startsWith(text));
  const far = (airport: Airport) => (near ? Math.hypot(airport.lat - near.lat, (airport.lon - near.lon) * Math.cos((near.lat * Math.PI) / 180)) : 0);
  return [...hits]
    .sort((a, b) => far(a) - far(b))
    .slice(0, asked ? 6 : 3)
    .map((airport) => ({ id: `airport-${airport.iata}`, name: `${airport.name} (${airport.iata})`, detail: airport.iata, kind: 'airport', lat: airport.lat, lon: airport.lon }));
}
