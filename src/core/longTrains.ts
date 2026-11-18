import { siteUrl } from '@/platform';

const GRAPHQL = 'https://rata.digitraffic.fi/api/v2/graphql/graphql';
const REST = 'https://rata.digitraffic.fi/api/v1';

const HEADERS = { 'Digitraffic-User': 'RAITTA' };

export interface StationPoint {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TrainTime {
  scheduled: number;
  estimate?: number;
  actual?: number;
  
  delay?: number;
}

export interface TrainStop {
  code: string;
  arrival?: TrainTime;
  departure?: TrainTime;
  cancelled: boolean;
  
  commercial: boolean;
}

export interface LongTrain {
  id: string;
  number: number;
  date: string;
  type: string;
  
  label: string;
  lat: number;
  lon: number;
  speedKmh: number;
  stops: TrainStop[];
}

interface RawRow {
  station?: { shortCode: string };
  stationShortCode?: string;
  type: 'ARRIVAL' | 'DEPARTURE';
  scheduledTime: string;
  liveEstimateTime?: string | null;
  actualTime?: string | null;
  differenceInMinutes?: number | null;
  cancelled?: boolean;
  commercialStop?: boolean | null;
  commercialTrack?: string;
}

interface RawTrain {
  trainNumber: number;
  departureDate: string;
  trainType: { name: string } | string;
  trainLocations?: { location: [number, number]; speed: number }[];
  timeTableRows: RawRow[];
}

const parseTime = (value?: string | null) => (value ? Date.parse(value) : undefined);

function trainTime(row: RawRow): TrainTime {
  return {
    scheduled: Date.parse(row.scheduledTime),
    estimate: parseTime(row.liveEstimateTime),
    actual: parseTime(row.actualTime),
    delay: row.differenceInMinutes ?? undefined,
  };
}

export function stopsOf(rows: RawRow[]): TrainStop[] {
  const stops: TrainStop[] = [];
  for (const row of rows) {
    const code = row.station?.shortCode ?? row.stationShortCode ?? '';
    const last = stops[stops.length - 1];
    const time = trainTime(row);
    if (row.type === 'DEPARTURE' && last?.code === code && !last.departure) {
      last.departure = time;
      last.cancelled ||= !!row.cancelled;
      last.commercial ||= !!row.commercialStop;
      continue;
    }
    stops.push({
      code,
      [row.type === 'ARRIVAL' ? 'arrival' : 'departure']: time,
      cancelled: !!row.cancelled,
      commercial: !!row.commercialStop,
    });
  }
  return stops;
}

function parseTrain(raw: RawTrain): LongTrain | null {
  const located = raw.trainLocations?.[0];
  const type = typeof raw.trainType === 'string' ? raw.trainType : raw.trainType.name;
  if (!located) return null;
  return {
    id: `${raw.departureDate}/${raw.trainNumber}`,
    number: raw.trainNumber,
    date: raw.departureDate,
    type,
    label: `${type} ${raw.trainNumber}`,
    lon: located.location[0],
    lat: located.location[1],
    speedKmh: located.speed,
    stops: stopsOf(raw.timeTableRows).filter((stop) => stop.commercial),
  };
}

const RUNNING_QUERY = `{
  currentlyRunningTrains(where: { trainType: { trainCategory: { name: { equals: "Long-distance" } } } }) {
    trainNumber departureDate trainType { name }
    trainLocations(orderBy: { timestamp: DESCENDING }, take: 1) { location speed }
    timeTableRows(where: { commercialStop: { equals: true } }) {
      station { shortCode } type scheduledTime liveEstimateTime actualTime differenceInMinutes cancelled commercialStop
    }
  }
}`;

async function runningTrainsFromDigitraffic(signal?: AbortSignal) {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: RUNNING_QUERY }),
    signal,
  });
  if (!res.ok) throw new Error(`long trains ${res.status}`);
  return res;
}

export async function fetchLongTrains(signal?: AbortSignal): Promise<LongTrain[]> {
  let res = await fetch(siteUrl('/api/long-trains'), { signal }).catch(() => null);
  if (!res?.ok || res.headers.get('content-type')?.includes('html')) res = await runningTrainsFromDigitraffic(signal);
  const body = (await res.json()) as { data?: { currentlyRunningTrains?: RawTrain[] } };
  return (body.data?.currentlyRunningTrains ?? []).flatMap((raw) => parseTrain(raw) ?? []);
}

export interface TrainRoute {
  type: string;
  number: number;
  
  path: string[];
  stops: TrainStop[];
}

export async function fetchTrainRoute(date: string, number: string, signal?: AbortSignal): Promise<TrainRoute | null> {
  const res = await fetch(`${REST}/trains/${date}/${number}`, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`train ${res.status}`);
  const [raw] = (await res.json()) as RawTrain[];
  if (!raw) return null;
  const all = stopsOf(raw.timeTableRows);
  return {
    type: typeof raw.trainType === 'string' ? raw.trainType : raw.trainType.name,
    number: raw.trainNumber,
    path: all.map((stop) => stop.code),
    stops: all.filter((stop) => stop.commercial),
  };
}

export interface StationTrain {
  id: string;
  label: string;
  
  from: string;
  to: string;
  time: TrainTime;
  track?: string;
  cancelled: boolean;
}

export async function fetchStationDepartures(code: string, signal?: AbortSignal): Promise<StationTrain[]> {
  const params = new URLSearchParams({
    arrived_trains: '0',
    arriving_trains: '0',
    departed_trains: '0',
    departing_trains: '30',
    include_nonstopping: 'false',
    train_categories: 'Long-distance',
  });
  const res = await fetch(`${REST}/live-trains/station/${code}?${params}`, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`station ${res.status}`);
  const trains = (await res.json()) as RawTrain[];
  return trains
    .flatMap((raw): StationTrain[] => {
      const rows = raw.timeTableRows.filter((row) => row.commercialStop);
      const here = rows.find((row) => row.stationShortCode === code && row.type === 'DEPARTURE');
      if (!here || here.actualTime) return [];
      const type = typeof raw.trainType === 'string' ? raw.trainType : raw.trainType.name;
      return [
        {
          id: `${raw.departureDate}/${raw.trainNumber}`,
          label: `${type} ${raw.trainNumber}`,
          from: rows[0]?.stationShortCode ?? '',
          to: rows[rows.length - 1]?.stationShortCode ?? '',
          time: trainTime(here),
          track: here.commercialTrack || undefined,
          cancelled: !!here.cancelled,
        },
      ];
    })
    .sort((a, b) => (a.time.estimate ?? a.time.scheduled) - (b.time.estimate ?? b.time.scheduled));
}

export async function fetchStations(signal?: AbortSignal): Promise<StationPoint[]> {
  const res = await fetch(`${REST}/metadata/stations`, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`stations ${res.status}`);
  const all = (await res.json()) as { passengerTraffic: boolean; countryCode: string; stationName: string; stationShortCode: string; latitude: number; longitude: number }[];
  return all
    .filter((s) => s.passengerTraffic && s.countryCode === 'FI')
    .map((s) => ({ code: s.stationShortCode, name: s.stationName.replace(/ asema$/, ''), lat: s.latitude, lon: s.longitude }));
}

export function trainProgress(stops: TrainStop[]) {
  const left = (stop: TrainStop) => (stop.departure ? stop.departure.actual !== undefined : stop.arrival?.actual !== undefined);
  const found = stops.findIndex((stop) => !left(stop));
  const next = found < 0 ? stops.length - 1 : found;
  const ahead = stops[next];
  const previous = stops[next - 1];
  const delay = ahead?.arrival?.delay ?? ahead?.departure?.delay ?? previous?.departure?.delay ?? 0;
  return { next, delay };
}

export const bestTime = (time: TrainTime) => time.actual ?? time.estimate ?? time.scheduled;
