const BASE = 'https://rata.digitraffic.fi/api/v1';

export const REGION_STATIONS: Record<string, string> = {
  helsinki: 'HKI',
  tampere: 'TPE',
  turku: 'TKU',
  oulu: 'OL',
  jyvaskyla: 'JY',
  kuopio: 'KUO',
  lahti: 'LH',
  pori: 'PRI',
  joensuu: 'JNS',
  lappeenranta: 'LR',
  hameenlinna: 'HL',
  vaasa: 'VS',
  rovaniemi: 'ROI',
  kotka: 'KTA',
  kouvola: 'KV',
  mikkeli: 'MI',
  salo: 'SLO',
  kajaani: 'KAJ',
  raasepori: 'KR',
};

export interface TrainOption {
  name: string;
  departure: number;
  arrival: number;
  
  number?: number;
  date?: string;
  
  delay?: number;
}

interface RawRow {
  type: string;
  stationShortCode: string;
  commercialStop?: boolean;
  cancelled?: boolean;
  scheduledTime: string;
  liveEstimateTime?: string;
}

interface RawTrain {
  trainType: string;
  trainNumber: number;
  departureDate?: string;
  commuterLineID?: string;
  cancelled?: boolean;
  timeTableRows: RawRow[];
}

export function parseTrains(trains: RawTrain[], from: string, to: string, after: number): TrainOption[] {
  const time = (row: RawRow) => Date.parse(row.liveEstimateTime ?? row.scheduledTime);
  return trains
    .flatMap((train): TrainOption[] => {
      if (train.cancelled) return [];
      const rows = train.timeTableRows;
      const start = rows.findIndex((r) => r.stationShortCode === from && r.type === 'DEPARTURE' && r.commercialStop && !r.cancelled);
      if (start < 0) return [];
      const end = rows.findIndex((r, i) => i > start && r.stationShortCode === to && r.type === 'ARRIVAL' && r.commercialStop && !r.cancelled);
      if (end < 0) return [];
      const name = train.commuterLineID || `${train.trainType} ${train.trainNumber}`;
      const late = rows[start].liveEstimateTime ? Math.round((Date.parse(rows[start].liveEstimateTime!) - Date.parse(rows[start].scheduledTime)) / 60_000) : undefined;
      return [{ name, departure: time(rows[start]), arrival: time(rows[end]), number: train.trainNumber, date: train.departureDate, delay: late }];
    })
    .filter((train) => train.departure >= after)
    .sort((a, b) => a.departure - b.departure);
}

export async function fetchTrains(from: string, to: string, at: number, signal?: AbortSignal, count = 5): Promise<TrainOption[]> {
  const params = new URLSearchParams({ startDate: new Date(at).toISOString(), limit: String(Math.max(8, count + 3)) });
  const res = await fetch(`${BASE}/live-trains/station/${from}/${to}?${params}`, { signal });
  
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Train search failed: ${res.status}`);
  return parseTrains((await res.json()) as RawTrain[], from, to, at).slice(0, count);
}
