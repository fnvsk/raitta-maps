import { isNativeApp, siteUrl } from '@/platform';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchVehicles } from '@/core/api';
import { mergeDepartures, stationName } from '@/core/departures';
import { fetchChargers, fetchChargerStatus } from '@/core/charging';
import { fetchRoadEvents } from '@/core/roadEvents';
import type { Landmark } from '@/core/landmarks';
import type { Category } from '@/core/categories';
import type { Brand } from '@/core/brands';
import { fetchRoadReports, type FixedCamera } from '@/core/roadReports';
import { fetchSpeedLimits } from '@/core/speedLimits';
import { closurePolygons, fetchCarRoutes, isClosure, type CarRoute } from '@/core/driving';
import { fetchFuelStations, fetchReportedPrices, fetchStationDetails, type FuelPrices, type FuelStation, type ReportedPrices } from '@/core/fuel';
import { searchAtms, searchBrand, searchCategory, searchPlaces } from '@/core/geocode';
import { distanceM, KESKUSTORI } from '@/core/geo';
import { buildJourneyShape, journeyWalks, type PathPoint } from '@/core/journeyPath';
import { LiveFeed } from '@/core/live';
import { movingOnly } from '@/core/parked';
import { fetchLongTrains, fetchStationDepartures, fetchStations, fetchTrainRoute } from '@/core/longTrains';
import { stopsAround, type Journey, type RawRoute, type StreetWalks } from '@/core/raptor';
import { regionConfig, regionName, shardOf, type RegionInfo } from '@/core/regions';
import { upcomingDepartures } from '@/core/timetable';
import { fetchTrains, REGION_STATIONS } from '@/core/trains';
import { fetchWalkDistances, fetchWalkingRoute } from '@/core/walking';
import type { Departure, LatLon, Line, Mode, Pattern, Services, Stop, TimetableGroup, Vehicle } from '@/core/types';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';
import i18n from '@/i18n';

const POLL_MS = 4_000;
const DEPARTURES_POLL_MS = 15_000;
const DEPARTURE_HORIZON_MS = 3 * 3600 * 1000;
const PLACE_DEBOUNCE_MS = 250;
const PLACE_MIN_CHARS = 3;

const MAX_WALK_ROUTE_M = 1_300_000;

async function loadStatic<T>(path: string): Promise<T> {
  const res = await fetch(isNativeApp ? siteUrl(`/app/data/${path}`) : `${import.meta.env.BASE_URL}data/${path}`);

  if (!res.ok || !res.body || res.headers.get('content-type')?.includes('html')) throw new Error(`Missing data file: ${path}`);
  if (!path.endsWith('.gz')) return res.json() as Promise<T>;

  if (res.headers.get('content-encoding')) return res.json() as Promise<T>;
  return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).json() as Promise<T>;
}

const PLACEHOLDER_REGION: RegionInfo = {
  id: '',
  center: KESKUSTORI,
  bbox: [0, 0, 0, 0],
  stops: 0,
  lines: 0,
  shapeShards: 1,
  timetableShards: 1,
  generatedAt: '',
  validTo: 0,
};

const staticQuery = <T,>(path: string) => ({
  queryKey: ['static', path],
  queryFn: () => loadStatic<T>(path),
  staleTime: Infinity,
  gcTime: 30 * 60 * 1000,
  retry: 2,
});

export const useRegionId = () => useSettings((s) => s.region);

const KEPT_CITIES = 2;
const recentCities: string[] = [];
const CITY_QUERIES = new Set(['vehicles', 'stop-vehicles']);

function cityOf([kind, part]: readonly unknown[]) {
  if (typeof part !== 'string') return null;
  if (kind === 'static') return part.includes('/') ? part.split('/')[0] : null;
  return CITY_QUERIES.has(String(kind)) ? part : null;
}

export function useForgetOldCities() {
  const region = useRegionId();
  const client = useQueryClient();
  useEffect(() => {
    const at = recentCities.indexOf(region);
    if (at >= 0) recentCities.splice(at, 1);
    recentCities.unshift(region);
    const forgotten = new Set(recentCities.splice(KEPT_CITIES));
    if (forgotten.size) client.removeQueries({ predicate: (query) => forgotten.has(cityOf(query.queryKey) ?? '') });
  }, [region, client]);
}

export const useRegions = () => useQuery(staticQuery<RegionInfo[]>('regions.json'));

export function useRegion() {
  const id = useRegionId();
  const { data } = useRegions();

  const language = useSettings((s) => s.language) ?? i18n.language;
  return useMemo(() => {
    const config = regionConfig(id);
    return {
      id,
      config,
      info: data?.find((r) => r.id === id),
      name: regionName(config, language),
      center: data?.find((r) => r.id === id)?.center ?? KESKUSTORI,
      hasPredictions: config.realtime.kind === 'itsfactory',
    };
  }, [id, data, language]);
}

export const useCityFile = <T,>(region: string, file: string) => useQuery({ ...staticQuery<T>(`${region}/${file}`), enabled: !!region });
export const useLines = () => useQuery(staticQuery<Line[]>(`${useRegionId()}/lines.json.gz`));
export const useStops = () => useQuery(staticQuery<Stop[]>(`${useRegionId()}/stops.json.gz`));
export const usePatterns = () => useQuery(staticQuery<Pattern[]>(`${useRegionId()}/patterns.json.gz`));
export const useServices = () => useQuery(staticQuery<Services>(`${useRegionId()}/services.json.gz`));
export const useRoutes = () => useQuery(staticQuery<RawRoute[]>(`${useRegionId()}/routes.json.gz`));

export function useStreetWalks(place: LatLon | null, stops: Stop[] | undefined) {
  const around = useMemo(() => (place && stops ? stopsAround(stops, place) : []), [place?.lat, place?.lon, stops]);
  const regionId = useRegionId();
  const { data, isError } = useQuery({
    queryKey: ['street-walks', regionId, place?.lat, place?.lon, around.length],
    queryFn: async ({ signal }) => {
      const meters = await fetchWalkDistances(place!, around.map((i) => stops![i]), signal);
      return new Map(around.flatMap((i, k) => (meters[k] == null ? [] : [[i, meters[k]!] as [number, number]])));
    },
    enabled: around.length > 0,
    staleTime: 3600 * 1000,
    retry: false,
  });
  return isError ? EMPTY_WALKS : data;
}
const EMPTY_WALKS: StreetWalks = new Map();

export function useWalkingRoute(from: LatLon | null, to: LatLon | null) {
  return useQuery({
    queryKey: ['walking', from?.lat, from?.lon, to?.lat, to?.lon],
    queryFn: ({ signal }) => fetchWalkingRoute(from!, to!, signal),
    enabled: !!from && !!to && distanceM(from, to) < MAX_WALK_ROUTE_M,
    staleTime: 3600 * 1000,
    retry: false,
  });
}

type LineShapes = Record<string, PathPoint[]>;

const shapesQuery = (info: RegionInfo, line: string) =>
  staticQuery<Record<string, LineShapes>>(`${info.id}/shapes/${shardOf(line, info.shapeShards)}.json.gz`);

export function useAllShapes(enabled = true) {
  const { info } = useRegion();
  const shards = enabled && info ? info.shapeShards : 0;
  const results = useQueries({
    queries: Array.from({ length: shards }, (_, i) => staticQuery<Record<string, LineShapes>>(`${info!.id}/shapes/${i}.json.gz`)),
  });
  const ready = results.length > 0 && results.every((result) => result.data);
  return useMemo(
    () => (ready ? (Object.assign({}, ...results.map((result) => result.data)) as Record<string, LineShapes>) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, info?.id],
  );
}

export function useShapes(line?: string) {
  const { info } = useRegion();
  return useQuery({
    ...shapesQuery(info ?? PLACEHOLDER_REGION, line ?? ''),
    select: (shard): LineShapes | undefined => shard[line ?? ''],
    enabled: !!line && !!info,
  });
}

export function useJourneyPreview(journey: Journey | undefined, origin: LatLon | null, destination: LatLon | null) {
  const client = useQueryClient();
  const { info } = useRegion();
  const { data: stops } = useStops();
  const { data: patterns } = usePatterns();
  const setFocus = useUi((s) => s.setFocus);

  useEffect(() => {
    if (!journey || !origin || !destination || !stops || !patterns || !info) return;
    let cancelled = false;
    const requests = journeyWalks(journey, stops, origin, destination);
    const straight = requests.map(({ from, to }): PathPoint[] => [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ]);

    void (async () => {
      const lines = [...new Set(journey.legs.map((leg) => leg.line))];
      const loaded = await Promise.all(
        lines.map((line) =>
          client
            .fetchQuery(shapesQuery(info, line))
            .then((shard) => shard[line] ?? {})
            .catch((): LineShapes => ({})),
        ),
      );
      const shapes = new Map(lines.map((line, i) => [line, loaded[i]]));
      const shapeOf = (line: string, id: string) => shapes.get(line)?.[id];
      if (cancelled) return;
      setFocus({ journey: buildJourneyShape(journey, stops, patterns, shapeOf, straight) });

      const walked = await Promise.all(
        requests.map(({ from, to }, i) =>
          client
            .fetchQuery({
              queryKey: ['walking', from.lat, from.lon, to.lat, to.lon],
              queryFn: ({ signal }) => fetchWalkingRoute(from, to, signal),
              staleTime: 3600 * 1000,
              retry: false,
            })
            .then((route) => route.path)
            .catch(() => straight[i]),
        ),
      );
      if (!cancelled) setFocus({ journey: buildJourneyShape(journey, stops, patterns, shapeOf, walked) });
    })();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey && journey.legs.map((leg) => `${leg.line}${leg.from}${leg.to}`).join(), origin?.lat, destination?.lat, stops, patterns]);
}

const timetableQuery = (info: RegionInfo, stopId: string) =>
  staticQuery<Record<string, TimetableGroup[]>>(`${info.id}/timetables/${shardOf(stopId, info.timetableShards)}.json.gz`);

export function useStopIndex() {
  const { data } = useStops();
  return useMemo(() => new Map((data ?? []).map((s) => [s.id, s])), [data]);
}

export function useLineIndex() {
  const { data } = useLines();
  return useMemo(() => new Map((data ?? []).map((l) => [l.id, l])), [data]);
}

function useModeOf() {
  const lines = useLineIndex();
  return useMemo(() => (line: string): Mode | undefined => lines.get(line)?.mode, [lines]);
}

let feed: LiveFeed | null = null;

function feedFor(regionId: string): LiveFeed {
  if (feed?.regionId === regionId) return feed;
  feed?.stop();
  feed = new LiveFeed(regionId, regionConfig(regionId).realtime);
  const viewport = useUi.getState().viewport;
  if (viewport) feed.setViewport(viewport);
  void feed.start();
  return feed;
}

useUi.subscribe((state, previous) => {
  if (state.viewport && state.viewport !== previous.viewport) feed?.setViewport(state.viewport);
});

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) feed?.stop();
    else void feed?.start();
  });
}

export function useVehicles() {
  const region = useRegion();
  const modeOf = useModeOf();
  const lines = useLineIndex();
  const polled = region.config.realtime.kind === 'itsfactory';
  return useQuery({
    queryKey: ['vehicles', region.id, lines.size],

    queryFn: async ({ signal }) => movingOnly(polled ? await fetchVehicles({}, modeOf, signal) : feedFor(region.id).snapshot()),
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
    enabled: lines.size > 0,
    retry: 1,
  });
}

export function useLineStream(line: string | undefined) {
  const region = useRegion();
  const { data: patterns } = usePatterns();
  const streamed = region.config.realtime.kind !== 'itsfactory';

  const routes = useMemo(() => {
    if (!line || !patterns) return null;
    const ids = patterns.filter((p) => p.line === line).map((p) => p.shape.split('_')[0].split(' ')[0]);
    return [...new Set(ids.filter(Boolean))].sort();
  }, [line, patterns]);
  const key = routes?.join(',');
  useEffect(() => {
    if (!streamed || !routes) return;
    const live = feedFor(region.id);
    live.setLine(routes);
    return () => live.setLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamed, region.id, key]);
}

export function useVehicleDetail(ref?: string) {
  const region = useRegion();
  const modeOf = useModeOf();
  const predicted = useQuery({
    queryKey: ['vehicle', ref],
    queryFn: ({ signal }) => fetchVehicles({ vehicle: ref, withCalls: true }, modeOf, signal),
    select: (list): Vehicle | undefined => list[0],
    refetchInterval: DEPARTURES_POLL_MS,
    enabled: !!ref && region.hasPredictions,
    retry: 1,
  });
  const live = useVehicles();
  if (region.hasPredictions) return predicted;
  return { ...live, data: live.data?.find((v) => v.ref === ref) };
}

export interface RegionPhoto {
  url: string;

  large: string;
  author: string;
  license: string;
  source: string;
}

export const useRegionPhotos = () => useQuery(staticQuery<Record<string, RegionPhoto>>('city-photos-v2.json'));

export const useChargers = (enabled = true) =>
  useQuery({
    queryKey: ['chargers'],
    queryFn: ({ signal }) => fetchChargers(signal),
    enabled,
    staleTime: 3 * 3600 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });

export const useRoadEvents = (enabled = true) =>
  useQuery({
    queryKey: ['road-events'],
    queryFn: ({ signal }) => fetchRoadEvents(signal),
    enabled,
    staleTime: 100 * 1000,
    refetchInterval: 120 * 1000,
    retry: 1,
  });

export function useClosures(enabled = true) {
  const { data, isError } = useRoadEvents(enabled);
  const closed = useMemo(() => (data?.events ?? []).filter(isClosure), [data]);
  return {
    ready: !!data || isError,
    avoid: useMemo(() => closurePolygons(closed), [closed]),
    key: closed.map((event) => event.id).sort().join(','),
  };
}

export function useCarRoutes(from: LatLon | null, to: LatLon | null, language: string, via: LatLon[] = []) {
  const closures = useClosures(!!from && !!to);
  const stops = via.map((stop) => `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`).join(';');
  return useQuery({
    queryKey: ['car-routes', from?.lat.toFixed(4), from?.lon.toFixed(4), to?.lat.toFixed(4), to?.lon.toFixed(4), stops, language, closures.key],
    queryFn: ({ signal }) => fetchCarRoutes({ from: from!, to: to!, language, avoid: closures.avoid, via }, signal),
    enabled: !!from && !!to && closures.ready,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });
}

export const useChargerStatus = (enabled = true) =>
  useQuery({
    queryKey: ['charger-status'],
    queryFn: ({ signal }) => fetchChargerStatus(signal),
    enabled,
    staleTime: 50 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

export const useLandmarks = () => useQuery(staticQuery<Record<string, Landmark[]>>('landmarks.json'));

export function usePlaceTags(osm: string | null) {
  return useQuery({
    queryKey: ['place-tags', osm],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${siteUrl('/api/station')}?${new URLSearchParams({ osm: osm! })}`, { signal });
      if (!res.ok) throw new Error(`Place failed: ${res.status}`);
      return (await res.json()) as Record<string, string>;
    },
    enabled: !!osm,
    staleTime: 24 * 3600 * 1000,
    retry: 1,
  });
}

export const useFuelPrices = () => useQuery(staticQuery<FuelPrices>('fuel.json'));

export function useFuelStations(near: LatLon) {
  return useQuery({
    queryKey: ['fuel-stations', near.lat.toFixed(2), near.lon.toFixed(2)],
    queryFn: ({ signal }) => fetchFuelStations(near, signal),
    staleTime: 3600 * 1000,
    retry: 1,
  });
}

export function useStationDetails(station?: FuelStation) {
  return useQuery({
    queryKey: ['station-details', station?.osm],
    queryFn: ({ signal }) => fetchStationDetails(station!.osm!, signal),
    enabled: !!station?.osm,
    staleTime: 24 * 3600 * 1000,
    retry: 1,
  });
}

export function useReportedPrices(stations: FuelStation[] | undefined) {
  const ids = (stations ?? []).map((station) => station.id);
  return useQuery({
    queryKey: ['reported-prices', ids.join()],
    queryFn: async ({ signal }) => {
      const reports = await Promise.all(ids.map((id) => fetchReportedPrices(id, signal).catch(() => null)));
      return Object.fromEntries(ids.map((id, i) => [id, reports[i]])) as Record<string, ReportedPrices | null>;
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useTrains(fromRegion: string | undefined, toRegion: string | undefined, at: number) {
  const from = fromRegion && REGION_STATIONS[fromRegion];
  const to = toRegion && REGION_STATIONS[toRegion];
  return useQuery({
    queryKey: ['trains', from, to, Math.floor(at / 60_000)],
    queryFn: ({ signal }) => fetchTrains(from!, to!, at, signal),
    enabled: !!from && !!to && from !== to,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useStationTrains(from: string | null, to: string | null, at: number) {
  return useQuery({
    queryKey: ['station-trains', from, to, Math.floor(at / 60_000)],
    queryFn: ({ signal }) => fetchTrains(from!, to!, at, signal, 12),
    enabled: !!from && !!to && from !== to,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function usePlaceSearch(query: string, near?: LatLon | null) {
  const { center: cityCenter } = useRegion();
  const center = near ?? cityCenter;
  const trimmed = useDebounced(query.trim(), PLACE_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['places', trimmed, center.lat, center.lon],
    queryFn: ({ signal }) => searchPlaces(trimmed, center, signal),
    enabled: trimmed.length >= PLACE_MIN_CHARS,
    staleTime: 3600 * 1000,

    placeholderData: (previous) => (trimmed.length >= PLACE_MIN_CHARS ? previous : undefined),
    retry: false,
  });
}

export interface DeparturesResult {
  departures: Departure[];
  loading: boolean;

  liveFailed: boolean;
}

export function useDepartures(stop: Stop | undefined): DeparturesResult {
  const now = useNow();
  const region = useRegion();
  const { data: services } = useServices();
  const timetable = useQuery({
    ...timetableQuery(region.info ?? PLACEHOLDER_REGION, stop?.id ?? ''),
    select: (shard): TimetableGroup[] => (stop ? (shard[stop.id] ?? []) : []),
    enabled: !!stop && !!region.info,
  });
  const stops = useStopIndex();
  const modeOf = useModeOf();

  const live = useQuery({
    queryKey: ['stop-vehicles', region.id, stop?.id],
    queryFn: ({ signal }) => fetchVehicles({ lines: stop!.lines, withCalls: true }, modeOf, signal),
    refetchInterval: DEPARTURES_POLL_MS,
    enabled: !!stop && stop.lines.length > 0 && region.hasPredictions,
    retry: 1,
  });

  const departures = useMemo(() => {
    if (!stop || !services || !timetable.data) return [];
    const scheduled = upcomingDepartures(timetable.data, services, now - 10 * 60 * 1000, DEPARTURE_HORIZON_MS);
    return mergeDepartures(stop.id, scheduled, live.data ?? [], now, (id) => {
      const name = stops.get(id)?.name;
      return name ? stationName(name) : undefined;
    });
  }, [stop, services, timetable.data, live.data, now, stops]);

  return {
    departures,
    loading: !stop || timetable.isLoading || !services,
    liveFailed: live.isError,
  };
}

const LONG_TRAINS_MS = 15_000;

const TRAIN_MIN_MOVE_M = 30;
const trainHeadings = new Map<string, { lat: number; lon: number; bearing: number }>();

function trainBearing(id: string, lat: number, lon: number) {
  const last = trainHeadings.get(id);
  if (!last) {
    trainHeadings.set(id, { lat, lon, bearing: 0 });
    return 0;
  }
  const north = (lat - last.lat) * 111_320;
  const east = (lon - last.lon) * 111_320 * Math.cos((lat * Math.PI) / 180);
  if (Math.hypot(north, east) < TRAIN_MIN_MOVE_M) return last.bearing;
  const bearing = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
  trainHeadings.set(id, { lat, lon, bearing });
  return bearing;
}

export const useStations = () =>
  useQuery({ queryKey: ['long-stations'], queryFn: ({ signal }) => fetchStations(signal), staleTime: 24 * 60 * 60 * 1000, gcTime: Infinity });

export function useStationIndex() {
  const { data } = useStations();
  return useMemo(() => new Map((data ?? []).map((station) => [station.code, station])), [data]);
}

const longTrainsQuery = {
  queryKey: ['long-trains'],
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchLongTrains(signal),
  staleTime: LONG_TRAINS_MS,

  gcTime: 30 * 60 * 1000,
  retry: 1,
};

export function useLongTrains() {
  return useQuery({ ...longTrainsQuery, refetchInterval: LONG_TRAINS_MS });
}

const PREFETCH_TRAINS_AFTER_MS = 2500;

export function usePrefetchTrains() {
  const client = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => {
      void client.prefetchQuery(longTrainsQuery);
      void client.prefetchQuery({ queryKey: ['long-stations'], queryFn: ({ signal }) => fetchStations(signal), staleTime: 24 * 60 * 60 * 1000, gcTime: Infinity });
      void client.prefetchQuery(staticQuery<RailNetwork>('rail.json.gz'));
    }, PREFETCH_TRAINS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [client]);
}

export function useLongTrainVehicles(): Vehicle[] | undefined {
  const { data } = useLongTrains();
  return useMemo(
    () =>
      data?.map((train) => ({
        ref: `train:${train.id}`,
        line: train.label,
        mode: 'train' as Mode,
        lat: train.lat,
        lon: train.lon,
        bearing: trainBearing(train.id, train.lat, train.lon),
        speedKmh: train.speedKmh,
        delaySec: null,
        destinationStop: train.stops[train.stops.length - 1]?.code ?? '',
        onward: [],
      })),
    [data],
  );
}

export const useTrainRoute = (date: string, number: string) =>
  useQuery({
    queryKey: ['train-route', date, number],
    queryFn: ({ signal }) => fetchTrainRoute(date, number, signal),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

export const useStationDepartures = (code: string) =>
  useQuery({
    queryKey: ['station-departures', code],
    queryFn: ({ signal }) => fetchStationDepartures(code, signal),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

export interface RailNetwork {
  stations: Record<string, [number, number]>;

  segments: Record<string, [number, number][]>;
}

export const useRail = (enabled = true) => useQuery({ ...staticQuery<RailNetwork>('rail.json.gz'), enabled });

const WIKI_LANGUAGES = ['en', 'fi', 'sv', 'ru', 'et'];

export interface WikiSummary {
  extract: string;
  url: string;
}

export function useWikiSummary(source: { wiki?: Record<string, string>; wikipedia?: string; wikidata?: string }, language: string) {
  return useQuery({
    queryKey: ['wiki-summary', source.wiki, source.wikipedia, source.wikidata, language],
    queryFn: async ({ signal }): Promise<WikiSummary | null> => {
      let titles: Record<string, string> = { ...source.wiki };
      const tagged = /^([a-z]{2,3}):(.+)$/.exec(source.wikipedia ?? '');
      if (tagged) titles[tagged[1]] ??= tagged[2];
      if (!Object.keys(titles).length && source.wikidata && /^Q\d+$/.test(source.wikidata)) {
        const res = await fetch(
          `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: source.wikidata, props: 'sitelinks', sitefilter: WIKI_LANGUAGES.map((lang) => `${lang}wiki`).join('|'), format: 'json', origin: '*' })}`,
          { signal },
        );
        const links = res.ok ? ((await res.json()).entities?.[source.wikidata]?.sitelinks ?? {}) : {};
        titles = Object.fromEntries(Object.entries(links as Record<string, { title: string }>).map(([site, link]) => [site.replace(/wiki$/, ''), link.title]));
      }
      for (const lang of [language, ...WIKI_LANGUAGES.filter((l) => l !== language), ...Object.keys(titles)]) {
        const title = titles[lang];
        if (!title) continue;
        const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`, { signal });
        if (!res.ok) continue;
        const page = await res.json();
        if (page.extract) return { extract: page.extract as string, url: page.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` };
      }
      return null;
    },
    enabled: !!(source.wiki && Object.keys(source.wiki).length) || !!source.wikipedia || !!source.wikidata,
    staleTime: 7 * 24 * 3600 * 1000,
    retry: 1,
  });
}

export function usePlaceExtra(website?: string) {
  return useQuery({
    queryKey: ['place-extra', website],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${siteUrl('/api/place-extra')}?${new URLSearchParams({ url: website! })}`, { signal });
      if (res.status !== 200) return null;
      return (await res.json()) as { title?: string; description?: string; image?: string; hours?: string };
    },
    enabled: !!website && /^https?:\/\//.test(website),
    staleTime: 7 * 24 * 3600 * 1000,
    retry: 0,
  });
}

export type ExtraPlace = [number, number, string, string, string, string];

const placeCell = (lat: number, lon: number) => `${(Math.floor(lat * 2) / 2).toFixed(1)}_${Math.floor(lon)}`;
const MAX_PLACE_CELLS = 6;

export function useExtraPlaces(view: { west: number; south: number; east: number; north: number } | null) {
  const { data: index } = useQuery({ ...staticQuery<string[]>('places/index.json'), enabled: !!view });
  const keys = useMemo(() => {
    if (!view || !index) return [];
    const known = new Set(index);
    const found = new Set<string>();
    for (let lat = Math.floor(view.south * 2) / 2; lat <= view.north; lat += 0.5)
      for (let lon = Math.floor(view.west); lon <= view.east; lon += 1) {
        const key = placeCell(lat + 0.01, lon + 0.01);
        if (known.has(key)) found.add(key);
      }
    return [...found].slice(0, MAX_PLACE_CELLS);
  }, [view?.west, view?.south, view?.east, view?.north, index]);
  const results = useQueries({ queries: keys.map((key) => staticQuery<ExtraPlace[]>(`places/${key}.json`)) });
  const signature = results.map((result) => result.dataUpdatedAt).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => results.flatMap((result) => result.data ?? []), [signature]);
}

export const useSpeedCameras = (enabled = true) => useQuery({ ...staticQuery<FixedCamera[]>('speed-cameras.json'), enabled });

export function useRoadReports(enabled = true) {
  return useQuery({
    queryKey: ['road-reports'],
    queryFn: ({ signal }) => fetchRoadReports(signal),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSpeedLimits(route: CarRoute | undefined) {
  return useQuery({
    queryKey: ['speed-limits', route?.path.length, route?.meters, route?.path[0], route?.path.at(-1)],
    queryFn: ({ signal }) => fetchSpeedLimits(route!, signal),
    enabled: !!route,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useCategorySearch(category: Category | null, area: { lat: number; lon: number; radiusKm: number } | null) {
  return useQuery({
    queryKey: ['category', category?.id, area?.lat, area?.lon, area?.radiusKm],
    queryFn: ({ signal }) => searchCategory(category!.tags, area!, area!.radiusKm, signal),
    enabled: !!category && !!area,
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous) => (category ? previous : undefined),
    retry: 1,
  });
}

export function useBrandSearch(brand: Brand | null, area: { lat: number; lon: number } | null) {
  return useQuery({
    queryKey: ['brand', brand?.id, area?.lat, area?.lon],
    queryFn: ({ signal }) => searchBrand(brand!, area!, signal),
    enabled: !!brand && !!area,
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous) => (brand ? previous : undefined),
    retry: 1,
  });
}

export function useAtmSearch(enabled: boolean, area: { lat: number; lon: number; radiusKm: number } | null) {
  return useQuery({
    queryKey: ['atms', area?.lat, area?.lon, area?.radiusKm],
    queryFn: ({ signal }) => searchAtms(area!, area!.radiusKm, signal),
    enabled: enabled && !!area,
    staleTime: 30 * 60 * 1000,
    placeholderData: (previous) => (enabled ? previous : undefined),
    retry: 1,
  });
}
