import { ArrowDownUp, ArrowRight, ChevronRight, Route as RouteIcon, Search, TrainFront, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Divided, LineBadge, Message, RowSkeleton, SectionTitle, ServiceSwitch, TicketButton } from '@/components/ui';
import { TRAIN_TICKETS } from '@/core/tickets';
import type { PathPoint } from '@/core/journeyPath';
import { bestTime, trainProgress, type LongTrain, type StationPoint, type TrainStop, type TrainTime } from '@/core/longTrains';
import { formatClock } from '@/core/time';
import { useLongTrains, useLongTrainVehicles, useNow, useRail, useRegion, useStationDepartures, useStationIndex, useStations, useStationTrains, useTrainRoute } from '@/data/hooks';
import { useKeptState } from '@/state/kept';
import { useUi, type MapFocus } from '@/state/ui';
import { useIsDesktop } from '@/theme';

const FINLAND_VIEW = { lat: 64.6, lon: 26.2, zoom: 4.4 };
const STATION_ZOOM = 10.5;
const CITY_ZOOM = 12.5;
const MAX_SEARCH_STATIONS = 4;

const TYPE_ORDER = ['S', 'IC', 'PYO', 'P'];
const typeRank = (type: string) => (TYPE_ORDER.includes(type) ? TYPE_ORDER.indexOf(type) : TYPE_ORDER.length);

export function TrainsLayout() {
  const flyTo = useUi((s) => s.flyTo);
  const region = useRegion();
  useEffect(() => {
    flyTo(FINLAND_VIEW);
    return () => {
      const center = useUi.getState().location ?? region.info?.center;
      if (center) flyTo({ lat: center.lat, lon: center.lon, zoom: CITY_ZOOM });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Outlet />;
}

function useTrainsFocus(extra: Omit<MapFocus, 'trains' | 'stations'> = {}, withStations = true) {
  const setFocus = useUi((s) => s.setFocus);
  const trains = useLongTrainVehicles();
  const { data: stations } = useStations();
  const key = JSON.stringify(extra);
  useEffect(() => {
    setFocus({ ...extra, trains: trains ?? [], stations: withStations ? (stations ?? []) : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trains, stations, key, withStations, setFocus]);
  useEffect(() => () => setFocus({}), [setFocus]);
}

function useStationName() {
  const stations = useStationIndex();
  return (code: string) => stations.get(code)?.name ?? code;
}

function Delay({ minutes }: { minutes: number | undefined }) {
  const { t } = useTranslation();
  if (minutes === undefined) return null;
  const late = minutes >= 2;
  const label = minutes >= 1 ? t('longTrains.late', { count: minutes }) : minutes <= -1 ? t('longTrains.early', { count: -minutes }) : t('longTrains.onTime');
  return (
    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-bold ${late ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>
      {label}
    </span>
  );
}

function StopTime({ time }: { time: TrainTime }) {
  const planned = formatClock(time.scheduled);
  const expected = formatClock(bestTime(time));
  return (
    <span className="tabular shrink-0 text-right">
      {expected !== planned && <span className="mr-1.5 text-[13px] text-muted line-through">{planned}</span>}
      <span className={expected !== planned ? 'font-semibold text-rose-600 dark:text-rose-300' : 'font-semibold'}>{expected}</span>
    </span>
  );
}

function TrainRow({ train }: { train: LongTrain }) {
  const { t } = useTranslation();
  const name = useStationName();
  const { next, delay } = trainProgress(train.stops);
  const first = train.stops[0];
  const last = train.stops[train.stops.length - 1];
  const nextStop = train.stops[next];
  return (
    <Link to={`/trains/${train.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-raised">
      <LineBadge line={train.label} mode="train" size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {first && last ? `${name(first.code)} → ${name(last.code)}` : train.label}
        </span>
        {nextStop && (
          <span className="block truncate text-[13px] text-muted">
            {t('longTrains.next', { station: name(nextStop.code), time: formatClock(bestTime(nextStop.arrival ?? nextStop.departure!)) })}
          </span>
        )}
      </span>
      <Delay minutes={delay} />
      <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
    </Link>
  );
}

const MAX_STATION_HINTS = 5;

function StationField({ label, marker, value, onChange }: { label: string; marker: string; value: string | null; onChange: (code: string | null) => void }) {
  const { i18n } = useTranslation();
  const { data: stations } = useStations();
  const name = useStationName();
  const [query, setQuery] = useState('');
  const typed = query.trim().toLocaleLowerCase(i18n.language);
  const hints = useMemo(
    () => (typed ? (stations ?? []).filter((s) => s.name.toLocaleLowerCase(i18n.language).startsWith(typed) || s.code.toLowerCase() === typed).slice(0, MAX_STATION_HINTS) : []),
    [stations, typed, i18n.language],
  );
  return (
    <div className="p-1">
      <div className="flex min-h-12 items-center gap-3 rounded-[16px] bg-raised px-3.5 focus-within:ring-2 focus-within:ring-primary">
        <span aria-hidden className={`size-3.5 shrink-0 rounded-full ${marker}`} />
        {value ? (
          <>
            <button type="button" aria-label={label} onClick={() => { setQuery(name(value)); onChange(null); }} className="min-w-0 flex-1 truncate text-left font-semibold">
              {name(value)}
            </button>
            <button type="button" aria-label={label} onClick={() => onChange(null)} className="grid size-8 place-items-center">
              <X className="size-[18px] text-(--muted-icon)" />
            </button>
          </>
        ) : (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={label}
            aria-label={label}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          />
        )}
      </div>
      {!value && hints.length > 0 && (
        <div className="px-1 pt-1">
          {hints.map((station) => (
            <button
              key={station.code}
              type="button"
              onClick={() => { setQuery(''); onChange(station.code); }}
              className="press flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left active:bg-primary-soft"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-train text-white">
                <TrainFront className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{station.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainPlanner() {
  const { t } = useTranslation();
  const [open, setOpen] = useKeptState('train-plan-open', () => false);
  const [from, setFrom] = useKeptState<string | null>('train-plan-from', () => null);
  const [to, setTo] = useKeptState<string | null>('train-plan-to', () => null);
  const now = useNow(30_000);
  const { data: options, isLoading, isError } = useStationTrains(from, to, now - 5 * 60_000);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="press primary-fill mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold">
        <RouteIcon className="size-[18px]" />
        {t('longTrains.plan')}
      </button>
    );
  }
  return (
    <div className="mb-3">
      <Card className="relative p-1.5">
        <StationField label={t('longTrains.fromStation')} marker="border-[3.5px] border-train" value={from} onChange={setFrom} />
        <StationField label={t('longTrains.toStation')} marker="bg-rose-500" value={to} onChange={setTo} />
        {from && to && (
          <button
            type="button"
            aria-label={t('plan.swap')}
            onClick={() => { setFrom(to); setTo(from); }}
            className="press absolute top-1/2 right-12 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-card shadow-sm ring-1 ring-hairline"
          >
            <ArrowDownUp className="size-[18px] text-muted" />
          </button>
        )}
      </Card>
      {from && to && (
        <div className="mt-2.5">
          {isLoading && (
            <Card>
              <RowSkeleton rows={3} />
            </Card>
          )}
          {isError && <Message>{t('longTrains.failed')}</Message>}
          {options && !options.length && <Message>{t('longTrains.noDirect')}</Message>}
          {options && options.length > 0 && (
            <Card>
              <Divided>
                {options.map((option) => {
                  const minutes = Math.round((option.arrival - option.departure) / 60_000);
                  const row = (
                    <>
                      <LineBadge line={option.name} mode="train" size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="tabular block text-[17px] font-bold">
                          {formatClock(option.departure)} <ArrowRight className="inline size-4 align-[-2px] text-(--muted-icon)" /> {formatClock(option.arrival)}
                        </span>
                        <span className="block text-[13px] text-muted">{t('plan.duration', { count: minutes })}</span>
                      </span>
                      <Delay minutes={option.delay} />
                    </>
                  );
                  return option.date && option.number ? (
                    <Link key={`${option.name}-${option.departure}`} to={`/trains/${option.date}/${option.number}`} className="flex items-center gap-3 px-3 py-3 active:bg-raised">
                      {row}
                      <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
                    </Link>
                  ) : (
                    <div key={`${option.name}-${option.departure}`} className="flex items-center gap-3 px-3 py-3">
                      {row}
                    </div>
                  );
                })}
              </Divided>
            </Card>
          )}
        </div>
      )}
      <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full py-1.5 text-center text-[14px] font-semibold text-muted">
        {t('common.close')}
      </button>
    </div>
  );
}

export function TrainSearch() {
  const { t } = useTranslation();
  const query = useUi((s) => s.trainQuery);
  const setQuery = useUi((s) => s.setTrainQuery);
  return (
    <div className="flex items-center gap-2">
      <label className="surface flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-full px-4">
        <Search className="size-5 shrink-0 text-primary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('longTrains.search')}
          aria-label={t('longTrains.search')}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:font-medium placeholder:text-ink"
        />
      </label>
      <TicketButton app={TRAIN_TICKETS} compact />
    </div>
  );
}

export function TrainsPage() {
  const { t, i18n } = useTranslation();
  useSheetSnap('peek');
  useTrainsFocus();
  const { data: trains, isLoading, isError } = useLongTrains();
  const { data: stations } = useStations();
  const name = useStationName();
  const query = useUi((s) => s.trainQuery);
  const desktop = useIsDesktop();

  const typed = query.trim().toLocaleLowerCase(i18n.language);
  const compact = typed.replace(/\s+/g, '');
  const shown = useMemo(() => {
    const all = [...(trains ?? [])].sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.type.localeCompare(b.type) || a.number - b.number);
    if (!typed) return all;
    return all.filter(
      (train) =>
        train.label.toLocaleLowerCase(i18n.language).replace(/\s+/g, '').includes(compact) ||
        String(train.number) === compact ||
        train.stops.some((stop) => name(stop.code).toLocaleLowerCase(i18n.language).startsWith(typed)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trains, typed, compact, stations]);
  const foundStations = useMemo(
    () => (typed ? (stations ?? []).filter((s) => s.name.toLocaleLowerCase(i18n.language).startsWith(typed)).slice(0, MAX_SEARCH_STATIONS) : []),
    [stations, typed, i18n.language],
  );

  return (
    <>
      {desktop && (
        <div className="mb-3">
          <TrainSearch />
        </div>
      )}
      <div data-sheet-drag className="touch-none">
        <ServiceSwitch />
      </div>
      {!typed && <TrainPlanner />}

      {foundStations.length > 0 && (
        <>
          <SectionTitle>{t('longTrains.stations')}</SectionTitle>
          <Card>
            <Divided>
              {foundStations.map((station) => (
                <Link key={station.code} to={`/trains/station/${station.code}`} className="flex items-center gap-3 px-3 py-3 active:bg-raised">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-train text-white">
                    <TrainFront className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{station.name}</span>
                  <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
                </Link>
              ))}
            </Divided>
          </Card>
        </>
      )}

      <SectionTitle>{trains ? t('longTrains.running', { count: trains.length }) : t('longTrains.title')}</SectionTitle>
      <Card>
        {isLoading && <RowSkeleton rows={5} />}
        {isError && <Message>{t('longTrains.failed')}</Message>}
        {trains && !shown.length && <Message>{typed ? t('search.noResults', { query }) : t('longTrains.none')}</Message>}
        <Divided>
          {shown.map((train) => (
            <TrainRow key={train.id} train={train} />
          ))}
        </Divided>
      </Card>
      <p className="mt-3 px-1 text-[12px] text-muted">{t('longTrains.source')}</p>
    </>
  );
}

function StopRow({ stop, state, name }: { stop: TrainStop; state: 'passed' | 'next' | 'ahead'; name: string }) {
  const time = stop.departure ?? stop.arrival;
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 ${state === 'passed' ? 'opacity-55' : ''}`}>
      <span className="relative flex w-3 shrink-0 justify-center">
        <span className={`size-3 rounded-full border-[2.5px] ${state === 'next' ? 'border-train bg-train' : 'border-train bg-card'}`} />
      </span>
      <span className={`min-w-0 flex-1 truncate ${state === 'next' ? 'font-bold' : ''} ${stop.cancelled ? 'line-through' : ''}`}>{name}</span>
      {time && <StopTime time={time} />}
    </li>
  );
}

export function TrainDetail() {
  const { t } = useTranslation();
  const { date = '', number = '' } = useParams();
  useSheetSnap('half');
  const { data: route, isLoading } = useTrainRoute(date, number);
  const { data: trains } = useLongTrains();
  const stations = useStationIndex();
  const name = useStationName();
  const live = trains?.find((train) => train.id === `${date}/${number}`);
  const label = route ? `${route.type} ${route.number}` : (live?.label ?? number);

  const { data: rail } = useRail();
  const shape = useMemo(() => {
    if (!route) return undefined;
    const at = (code: string): PathPoint | undefined => {
      const station = stations.get(code) as StationPoint | undefined;
      return rail?.stations[code] ?? (station ? [station.lon, station.lat] : undefined);
    };
    const path: PathPoint[] = [];
    route.path.forEach((code, i) => {
      const previous = route.path[i - 1];
      const along = previous && rail?.segments[[previous, code].sort().join('|')];
      if (along) path.push(...(previous < code ? along : [...along].reverse()));
      else {
        const point = at(code);
        if (point) path.push(point);
      }
    });
    const markers = route.stops.flatMap((stop) => {
      const station = stations.get(stop.code);
      return station ? [{ id: `station:${station.code}`, name: station.name, lat: station.lat, lon: station.lon, line: label }] : [];
    });
    return { rides: [{ line: label, path, mode: 'train' as const }], walks: [], markers, lines: [label] };
  }, [route, stations, label, rail]);
  useTrainsFocus({ journey: shape, vehicleRef: `train:${date}/${number}` }, false);

  const stops = route?.stops ?? live?.stops ?? [];
  const { next, delay } = trainProgress(stops);
  const first = stops[0];
  const last = stops[stops.length - 1];
  const finished = !!last?.arrival?.actual;

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2.5 pb-3">
        <BackButton fallback="/trains" />
        <LineBadge line={label} mode="train" size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] leading-snug font-semibold">{first && last ? `${name(first.code)} → ${name(last.code)}` : label}</h1>
          {!live && <p className="text-[13px] text-muted">{t(finished ? 'longTrains.arrived' : 'longTrains.notRunning')}</p>}
        </div>
        {!finished && <Delay minutes={stops.length ? delay : undefined} />}
      </div>
      {!finished && (
        <div className="mb-3">
          <TicketButton app={TRAIN_TICKETS} />
        </div>
      )}
      <Card className="py-1.5">
        {isLoading && <RowSkeleton rows={6} />}
        {!isLoading && !stops.length && <Message>{t('longTrains.notFound')}</Message>}
        <ol>
          {stops.map((stop, i) => (
            <StopRow key={`${stop.code}-${i}`} stop={stop} name={name(stop.code)} state={finished || i < next ? 'passed' : i === next ? 'next' : 'ahead'} />
          ))}
        </ol>
      </Card>
      <p className="mt-3 px-1 text-[12px] text-muted">{t('longTrains.source')}</p>
    </>
  );
}

export function StationDetail() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  useSheetSnap('half');
  const stations = useStationIndex();
  const name = useStationName();
  const station = stations.get(code);
  const flyTo = useUi((s) => s.flyTo);
  const { data: departures, isLoading, isError } = useStationDepartures(code);
  useTrainsFocus();

  useEffect(() => {
    if (station) flyTo({ lat: station.lat, lon: station.lon, zoom: STATION_ZOOM });
  }, [station, flyTo]);

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2.5 pb-3">
        <BackButton fallback="/trains" />
        <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-train text-white">
          <TrainFront className="size-5" />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-tight">{station?.name ?? code}</h1>
      </div>
      <TicketButton app={TRAIN_TICKETS} />
      <SectionTitle>{t('longTrains.departures')}</SectionTitle>
      <Card>
        {isLoading && <RowSkeleton rows={5} />}
        {isError && <Message>{t('longTrains.failed')}</Message>}
        {departures && !departures.length && <Message>{t('longTrains.noDepartures')}</Message>}
        <Divided>
          {departures?.map((train) => (
            <Link key={train.id} to={`/trains/${train.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-raised">
              <LineBadge line={train.label} mode="train" />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${train.cancelled ? 'line-through' : ''}`}>{name(train.to)}</span>
                <span className="block truncate text-[13px] text-muted">
                  {train.cancelled ? t('longTrains.cancelled') : train.track ? t('longTrains.track', { track: train.track }) : t('longTrains.from', { station: name(train.from) })}
                </span>
              </span>
              <StopTime time={train.time} />
            </Link>
          ))}
        </Divided>
      </Card>
      <p className="mt-3 px-1 text-[12px] text-muted">{t('longTrains.source')}</p>
    </>
  );
}
