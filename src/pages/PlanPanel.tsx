import {
  ArrowDownUp,
  ArrowRight,
  Building2,
  ChevronUp,
  Clock,
  Footprints,
  GraduationCap,
  History,
  Landmark,
  LocateFixed,
  MapPin,
  Navigation,
  Plane,
  Minus,
  Plus,
  Route,
  RotateCw,
  School,
  ShoppingBasket,
  TrainFront,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, LineBadge, LineChips, Message, MODE_BADGE, ModeDisc, ModeIcon, RowSkeleton, Segmented, useDistanceLabel, ZoneChip } from '@/components/ui';
import type { PlaceKind, Place as PlaceResult } from '@/core/geocode';
import { brandOf, matchBrand, type Brand } from '@/core/brands';
import { matchAirports } from '@/core/airports';
import { matchCategory } from '@/core/categories';
import { distanceM } from '@/core/geo';
import type { Bounds } from '@/core/live';
import {
  activeStarts,
  buildNetwork,
  journeySignature,
  laterDepartures,
  orderJourneys,
  PACE_FACTORS,
  planAround,
  planArrivingBy,
  planJourneys,
  planOnLines,
  walkingTime,
  type Journey,
  type JourneyOrder,
  type TripWalks,
} from '@/core/raptor';
import { IN_CITY_MARGIN_DEG, inBounds, regionAt, regionConfig, regionName } from '@/core/regions';
import { searchStops } from '@/core/search';
import { journeyZones } from '@/core/zones';
import { formatClock, serviceDay } from '@/core/time';
import type { LatLon, Line, Mode, Stop } from '@/core/types';
import {
  useJourneyPreview,
  useLineIndex,
  useLines,
  useNow,
  useAtmSearch,
  useBrandSearch,
  useCategorySearch,
  usePlaceSearch,
  useStations,
  useRegion,
  useRegionId,
  useRegions,
  useRoutes,
  useServices,
  useStopIndex,
  useStops,
  useTrains,
  useWalkingRoute,
  useCarRoutes,
  useStreetWalks,
} from '@/data/hooks';
import { startLocating, useReferencePoint } from '@/map/location';
import { primaryMode } from '@/map/MapView';
import { useSettings } from '@/state/settings';
import { useKeptState, useWasKept } from '@/state/kept';
import { useIsDesktop } from '@/theme';
import { useTrip } from '@/state/trip';
import { TripPanel } from './TripPanel';
import { CarOptions, CarSummary, TravelTabs, useDriveTime } from './CarPlan';
import { DrivePanel } from './DrivePanel';
import { askForLocation } from '@/components/LocationAsk';
import { dataUrl } from '@/platform';
import { useDrive } from '@/state/drive';
import { fetchCarRoutes, walksToRoute, type CarRoute } from '@/core/driving';
import { askCompass } from '@/map/compass';
import { useUi } from '@/state/ui';

type Place = { kind: 'me' } | { kind: 'stop'; stop: Stop } | { kind: 'point'; name: string; point: LatLon };

const WALK = 'walk';

const WINDING = 1.25;
const WALK_M_PER_S = 1.35;
const roughWalkSeconds = (from: LatLon, to: LatLon, pace: number) => (distanceM(from, to) * WINDING * pace) / WALK_M_PER_S;
const CLOCK_MS = 30_000;
const EMPTY_REPLAN_MS = 5 * 60_000;
const LATER_DEPARTURES = 2;
const MAX_SHOWN_RECENT = 5;
const COUNTDOWN_LIMIT_MIN = 120;

const GO_AHEAD_MS = 60 * 60_000;
const DAYS_AHEAD = 7;
const MINUTE_STEP = 5;

const PAST_HOURS = 4;

const PLACE_TILES: Record<PlaceKind, { icon: LucideIcon; tone: string }> = {
  street: { icon: Route, tone: 'bg-slate-500/15 text-slate-500' },
  address: { icon: MapPin, tone: 'bg-primary-soft text-primary' },
  school: { icon: School, tone: 'bg-amber-500/15 text-amber-600' },
  university: { icon: GraduationCap, tone: 'bg-indigo-500/15 text-indigo-500' },
  shop: { icon: ShoppingBasket, tone: 'bg-emerald-500/15 text-emerald-600' },
  food: { icon: Utensils, tone: 'bg-orange-500/15 text-orange-600' },
  landmark: { icon: Landmark, tone: 'bg-tram/15 text-tram' },
  station: { icon: TrainFront, tone: 'bg-train/15 text-train' },
  airport: { icon: Plane, tone: 'bg-sky-500/15 text-sky-600' },
  place: { icon: Building2, tone: 'bg-sky-500/15 text-sky-600' },
};

const MAX_NEARBY = 15;

function waitForLocation(timeoutMs = 15_000): Promise<LatLon | null> {
  const now = useUi.getState().location;
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, timeoutMs);
    const stop = useUi.subscribe((state) => {
      if (!state.location) return;
      clearTimeout(timer);
      stop();
      resolve(state.location);
    });
  });
}

const MAX_STOPS = 5;

interface SearchArea {
  lat: number;
  lon: number;
  radiusKm: number;

  chosen?: boolean;
}

function areaFromBounds(bounds: Bounds): SearchArea {
  const lat = (bounds.north + bounds.south) / 2;
  const lon = (bounds.east + bounds.west) / 2;
  const half = distanceM({ lat: bounds.south, lon: bounds.west }, { lat: bounds.north, lon: bounds.east }) / 2000;
  return { lat, lon, radiusKm: Math.min(40, Math.max(1, half)) };
}

function areaOfView(): SearchArea | null {
  const viewport = useUi.getState().viewport;
  return viewport ? areaFromBounds(viewport) : null;
}

function BrandTile({ brand, large }: { brand: Brand; large?: boolean }) {
  const size = large ? 'size-12 rounded-[15px]' : 'size-10 rounded-[13px]';
  return brand.icon ? (
    <span className={`grid shrink-0 place-items-center bg-white p-1.5 shadow-[0_1px_3px_rgba(16,24,40,0.18)] ${size}`}>
      <img src={dataUrl(`brands/${brand.id}.webp`)} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
    </span>
  ) : (
    <span className={`grid shrink-0 place-items-center text-[12px] font-extrabold text-white ${size}`} style={{ background: brand.color }}>
      {brand.short}
    </span>
  );
}

function NearbyRow({ place, meters, nearest, onClick }: { place: PlaceResult; meters: number; nearest: boolean; onClick: () => void }) {
  const { t, i18n } = useTranslation();
  const chain = brandOf(place.name);
  const { icon: Icon, tone } = PLACE_TILES[place.kind];
  const km = meters >= 1000;
  const value = km ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: meters < 10_000 ? 1 : 0 }).format(meters / 1000) : String(Math.round(meters / 10) * 10);
  return (
    <button type="button" onClick={onClick} className="press group flex w-full items-center gap-3 rounded-[18px] px-2 py-2 text-left active:bg-primary-soft">
      {chain ? (
        <BrandTile brand={chain} large />
      ) : (
        <span className={`grid size-12 shrink-0 place-items-center rounded-[15px] ${tone}`}>
          <Icon className="size-5.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15.5px] font-semibold">{place.name}</span>
          {nearest && <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">{t('search.nearest')}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">{place.detail || t(`place.${place.kind}`)}</span>
        {place.cashIn !== undefined && (
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${place.cashIn ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-raised text-muted'}`}>
            {t(place.cashIn ? 'search.atmIn' : place.cashIn === false ? 'search.atmOut' : 'search.atmCash')}
          </span>
        )}
      </span>
      {meters > 0 && (
        <span className="tabular shrink-0 text-right leading-none">
          <span className="block text-[17px] font-bold">{value}</span>
          <span className="mt-0.5 block text-[11px] font-semibold text-muted">{km ? t('search.km') : t('search.m')}</span>
        </span>
      )}
    </button>
  );
}

function SearchAreaButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  return createPortal(
    <div className={`pointer-events-none fixed z-30 flex justify-center ${desktop ? 'top-5 right-0 left-[420px]' : 'safe-top inset-x-0 top-[72px]'}`}>
      <button type="button" onClick={onClick} className="press pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-card px-5 text-[15px] font-semibold text-primary shadow-lg">
        <RotateCw className="size-4.5" />
        {t('search.thisArea')}
      </button>
    </div>,
    document.body,
  );
}

function placeKey(place: Place | null) {
  if (!place) return '';
  if (place.kind === 'me') return 'me';
  return place.kind === 'stop' ? place.stop.id : `${place.point.lat},${place.point.lon}`;
}

function ResultRow({
  tile,
  title,
  detail,
  onClick,
}: {
  tile: ReactNode;
  title: string;
  detail: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="press group flex w-full items-center gap-3 rounded-[16px] px-2 py-2 text-left active:bg-primary-soft">
      {tile}
      <span className="min-w-0 flex-1 border-b border-hairline pb-2 group-last:border-b-0 group-last:pb-0">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">{detail}</span>
      </span>
    </button>
  );
}

const tileClass = 'grid size-10 shrink-0 place-items-center rounded-full text-white';
const MAX_LINE_RESULTS = 4;

const MAX_LINE_QUERY = 6;

function matchLines(lines: Line[], query: string) {
  const typed = query.trim().toLowerCase().replace(/\s+/g, '');
  if (!typed || typed.length > MAX_LINE_QUERY) return [];
  return lines
    .filter((line) => line.id.toLowerCase().startsWith(typed))
    .sort(
      (a, b) =>
        Number(b.id.toLowerCase() === typed) - Number(a.id.toLowerCase() === typed) ||
        a.id.length - b.id.length ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    )
    .slice(0, MAX_LINE_RESULTS);
}

function PlaceField({
  label,
  marker,
  place,
  allowLocation,
  autoFocus = false,
  findsLines = false,
  onChange,
}: {
  label: string;
  marker: string;
  place: Place | null;
  allowLocation: boolean;
  autoFocus?: boolean;

  findsLines?: boolean;
  onChange: (place: Place | null) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stops } = useStops();
  const { data: allLines } = useLines();
  const lines = useLineIndex();
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (editing && !place) {
      input.current?.focus();
      input.current?.select();
      setEditing(false);
    }
  }, [editing, place]);
  const results = useMemo(() => searchStops(stops ?? [], query, 4), [stops, query]);
  const lineResults = useMemo(() => (findsLines ? matchLines(allLines ?? [], query) : []), [findsLines, allLines, query]);

  const searching = !place && query.trim().length > 0;
  const category = useMemo(() => (place ? null : matchCategory(query)), [place, query]);

  const brand = useMemo(() => (place || category ? null : matchBrand(query)), [place, category, query]);
  const kindId = category?.id ?? (brand ? `brand:${brand.id}` : undefined);
  const kindSearch = !!(category || brand);
  const [area, setArea] = useState<SearchArea | null>(null);
  useEffect(() => {
    setArea(searching ? areaOfView() : null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, kindId]);
  const { data: places } = usePlaceSearch(place ? '' : query, area);

  const atms = category?.id === 'atm';
  const [depositOnly, setDepositOnly] = useState(false);

  const airportHits = useMemo(() => (place ? [] : matchAirports(query, category?.id === 'airport', area ?? areaOfView())), [place, query, category, area]);

  const wideArea = useMemo(() => (area && category && ['station', 'bus_station', 'ferry'].includes(category.id) ? { ...area, radiusKm: Math.max(area.radiusKm, 30) } : area), [area, category]);

  const { data: railStations } = useStations();
  const stationHits = useMemo(() => {
    if (category?.id !== 'station' || !railStations) return [];
    const near = area ?? areaOfView();
    const far = (s: { lat: number; lon: number }) => (near ? distanceM(near, s) : 0);
    return [...railStations]
      .sort((a, b) => far(a) - far(b))
      .slice(0, 8)
      .map((s): PlaceResult => ({ id: `rail-${s.code}`, name: s.name, detail: t('place.station'), kind: 'station', lat: s.lat, lon: s.lon }));
  }, [category, railStations, area, t]);
  const categoryFound = useCategorySearch(searching && !atms && category?.id !== 'airport' && category?.id !== 'station' ? category : null, wideArea);
  const atmFound = useAtmSearch(searching && atms, area);
  const brandFound = useBrandSearch(searching ? brand : null, area);
  const nearby = atms ? atmFound.data?.filter((atm) => !depositOnly || atm.cashIn) : category?.id === 'airport' ? airportHits : category?.id === 'station' ? stationHits : category ? categoryFound.data : brand ? brandFound.data : undefined;
  const nearbyLoading = atms ? atmFound.isFetching : category ? categoryFound.isFetching : brand ? brandFound.isFetching : false;
  const shownNearby = useMemo(() => (kindSearch ? (nearby ?? []).slice(0, MAX_NEARBY) : []), [kindSearch, nearby]);
  const pinned = useMemo(() => (kindSearch ? shownNearby : (places ?? [])), [kindSearch, shownNearby, places]);

  useEffect(() => {
    const ui = useUi.getState();
    if (searching && pinned.length) ui.setSearchPins(
        pinned.map((p, index) => {
          const chain = brandOf(p.name);

          const label = chain ? (p.detail.split(',')[0] || p.name) : p.name;
          return { id: p.id, name: label, lat: p.lat, lon: p.lon, icon: `result-pin|${chain ? chain.id : `kind:${p.cashIn !== undefined ? (p.cashIn ? 'atmin' : 'atm') : p.kind}`}${index === 0 && kindSearch ? '|near' : ''}` };
        }),
      );
    else if (ui.searchPins) ui.setSearchPins(null);
  }, [searching, pinned, kindSearch]);
  useEffect(() => () => useUi.getState().setSearchPins(null), []);

  const fitted = useRef('');
  const [baseline, setBaseline] = useState<SearchArea | null>(null);
  useEffect(() => setBaseline(null), [area]);
  useEffect(() => {
    if (!searching || !pinned.length) return;
    const key = `${kindId}|${area?.lat}|${area?.lon}`;
    if (kindSearch && area && !area.chosen && fitted.current !== key) {
      fitted.current = key;

      const away = pinned.map((p) => distanceM(area, p));
      const reach = Math.max(1500, (away[Math.min(2, away.length - 1)] ?? 0) * 2);
      const close = pinned.filter((_, i) => i < 3 || away[i] <= reach).slice(0, 10);
      const lons = close.map((p) => p.lon);
      const lats = close.map((p) => p.lat);
      useUi.getState().fitTo([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
      const timer = setTimeout(() => setBaseline(areaOfView()), 1600);
      return () => clearTimeout(timer);
    }
    setBaseline((current) => current ?? areaOfView());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, area]);

  const viewport = useUi((s) => s.viewport);
  const view = viewport ? areaFromBounds(viewport) : null;

  const desktopView = useIsDesktop();
  const mapCovered = useUi((s) => s.snap === 'full') && !desktopView;
  const moved = !mapCovered && !!(searching && pinned.length && view && baseline) && (distanceM(view, baseline) > baseline.radiusKm * 350 || view.radiusKm > baseline.radiusKm * 1.8 || view.radiusKm < baseline.radiusKm / 1.8);

  const picked = useUi((s) => s.pickedPin);
  const pickedKey = useRef(picked?.key);
  const recent = useSettings((s) => s.recentPlaces);
  const rememberPlace = useSettings((s) => s.rememberPlace);
  const forgetPlaces = useSettings((s) => s.forgetPlaces);
  const shownRecent = query.trim() ? [] : recent.slice(0, MAX_SHOWN_RECENT);

  const choose = (next: Place, detail: string) => {
    setQuery('');
    if (next.kind === 'stop') rememberPlace({ name: next.stop.name, detail, lat: next.stop.lat, lon: next.stop.lon });
    if (next.kind === 'point') rememberPlace({ name: next.name, detail, lat: next.point.lat, lon: next.point.lon });
    onChange(next);
  };
  useEffect(() => {
    if (!picked || picked.key === pickedKey.current) return;
    pickedKey.current = picked.key;
    const hit = pinned.find((p) => p.id === picked.id);
    if (hit) choose({ kind: 'point', name: hit.name, point: hit }, hit.detail || t(`place.${hit.kind}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  return (
    <div className="p-1">
      <div className="flex min-h-12 items-center gap-3 rounded-[16px] bg-raised px-3.5 focus-within:ring-2 focus-within:ring-primary">
        <span aria-hidden className={`size-3.5 shrink-0 rounded-full ${marker}`} />
        {place ? (
          <>
            <button
              type="button"
              aria-label={label}
              onClick={() => {
                setQuery(place.kind === 'me' ? '' : place.kind === 'stop' ? place.stop.name : place.name);
                setEditing(true);
                onChange(null);
              }}
              className="min-w-0 flex-1 truncate pr-9 text-left font-semibold"
            >
              {place.kind === 'me' ? t('plan.myLocation') : place.kind === 'stop' ? place.stop.name : place.name}
            </button>
            <button type="button" aria-label={t('common.close')} onClick={() => onChange(null)} className="grid size-8 place-items-center">
              <X className="size-[18px] text-(--muted-icon)" />
            </button>
          </>
        ) : (
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('plan.chooseStop')}
            aria-label={label}
            autoFocus={autoFocus}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          />
        )}
      </div>
      {moved && <SearchAreaButton onClick={() => setArea({ ...areaOfView()!, chosen: true })} />}
      {!place && (results.length > 0 || airportHits.length > 0 || lineResults.length > 0 || allowLocation || !!places?.length || shownRecent.length > 0 || kindSearch) && (
        <div className="px-1 pt-2 pb-1">
          {kindSearch && (
            <p className="flex items-center justify-between px-2 pt-2 pb-1 text-[12px] font-bold tracking-wide text-muted uppercase">
              {t('search.nearby')}
              {nearbyLoading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            </p>
          )}
          {atms && (
            <div className="flex gap-1.5 px-2 pb-1.5">
              {[false, true].map((only) => (
                <button
                  key={String(only)}
                  type="button"
                  onClick={() => setDepositOnly(only)}
                  aria-pressed={depositOnly === only}
                  className={`press h-8 rounded-full px-3.5 text-[13px] font-semibold ${depositOnly === only ? 'primary-fill' : 'bg-raised'}`}
                >
                  {t(only ? 'search.atmDeposit' : 'search.atmAll')}
                </button>
              ))}
            </div>
          )}
          {kindSearch && !nearbyLoading && !shownNearby.length && <p className="px-2 py-2 text-[14px] text-muted">{t('search.nothingNearby')}</p>}
          {shownNearby.map((result, index) => (
            <NearbyRow
              key={`near-${result.id}`}
              place={result}
              meters={area ? distanceM(area, result) : 0}
              nearest={index === 0}
              onClick={() => choose({ kind: 'point', name: result.name, point: result }, result.detail || t(`place.${result.kind}`))}
            />
          ))}
          {allowLocation && (
            <ResultRow
              tile={
                <span className={`${tileClass} bg-primary-soft text-primary`}>
                  <LocateFixed className="size-5" />
                </span>
              }
              title={t('plan.myLocation')}
              detail={t('plan.myLocationHint')}
              onClick={() =>

                void askForLocation('start').then((yes) => yes && onChange({ kind: 'me' }))
              }
            />
          )}
          {shownRecent.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-2 pt-2 pb-1">
              <span className="text-[12px] font-bold tracking-wide text-muted uppercase">{t('plan.recent')}</span>
              <button type="button" onClick={forgetPlaces} className="py-1 text-[13px] font-medium text-primary">
                {t('plan.clearRecent')}
              </button>
            </div>
          )}
          {shownRecent.map((recentPlace) => (
            <ResultRow
              key={`${recentPlace.name}-${recentPlace.lat}-${recentPlace.lon}`}
              tile={
                <span className={`${tileClass} bg-slate-500/15 text-slate-500`}>
                  <History className="size-5" />
                </span>
              }
              title={recentPlace.name}
              detail={recentPlace.detail}
              onClick={() => choose({ kind: 'point', name: recentPlace.name, point: recentPlace }, recentPlace.detail)}
            />
          ))}
          {lineResults.map((line) => (
            <ResultRow
              key={`line-${line.id}`}
              tile={
                <span className={`${tileClass} ${MODE_BADGE[line.mode]} tabular px-0.5 font-bold ${line.id.length > 3 ? 'text-[12px]' : 'text-[16px]'}`}>
                  <span className="max-w-full truncate">{line.id}</span>
                </span>
              }
              title={line.name || line.id}
              detail={t(`search.lineHint.${line.mode}`)}
              onClick={() => navigate(`/routes/${encodeURIComponent(line.id)}?nearest=1`)}
            />
          ))}
          {!kindSearch &&
            airportHits.map((result) => (
              <ResultRow
                key={result.id}
                tile={
                  <span className={`${tileClass} ${PLACE_TILES.airport.tone}`}>
                    <Plane className="size-5" />
                  </span>
                }
                title={result.name}
                detail={result.detail}
                onClick={() => choose({ kind: 'point', name: result.name, point: result }, result.detail)}
              />
            ))}
          {results.length > 0 && <p className="px-2 pt-2 pb-1 text-[12px] font-bold tracking-wide text-muted uppercase">{t('search.stops')}</p>}
          {results.map((stop) => {
            const mode = primaryMode(stop, (line) => lines.get(line)?.mode);
            return (
              <ResultRow
                key={stop.id}
                tile={
                  <span className={`${tileClass} ${MODE_BADGE[mode]}`}>
                    <ModeIcon mode={mode} />
                  </span>
                }
                title={stop.name}
                detail={<LineChips lines={stop.lines} max={5} />}
                onClick={() => choose({ kind: 'stop', stop }, stop.city)}
              />
            );
          })}
          {!brand && !!places?.length && <p className="px-2 pt-2 pb-1 text-[12px] font-bold tracking-wide text-muted uppercase">{t('search.places')}</p>}
          {!brand && places?.map((result) => {
            const { icon: Icon, tone } = PLACE_TILES[result.kind];
            return (
              <ResultRow
                key={result.id}
                tile={
                  brandOf(result.name) ? (
                    <BrandTile brand={brandOf(result.name)!} />
                  ) : (
                    <span className={`${tileClass} ${tone}`}>
                      <Icon className="size-5" />
                    </span>
                  )
                }
                title={result.name}
                detail={result.detail || t(`place.${result.kind}`)}
                onClick={() => choose({ kind: 'point', name: result.name, point: result }, result.detail || t(`place.${result.kind}`))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export type TimeMode = 'depart' | 'arrive';

const WHEEL_ROW = 46;
const WHEEL_LAPS = 7;
const WHEEL_SETTLE_MS = 90;

function ClockDrum({ value, unit, wrap, label, onStep }: { value: number; unit: number; wrap: number; label: string; onStep: (steps: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const count = wrap / unit;
  const index = Math.round(value / unit) % count;
  const own = useRef(false);
  const latest = useRef(index);
  latest.current = index;
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const middle = (i: number) => (Math.floor(WHEEL_LAPS / 2) * count + i) * WHEEL_ROW;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (own.current) {
      own.current = false;
      return;
    }
    const target = middle(index);
    const first = el.dataset.ready !== '1';
    el.dataset.ready = '1';
    el.scrollTo({ top: target, behavior: first ? 'instant' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = box.current;
      if (!el) return;
      const row = Math.round(el.scrollTop / WHEEL_ROW);
      const at = ((row % count) + count) % count;

      const lap = Math.floor(row / count);
      if (lap !== Math.floor(WHEEL_LAPS / 2)) el.scrollTo({ top: middle(at), behavior: 'instant' });
      if (at !== index) {
        let steps = at - index;
        if (steps > count / 2) steps -= count;
        if (steps < -count / 2) steps += count;
        own.current = true;
        navigator.vibrate?.(5);
        onStep(steps);

        setTimeout(() => {
          own.current = false;
          if (latest.current !== at) box.current?.scrollTo({ top: middle(latest.current), behavior: 'smooth' });
        }, 80);
      }
    }, WHEEL_SETTLE_MS);
  };

  return (
    <div
      ref={box}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') onStep(-1);
        if (e.key === 'ArrowDown') onStep(1);
      }}
      className="relative w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        height: WHEEL_ROW * 3,
        paddingBlock: WHEEL_ROW,
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
      }}
    >
      {Array.from({ length: count * WHEEL_LAPS }, (_, i) => (
        <div key={i} className="time-digits tabular grid snap-center place-items-center text-[40px] leading-none" style={{ height: WHEEL_ROW }}>
          {String((i % count) * unit).padStart(2, '0')}
        </div>
      ))}
    </div>
  );
}

function DepartureTime({
  value,
  mode,
  now,
  onChange,
  onModeChange,
  onDone,
}: {
  value: number | null;
  mode: TimeMode;
  now: number;
  onChange: (value: number | null) => void;
  onModeChange: (mode: TimeMode) => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const setSnap = useUi((s) => s.setSnap);
  const chip = 'press flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold';
  const step = MINUTE_STEP * 60_000;
  const moment = new Date(value ?? Math.ceil(now / step) * step);
  const change = (edit: (date: Date) => void) => {
    const next = new Date(moment);
    edit(next);
    onChange(next.getTime());
  };
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    return date;
  });
  const dayLabel = (date: Date, i: number) =>
    i === 0 ? t('plan.today') : i === 1 ? t('plan.tomorrow') : date.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' });
  const when = moment.toLocaleString(i18n.language, { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const label = value === null ? t('plan.chooseTime') : mode === 'arrive' ? t('plan.arriveBy', { time: when }) : t('plan.leaveAt', { time: when });

  const earliest = now - PAST_HOURS * 3600_000;
  const latest = now + DAYS_AHEAD * 24 * 3600_000;
  const shift = (ms: number) => onChange(Math.min(latest, Math.max(earliest, moment.getTime() + ms)));
  const shifts = [-3 * 60, -60, -15, 15, 60, 3 * 60];
  const shiftLabel = (minutes: number) =>
    `${minutes < 0 ? '−' : '+'}${Math.abs(minutes) >= 60 ? t('plan.shiftHours', { count: Math.abs(minutes) / 60 }) : t('plan.shiftMinutes', { count: Math.abs(minutes) })}`;
  const past = moment.getTime() < now - 60_000;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => {
            onChange(null);
            onModeChange('depart');
            setOpen(false);
          }}
          className={`${chip} shrink-0 ${value === null ? 'primary-fill' : 'bg-raised'}`}
        >
          {t('plan.departNow')}
        </button>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);

            if (!open) setSnap('full');
          }}
          className={`${chip} flex-1 ${value === null ? 'bg-raised' : 'primary-fill'}`}
        >
          <Clock className="size-[18px] shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </div>
      {open && (
        <div className="time-panel mt-2 overflow-hidden rounded-[24px] p-3.5">
          <Segmented<TimeMode>
            value={mode}
            onChange={(next) => {
              onModeChange(next);

              if (value === null) onChange(moment.getTime());
            }}
            options={[
              { value: 'depart', label: t('plan.depart') },
              { value: 'arrive', label: t('plan.arrive') },
            ]}
          />

          <div className="relative mt-3 flex items-center justify-center gap-2">
            <span aria-hidden className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-raised/80" style={{ height: WHEEL_ROW }} />
            {(['hours', 'minutes'] as const).map((part, index) => (
              <Fragment key={part}>
                {index === 1 && <span className="time-digits relative -mt-1 text-[36px] text-muted">:</span>}
                <div className="relative w-[96px]">
                  <ClockDrum
                    value={part === 'hours' ? moment.getHours() : moment.getMinutes()}
                    unit={part === 'hours' ? 1 : MINUTE_STEP}
                    wrap={part === 'hours' ? 24 : 60}
                    label={t(`plan.${part}`)}
                    onStep={(steps) => shift(steps * (part === 'hours' ? 3600_000 : step))}
                  />
                </div>
              </Fragment>
            ))}
          </div>
          {past && <p className="mt-1 text-center text-[13px] font-medium text-muted">{t('plan.inThePast')}</p>}

          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {shifts.map((minutes) => (
              <button key={minutes} type="button" onClick={() => shift(minutes * 60_000)} className="press h-9 rounded-full bg-raised text-[13px] font-semibold tabular">
                {shiftLabel(minutes)}
              </button>
            ))}
          </div>

          <div className="-mx-3.5 mt-3 flex gap-1.5 overflow-x-auto px-3.5 [scrollbar-width:none]">
            {days.map((date, i) => {
              const active = date.toDateString() === moment.toDateString();
              return (
                <button
                  key={date.toDateString()}
                  type="button"
                  aria-pressed={active}
                  onClick={() => change((next) => next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate()))}
                  className={`press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold ${active ? 'primary-fill' : 'bg-raised'}`}
                >
                  {dayLabel(date, i)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDone();
            }}
            className="primary-fill press mt-3 h-12 w-full rounded-full font-semibold"
          >
            {t('plan.timeDone')}
          </button>
        </div>
      )}
    </div>
  );
}

function TrainOptions({ from, to, at }: { from: string; to: string; at: number }) {
  const { t, i18n } = useTranslation();
  const { data: trains, isLoading } = useTrains(from, to, at);
  const name = (id: string) => regionName(regionConfig(id), i18n.language);

  return (
    <>
      <p className="mb-2.5 px-1 text-[14px] text-muted">{t('plan.intercity', { from: name(from), to: name(to) })}</p>
      {isLoading && (
        <Card>
          <RowSkeleton rows={2} />
        </Card>
      )}
      {trains && !trains.length && <Message>{t('plan.noTrains')}</Message>}
      {trains?.map((train) => (
        <Card key={`${train.name}-${train.departure}`} className="mb-2.5 flex items-center gap-3 p-3.5">
          <ModeDisc mode="train" />
          <span className="min-w-0 flex-1">
            <span className="tabular block text-[17px] font-semibold">
              {formatClock(train.departure)} <ArrowRight className="inline size-4 align-[-2px] text-(--muted-icon)" /> {formatClock(train.arrival)}
            </span>
            <span className="block truncate text-[13px] text-muted">{train.name}</span>
          </span>
          <span className="tabular shrink-0 text-muted">{t('plan.duration', { count: Math.round((train.arrival - train.departure) / 60_000) })}</span>
        </Card>
      ))}
    </>
  );
}

const walkMinutesOf = (seconds: number) => Math.max(1, Math.round(seconds / 60));

function JourneyCard({
  journey,
  dayStart,
  now,
  live,
  starts,
  stops,
  selected,
  onSelect,
  zones,
}: {
  journey: Journey;

  zones: string | null;
  dayStart: number;
  now: number;

  live: boolean;
  starts: Int32Array[];
  stops: Stop[];
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const lines = useLineIndex();
  const clock = (seconds: number) => formatClock(dayStart + seconds * 1000);
  const minutes = Math.round((journey.arriveAt - journey.leaveAt) / 60);
  const changes = journey.legs.length - 1;
  const wait = Math.ceil((dayStart + journey.leaveAt * 1000 - now) / 60_000);
  const later = laterDepartures(starts, journey, LATER_DEPARTURES);

  const modeOf = (line: string) => lines.get(line)?.mode ?? 'bus';

  const pieces: { key: string; seconds: number; line?: string }[] = [];
  if (journey.walkStartS > 30) pieces.push({ key: 'walk-start', seconds: journey.walkStartS });
  journey.legs.forEach((leg, i) => {
    if (i > 0 && leg.walkBefore > 30) pieces.push({ key: `walk-${i}`, seconds: leg.walkBefore });
    pieces.push({ key: `ride-${i}`, seconds: Math.max(60, leg.arrival - leg.departure), line: leg.line });
  });
  if (journey.walkEndS > 30) pieces.push({ key: 'walk-end', seconds: journey.walkEndS });

  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className="press mb-2.5 block w-full text-left">
      <Card className={`overflow-hidden transition-shadow ${selected ? 'ring-2 ring-primary' : ''}`}>
        <div className={`flex items-center justify-between gap-2 px-4 pt-3.5 ${selected ? 'primary-fill pb-3' : ''}`}>
          <span className="tabular text-[19px] leading-none font-bold tracking-[-0.01em]">
            {clock(journey.leaveAt)}
            <ArrowRight className={`mx-1 inline size-[17px] align-[-2px] ${selected ? 'opacity-80' : 'text-(--muted-icon)'}`} />
            {clock(journey.arriveAt)}
          </span>
          <span className={`tabular shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${selected ? 'bg-white/20' : 'bg-raised text-ink'}`}>
            {t('plan.duration', { count: minutes })}
          </span>
        </div>
        <div className="px-4 pt-3 pb-3.5">
          <div className="flex items-center gap-[3px]" aria-hidden="true">
            {pieces.map((piece) =>
              piece.line ? (
                <span
                  key={piece.key}
                  style={{ flexGrow: piece.seconds }}
                  className={`${MODE_BADGE[modeOf(piece.line)]} tabular flex h-[22px] min-w-[30px] basis-0 items-center justify-center truncate rounded-[7px] px-1 text-[11.5px] font-bold text-white`}
                >
                  {piece.line}
                </span>
              ) : (
                <span key={piece.key} style={{ flexGrow: piece.seconds }} className="h-[5px] min-w-[10px] basis-0 rounded-full bg-[radial-gradient(circle,var(--muted-icon)_1.2px,transparent_1.6px)] bg-[length:6px_5px] bg-repeat-x opacity-80" />
              ),
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {live && wait < COUNTDOWN_LIMIT_MIN && (
              <span className="font-semibold text-primary">{wait <= 0 ? t('plan.leaveNow') : t('plan.leaveIn', { count: wait })}</span>
            )}
            <span className="text-muted">{changes === 0 ? t('plan.direct') : changes === 1 ? t('plan.oneChange') : t('plan.changes', { count: changes })}</span>
            {zones && <ZoneChip zones={zones} />}
            {later.length > 0 && <span className="tabular text-muted">{t('plan.later', { times: later.map(clock).join(', ') })}</span>}
          </div>
          <ol className="mt-3 space-y-2 text-[13.5px]">
            {journey.walkStartS > 30 && <WalkStep seconds={journey.walkStartS} />}
            {journey.legs.map((leg, i) => (
              <Fragment key={`${leg.line}-${leg.from}-detail`}>
                {i > 0 && leg.walkBefore > 30 && <WalkStep seconds={leg.walkBefore} />}
                <li className="flex gap-2.5">
                  <span className="pt-px">
                    <LineBadge line={leg.line} mode={modeOf(leg.line)} size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t('plan.legDetail', { from: stops[leg.from].name, time: clock(leg.departure) })}</span>
                    <span className="block truncate text-muted">
                      {t('plan.getOffAt', { stop: stops[leg.to].name })} · <span className="tabular">{clock(leg.arrival)}</span>
                    </span>
                  </span>
                </li>
              </Fragment>
            ))}
            {journey.walkEndS > 30 && <WalkStep seconds={journey.walkEndS} />}
          </ol>
        </div>
      </Card>
    </button>
  );
}

function WalkStep({ seconds }: { seconds: number }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-2.5 text-muted">
      <span className="grid h-[22px] w-[28px] place-items-center rounded-[8px] bg-raised">
        <Footprints className="size-3.5" />
      </span>
      {t('plan.walk', { count: walkMinutesOf(seconds) })}
    </li>
  );
}

const BADGE_GAP_PX = 4;

const MORE_CHIP_PX = 30;

function FittingBadges({ badges }: { badges: { key: string; line: string; mode: Mode }[] }) {
  const box = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(badges.length);
  const signature = badges.map((badge) => badge.key).join(',');

  useLayoutEffect(() => {
    const room = box.current;
    const row = measure.current;
    if (!room || !row) return;
    const fit = () => {
      const widths = [...row.children].map((child) => (child as HTMLElement).offsetWidth);
      const total = widths.reduce((sum, width) => sum + width, 0) + BADGE_GAP_PX * (widths.length - 1);
      if (total <= room.clientWidth) return setShown(widths.length);
      let used = MORE_CHIP_PX;
      let count = 0;
      while (count < widths.length && used + widths[count] + BADGE_GAP_PX <= room.clientWidth) used += widths[count++] + BADGE_GAP_PX;
      setShown(Math.max(1, count));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(room);
    return () => observer.disconnect();
  }, [signature]);

  return (
    <span ref={box} className="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      <span ref={measure} aria-hidden="true" className="invisible absolute flex gap-1">
        {badges.map((badge) => (
          <LineBadge key={badge.key} line={badge.line} mode={badge.mode} size="sm" />
        ))}
      </span>
      {badges.slice(0, shown).map((badge) => (
        <LineBadge key={badge.key} line={badge.line} mode={badge.mode} size="sm" />
      ))}
      {shown < badges.length && <span className="tabular shrink-0 text-[13px] font-semibold text-muted">+{badges.length - shown}</span>}
    </span>
  );
}

function PlanSummary({
  journey,
  origin,
  destination,
  dayStart,
  scheduled,
  onExpand,
  onGo,
  zones,
}: {
  journey?: Journey;
  zones?: string | null;
  origin: LatLon;
  destination: LatLon;
  dayStart: number;

  scheduled: boolean;
  onExpand: () => void;

  onGo?: () => void;
}) {
  const { t } = useTranslation();
  const lines = useLineIndex();
  const { data: walk } = useWalkingRoute(origin, destination);

  const longTime = useDriveTime();
  const clock = (seconds: number) => formatClock(dayStart + seconds * 1000);
  const pace = PACE_FACTORS[useSettings((s) => s.walkingPace)];

  const walkSeconds = walk ? walk.seconds * pace : (walkingTime(origin, destination, pace) ?? roughWalkSeconds(origin, destination, pace));

  return (
    <div className="flex items-center gap-2">
    <button type="button" aria-label={t('routes.plan')} onClick={onExpand} className="press flex h-[54px] min-w-0 flex-1 items-center gap-2 text-left">
      {journey ? (
        <>
          {scheduled && <Clock className="size-[18px] shrink-0 text-primary" />}
          <span className="tabular shrink-0 text-[16px] font-semibold">
            {clock(journey.leaveAt)} <ArrowRight className="inline size-4 align-[-2px] text-(--muted-icon)" /> {clock(journey.arriveAt)}
          </span>
          <FittingBadges badges={journey.legs.map((leg) => ({ key: `${leg.line}-${leg.from}`, line: leg.line, mode: lines.get(leg.line)?.mode ?? 'bus' }))} />
          {zones && <ZoneChip zones={zones} compact />}
          <span className="tabular shrink-0 text-muted max-[350px]:hidden">{t('plan.duration', { count: Math.round((journey.arriveAt - journey.leaveAt) / 60) })}</span>
        </>
      ) : (
        <>
          <Footprints className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-semibold">{t('plan.onFoot')}</span>
          <span className="tabular shrink-0 font-semibold">{longTime(walkSeconds)}</span>
        </>
      )}
      {!onGo && <ChevronUp className="size-5 shrink-0 text-(--muted-icon)" />}
    </button>
    {onGo && (
      <button type="button" onClick={onGo} aria-label={t('trip.go')} title={t('trip.go')} className="press primary-fill grid size-11 shrink-0 place-items-center rounded-full">
        <Navigation className="size-5" />
      </button>
    )}
    </div>
  );
}

function WalkingCard({
  origin,
  destination,
  selected,
  onSelect,
}: {
  origin: LatLon;
  destination: LatLon;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const distanceLabel = useDistanceLabel();
  const { data: route } = useWalkingRoute(origin, destination);
  const longTime = useDriveTime();
  const pace = PACE_FACTORS[useSettings((s) => s.walkingPace)];
  const estimate = walkingTime(origin, destination, pace);

  const seconds = route ? route.seconds * pace : (estimate ?? roughWalkSeconds(origin, destination, pace));
  const meters = route?.meters ?? distanceM(origin, destination) * 1.3;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`surface-card press mb-2.5 flex w-full items-center gap-3 rounded-card p-3.5 text-left ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${selected ? 'primary-fill' : 'bg-raised text-primary'}`}>
        <Footprints className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('plan.onFoot')}</span>
        <span className="block truncate text-[13px] text-muted">{distanceLabel(meters)}</span>
      </span>
      <span className="tabular shrink-0 text-[17px] font-semibold">{longTime(seconds)}</span>
    </button>
  );
}

const STREET_WAIT_MS = 1500;
const NO_WALKS: TripWalks = {};

export function PlanPanel({
  initialTo,
  initialPoint,
  initialFrom,
  ride,
  startTyping = false,
}: {
  initialTo?: string;
  initialPoint?: { name: string; point: LatLon };
  initialFrom?: { name: string; point: LatLon };

  ride?: string;

  startTyping?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const travel = useSettings((s) => s.travel);
  const setTravel = useSettings((s) => s.setTravel);
  const driveTime = useDriveTime();
  const stopIndex = useStopIndex();
  const { data: stops } = useStops();
  const { data: rawRoutes, isLoading: routesLoading } = useRoutes();
  const { data: services } = useServices();
  const { point, isRider, isFar } = useReferencePoint();
  const now = useNow(CLOCK_MS);

  const [departAt, setDepartAt] = useKeptState<number | null>('departAt', null);
  const [timeMode, setTimeMode] = useKeptState<TimeMode>('timeMode', 'depart');
  const arriveBy = timeMode === 'arrive' && departAt !== null;

  const around = timeMode === 'depart' && departAt !== null;
  const [plannedAt, setPlannedAt] = useKeptState('plannedAt', now);
  const at = departAt ?? plannedAt;
  const noLocation = useSettings((s) => s.noLocation);

  const [from, setFrom] = useKeptState<Place | null>('from', () => (initialFrom ? { kind: 'point', ...initialFrom } : isRider || (startTyping && !isFar && !noLocation) ? { kind: 'me' } : null));
  const locationError = useUi((s) => s.locationError);

  useEffect(() => {
    if (from?.kind === 'me' && !isRider) startLocating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (locationError) setFrom((place) => (place?.kind === 'me' ? null : place));
  }, [locationError]);
  const [to, setTo] = useKeptState<Place | null>('to', () => (initialPoint ? { kind: 'point', ...initialPoint } : null));

  const routeEnd = useUi((s) => s.routeEnd);
  useEffect(() => {
    if (!routeEnd) return;
    const place: Place = { kind: 'point', name: routeEnd.name, point: routeEnd.point };
    if (routeEnd.role === 'from') setFrom(place);
    else setTo(place);
    useUi.getState().setRouteEnd(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeEnd]);

  useEffect(() => {
    const stop = initialTo ? stopIndex.get(initialTo) : undefined;
    if (stop) setTo({ kind: 'stop', stop });
  }, [initialTo, stopIndex]);

  const coords = (place: Place | null): LatLon | null => {
    if (!place) return null;
    if (place.kind === 'stop') return place.stop;
    if (place.kind === 'point') return place.point;

    return isRider ? { lat: Number(point.lat.toFixed(3)), lon: Number(point.lon.toFixed(3)) } : null;
  };
  const origin = coords(from);
  const destination = coords(to);

  const [waypoints, setWaypoints] = useKeptState<(Place | null)[]>('waypoints', () => []);
  const via = useMemo(() => waypoints.flatMap((stop) => coords(stop) ?? []), [waypoints]);

  const pace = PACE_FACTORS[useSettings((s) => s.walkingPace)];
  const network = useMemo(() => (stops && rawRoutes ? buildNetwork(stops, rawRoutes, pace) : null), [stops, rawRoutes, pace]);
  const day = serviceDay(at);
  const starts = useMemo(
    () => (network && services ? activeStarts(network, services, at) : null),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network, services, day.date],
  );

  const nowMinute = Math.floor(now / 60_000);
  const rideLegs = useMemo(() => (ride ? ride.split(';').map((leg) => leg.split('|').filter(Boolean)) : null), [ride]);
  const [order, setOrder] = useKeptState<JourneyOrder>('order', 'best');
  const all = order === 'all';

  const fromWalks = useStreetWalks(origin, stops);
  const toWalks = useStreetWalks(destination, stops);
  const walksKey = `${placeKey(from)}>${placeKey(to)}`;
  const latestWalks = useRef<TripWalks>({});
  latestWalks.current = { from: fromWalks, to: toWalks };
  const [keptWalks, setKeptWalks] = useState<{ key: string; walks: TripWalks } | null>(null);
  useEffect(() => {
    if (fromWalks !== undefined && toWalks !== undefined)
      setKeptWalks((known) => (known?.key === walksKey ? known : { key: walksKey, walks: { from: fromWalks, to: toWalks } }));
  }, [fromWalks, toWalks, walksKey]);
  useEffect(() => {
    const timer = setTimeout(() => setKeptWalks((known) => (known?.key === walksKey ? known : { key: walksKey, walks: { ...latestWalks.current } })), STREET_WAIT_MS);
    return () => clearTimeout(timer);
  }, [walksKey]);
  const walksSettled = keptWalks?.key === walksKey;
  const walks = walksSettled ? keptWalks.walks : NO_WALKS;
  const planned = useMemo(() => {
    if (!network || !starts || !origin || !destination || !walksSettled) return [];
    const seconds = Math.floor((at - day.startMs) / 1000);

    const notBefore = Math.floor((Math.min(nowMinute * 60_000, at) - day.startMs) / 1000);
    return arriveBy
      ? planArrivingBy(network, starts, origin, destination, seconds, { pace, notBefore, all, walks })
      : around
        ? planAround(network, starts, origin, destination, seconds, { pace, notBefore, all, walks })
        : rideLegs
          ? (() => {
              const exact = planOnLines(network, starts, origin, destination, seconds, rideLegs, { pace, walks });
              return exact.length ? exact : planJourneys(network, starts, origin, destination, seconds, { pace, walks });
            })()
          : planJourneys(network, starts, origin, destination, seconds, { pace, all, walks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, starts, origin?.lat, origin?.lon, destination?.lat, destination?.lon, at, pace, arriveBy, around, nowMinute, rideLegs, all, walks, walksSettled]);
  const journeys = useMemo(() => orderJourneys(planned, order), [planned, order]);

  useEffect(() => {
    const nextChange = journeys.length ? day.startMs + Math.min(...journeys.map((j) => j.leaveAt)) * 1000 : plannedAt + EMPTY_REPLAN_MS;
    if (now >= nextChange) setPlannedAt(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const { data: regions } = useRegions();
  const regionId = useRegionId();
  const setRegion = useSettings((s) => s.setRegion);
  const originRegion = regions && origin ? regionAt(regions, origin) : undefined;
  const destinationRegion = regions && destination ? regionAt(regions, destination) : undefined;
  const betweenRegions = !!originRegion && !!destinationRegion && originRegion.id !== destinationRegion.id;

  useEffect(() => {
    if (originRegion && originRegion.id === destinationRegion?.id && originRegion.id !== regionId) setRegion(originRegion.id);
  }, [originRegion, destinationRegion, regionId, setRegion]);

  const [choice, setChoice] = useKeptState<string | null>('choice', null);
  const rebuilt = useWasKept('planner');
  const tripKey = `${placeKey(from)}>${placeKey(to)}`;
  const canWalkOnly = !!origin && !!destination && !journeys.length && walkingTime(origin, destination, pace) !== null;
  const chosen = journeys.findIndex((journey) => journeySignature(journey) === choice);

  const firstPick = around ? Math.max(0, journeys.findIndex((journey) => day.startMs + journey.leaveAt * 1000 >= at)) : 0;
  const transitShowing = choice === WALK ? WALK : chosen >= 0 ? chosen : journeys.length ? firstPick : canWalkOnly ? WALK : null;

  const showing = travel === 'car' ? null : travel === 'walk' ? (origin && destination ? WALK : null) : transitShowing;
  const { data: carRoutes, isError: carFailed } = useCarRoutes(origin, destination, i18n.language, travel === 'car' ? via : []);
  const carPick = useUi((s) => s.carPick);
  const carRoute = carRoutes?.[Math.min(carPick, carRoutes.length - 1)];
  const { data: walkRoute } = useWalkingRoute(origin, destination);
  const drive = useDrive((s) => s.drive);
  const setCarPick = useUi((s) => s.setCarPick);

  useEffect(() => setCarPick(0), [carRoutes, setCarPick]);
  const setFocus = useUi((s) => s.setFocus);
  const setSnap = useUi((s) => s.setSnap);
  const snap = useUi((s) => s.snap);
  const desktop = useIsDesktop();
  const hasTrip = travel === 'car' ? !!carRoute : showing !== null;

  const trip = useTrip((s) => s.trip);
  const startTrip = useTrip((s) => s.start);
  const rider = useUi((s) => s.location);
  const city = useRegion();

  const [elsewhere, setElsewhere] = useState(false);
  useJourneyPreview(
    trip ? trip.journey : typeof showing === 'number' ? journeys[showing] : undefined,
    trip ? trip.origin : origin,
    trip ? trip.destination : destination,
  );

  const walkingShown = showing === WALK;
  const { data: footpath } = useWalkingRoute(walkingShown ? origin : null, walkingShown ? destination : null);
  useEffect(() => {
    if (!walkingShown || !origin || !destination) return;
    setFocus({
      walkPath: footpath?.path ?? [
        [origin.lon, origin.lat],
        [destination.lon, destination.lat],
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkingShown, footpath, origin?.lat, origin?.lon, destination?.lat, destination?.lon]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (rebuilt) return;
    }
    setChoice(null);
    setFocus({});
    setPlannedAt(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey]);

  useEffect(() => {
    if (origin && destination) setSnap(hasTrip ? 'mini' : 'half');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, hasTrip]);

  const choose = (next: string) => {
    setChoice(next);
    setSnap('mini');
  };

  const changeTravel = (next: typeof travel) => {
    setTravel(next);
    setFocus({});
    if (next === 'transit' && choice === WALK) setChoice(null);
  };

  const startDrive = async (route: CarRoute) => {
    if (!destination || !to) return;

    void askCompass();

    if (!(await askForLocation('drive'))) return;
    const destinationName = to.kind === 'stop' ? to.stop.name : to.kind === 'point' ? to.name : '';
    let driven = route;

    if (from?.kind !== 'me') {
      const here = await waitForLocation();
      if (!here) return;
      try {
        [driven] = await fetchCarRoutes({ from: here, to: destination, via: via.length ? via : undefined, language: i18n.language, alternates: 0 });
      } catch {
        return;
      }
      setFrom({ kind: 'me' });
    }
    useDrive.getState().start({ route: driven, destination, destinationName, via: via.length ? via : undefined });
  };

  const fastestJourney = journeys.length ? Math.min(...journeys.map((journey) => journey.arriveAt - journey.leaveAt)) : null;
  const walkSeconds = origin && destination ? (walkRoute ? walkRoute.seconds * pace : (walkingTime(origin, destination, pace) ?? roughWalkSeconds(origin, destination, pace))) : null;
  const travelTimes = {
    car: carRoutes?.length ? driveTime(Math.min(...carRoutes.map((route) => route.seconds))) : carFailed ? '—' : undefined,

    transit: fastestJourney !== null ? t('plan.duration', { count: Math.round(fastestJourney / 60) }) : betweenRegions ? t('longTrains.tab') : loadingTransit() ? undefined : '—',
    walk: walkSeconds !== null ? driveTime(walkSeconds) : '—',
  };
  function loadingTransit() {
    return routesLoading || !starts;
  }

  useEffect(() => () => setFocus({}), [setFocus]);

  useEffect(() => {
    if (travel !== 'car' || drive || !carRoutes?.length) return;
    const picked = carRoutes[Math.min(carPick, carRoutes.length - 1)];
    setFocus({
      carRoutes: { paths: carRoutes.map((route) => route.path), selected: Math.min(carPick, carRoutes.length - 1) },
      roadEvents: true,
      carWalks: walksToRoute(picked, origin, destination),
      carStops: via,
    });
  }, [travel, drive, carRoutes, carPick, setFocus]);

  const waitingForLocation = from?.kind === 'me' && !isRider;
  const loading = routesLoading || !starts || (!!origin && !!destination && !walksSettled);

  const startsSoon = typeof showing === 'number' && day.startMs + journeys[showing].leaveAt * 1000 - now <= GO_AHEAD_MS;
  const go =
    typeof showing === 'number' && startsSoon && origin && destination && to
      ? () => {
          if (rider && city.info && !inBounds(city.info, rider, IN_CITY_MARGIN_DEG)) return setElsewhere(true);

          void askCompass();
          startTrip({
            journey: journeys[showing],
            origin,
            destination,
            destinationName: to.kind === 'stop' ? to.stop.name : to.kind === 'point' ? to.name : '',
            dayStart: day.startMs,
          });
          setSnap('half');
        }
      : undefined;

  if (drive) return <DrivePanel />;
  if (trip && network && stops) return <TripPanel network={network} stops={stops} />;

  const elsewhereDialog =
    elsewhere &&
    createPortal(
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-6" onClick={() => setElsewhere(false)}>
        <div role="alertdialog" aria-modal="true" className="surface-sheet w-full max-w-sm rounded-[28px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-raised text-primary">
            <Navigation className="size-6" />
          </span>
          <p className="text-[18px] leading-snug font-bold">{t('trip.elsewhereTitle')}</p>
          <p className="mt-1.5 text-[15px] text-muted">{t('trip.elsewhereBody', { city: city.name })}</p>
          <button type="button" onClick={() => setElsewhere(false)} className="press primary-fill mt-4 h-12 w-full rounded-full font-semibold">
            {t('common.close')}
          </button>
        </div>
      </div>,
      document.body,
    );

  if (snap === 'mini' && !desktop && hasTrip && origin && destination && travel === 'car' && carRoute) {
    return <CarSummary route={carRoute} fromMe={from?.kind === 'me'} onExpand={() => setSnap('half')} onGo={() => void startDrive(carRoute)} />;
  }
  if (snap === 'mini' && !desktop && hasTrip && origin && destination) {
    return (
      <>
        {elsewhereDialog}
        <PlanSummary
          journey={typeof showing === 'number' ? journeys[showing] : undefined}
          origin={origin}
          destination={destination}
          dayStart={day.startMs}
          scheduled={departAt !== null}
          onExpand={() => setSnap('half')}
          onGo={go}
          zones={network && typeof showing === 'number' ? journeyZones(network, journeys[showing]) : null}
        />
      </>
    );
  }

  return (
    <>
      {elsewhereDialog}
      <Card className="mb-3 p-1.5">
        <div className="relative">
        <PlaceField label={t('plan.from')} marker="border-[3.5px] border-primary" place={from} allowLocation={!from && !isFar} onChange={setFrom} />

        {travel === 'car' &&
          waypoints.map((stop, index) => (
            <div key={index} className="flex items-center">
              <div className="min-w-0 flex-1">
                <PlaceField
                  label={t('plan.stopN', { n: index + 1 })}
                  marker="bg-amber-500"
                  place={stop}
                  allowLocation={false}
                  autoFocus={!stop}
                  onChange={(next) => setWaypoints(waypoints.map((old, i) => (i === index ? next : old)))}
                />
              </div>
              <button
                type="button"
                aria-label={t('plan.removeStop')}
                onClick={() => setWaypoints(waypoints.filter((_, i) => i !== index))}
                className="press mr-1 grid size-9 shrink-0 place-items-center rounded-full text-(--muted-icon)"
              >
                <Minus className="size-5" />
              </button>
            </div>
          ))}
        <PlaceField label={t('plan.to')} marker="bg-rose-500" place={to} allowLocation={false} autoFocus={startTyping && !to} findsLines onChange={setTo} />
        {from && to && (
          <button
            type="button"
            aria-label={t('plan.swap')}
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="press absolute top-1/2 right-12 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card shadow-sm ring-1 ring-hairline"
          >
            <ArrowDownUp className="size-[18px] text-muted" />
          </button>
        )}
        </div>
        {travel === 'car' && from && to && waypoints.length < MAX_STOPS && (
          <button
            type="button"
            onClick={() => setWaypoints([...waypoints, null])}
            className="press mx-1 mb-1 flex h-10 items-center gap-2 rounded-[14px] px-2.5 text-[14px] font-semibold text-primary"
          >
            <Plus className="size-[18px]" />
            {t('plan.addStop')}
          </button>
        )}
      </Card>

      {origin && destination && <TravelTabs value={travel} onChange={changeTravel} times={travelTimes} />}

      {travel === 'transit' && (
      <DepartureTime
        value={departAt}
        mode={timeMode}
        now={now}
        onChange={setDepartAt}
        onModeChange={setTimeMode}
        onDone={() => setSnap(hasTrip ? 'mini' : 'half')}
      />
      )}

      {!destination && <Message>{t('plan.hint')}</Message>}
      {destination && !origin && <Message>{t(waitingForLocation ? 'map.useLocation' : 'plan.needLocation')}</Message>}
      {origin && destination && travel === 'car' && <CarOptions origin={origin} destination={destination} via={via} fromMe={from?.kind === 'me'} onGo={(route) => void startDrive(route)} onFromMe={() => void askForLocation('start').then((yes) => yes && setFrom({ kind: 'me' }))} />}
      {origin && destination && (travel === 'walk' || (travel === 'transit' && !journeys.length && !loading)) && (
        <WalkingCard origin={origin} destination={destination} selected={showing === WALK} onSelect={() => choose(WALK)} />
      )}
      {travel === 'transit' && (
      <>
      {origin && destination && loading && (
        <Card>
          <RowSkeleton rows={3} />
        </Card>
      )}
      {origin && destination && !loading && !journeys.length && betweenRegions && (
        <TrainOptions from={originRegion.id} to={destinationRegion.id} at={departAt ?? now} />
      )}
      {origin && destination && !loading && !journeys.length && !betweenRegions && walkingTime(origin, destination, pace) === null && (
        <Message>{t(arriveBy ? 'plan.noneArrive' : 'plan.none')}</Message>
      )}
      {go && typeof showing === 'number' && (
        <button type="button" onClick={go} className="press primary-fill mb-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold">
          <Navigation className="size-[18px]" />
          {t('trip.goWith', { time: formatClock(day.startMs + journeys[showing].leaveAt * 1000) })}
        </button>
      )}
      {(journeys.length > 1 || all) && (
        <div className="-mx-4 mb-2.5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
          {(['best', 'all', 'earliest', 'fewerChanges', 'lessWalking'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={order === value}
              onClick={() => setOrder(value)}
              className={`press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold ${order === value ? 'primary-fill' : 'bg-raised'}`}
            >
              {t(`plan.order.${value}`)}
            </button>
          ))}
        </div>
      )}
      {stops &&
        starts &&
        journeys.map((journey, i) => (
          <JourneyCard
            key={journey.legs.map((leg) => `${leg.line}${leg.departure}`).join('-')}
            journey={journey}
            dayStart={day.startMs}
            now={now}
            live={departAt === null}
            starts={starts}
            stops={stops}
            selected={showing === i}
            onSelect={() => choose(journeySignature(journey))}
            zones={network ? journeyZones(network, journey) : null}
          />
        ))}
      </>
      )}
    </>
  );
}
