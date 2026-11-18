import { Compass, ExternalLink, Plane, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Divided, Message, RowSkeleton, Segmented } from '@/components/ui';
import { AIRPORTS, fetchFlights, type Flight, type FlightState } from '@/core/airports';
import { formatClock } from '@/core/time';
import { useQuery } from '@tanstack/react-query';
import { useUi } from '@/state/ui';

const AIRPORT_ZOOM = 12.5;
const SHOWN_FLIGHTS = 25;

const RECENT_MS = 30 * 60_000;

const STATE_TONE: Record<FlightState, string> = {
  departed: 'text-success',
  landed: 'text-success',
  estimated: 'text-amber-600 dark:text-amber-400',
  delayed: 'text-amber-600 dark:text-amber-400',
  cancelled: 'text-rose-600 dark:text-rose-400',
  approaching: 'text-primary',
  boarding: 'text-primary',
  gateOpen: 'text-primary',
  finalCall: 'text-orange-600 dark:text-orange-400',
  gateClosed: 'text-muted',
};

const dayOf = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(ms);

function FlightRow({ flight, arrivals }: { flight: Flight; arrivals: boolean }) {
  const { t } = useTranslation();
  const changed = flight.expected !== undefined && Math.abs(flight.expected - flight.scheduled) >= 5 * 60_000;
  const cancelled = flight.state === 'cancelled';
  const status = flight.state ? t(`airport.state.${flight.state}`, { defaultValue: flight.status }) : flight.status;
  const spot = arrivals ? flight.belt : flight.gate;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${cancelled ? 'opacity-70' : ''}`}>
      <span className="tabular w-[54px] shrink-0 leading-none">
        <span className={`block text-[19px] font-bold tracking-tight ${changed && !cancelled ? 'text-amber-600 dark:text-amber-400' : ''} ${cancelled ? 'line-through' : ''}`}>
          {formatClock(changed && !cancelled ? flight.expected! : flight.scheduled)}
        </span>
        {changed && !cancelled && <span className="mt-1 block text-[13px] font-medium text-muted line-through">{formatClock(flight.scheduled)}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[16px] font-semibold">{flight.place}</span>
          {flight.placeCode && <span className="shrink-0 text-[12px] font-semibold tracking-wide text-muted">{flight.placeCode}</span>}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px]">
          {status && (
            <span className={`flex shrink-0 items-center gap-1 font-semibold ${flight.state ? STATE_TONE[flight.state] : 'text-muted'}`}>
              <span className="size-1.5 rounded-full bg-current" />
              {status}
            </span>
          )}
          {status && <span className="text-muted">·</span>}
          <span className="tabular truncate text-muted">{flight.number}</span>
        </span>
      </span>
      {spot && (
        <span className="grid min-w-12 shrink-0 place-items-center rounded-xl bg-raised px-2 py-1 leading-none">
          <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">{t(arrivals ? 'airport.beltLabel' : 'airport.gateLabel')}</span>
          <span className="tabular mt-0.5 text-[17px] font-bold">{spot}</span>
        </span>
      )}
    </div>
  );
}

export function AirportPage() {
  const { t, i18n } = useTranslation();
  useSheetSnap('half');
  const { iata = '' } = useParams();
  const airport = AIRPORTS.find((item) => item.iata === iata.toUpperCase());
  const setFocus = useUi((s) => s.setFocus);
  const flyTo = useUi((s) => s.flyTo);
  const [board, setBoard] = useState<'departures' | 'arrivals'>('departures');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(SHOWN_FLIGHTS);
  useEffect(() => setShown(SHOWN_FLIGHTS), [board, query]);
  const { data: flights, isLoading } = useQuery({
    queryKey: ['flights', airport?.iata, i18n.language],
    queryFn: ({ signal }) => fetchFlights(airport!.iata, i18n.language, signal),
    enabled: !!airport,

    refetchInterval: (query) => (query.state.data && (!query.state.data.departures || !query.state.data.arrivals) ? 20_000 : 2 * 60_000),
    staleTime: 60_000,

    retry: 6,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),

    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!airport) return;
    setFocus({ place: { lat: airport.lat, lon: airport.lon } });
    flyTo({ lat: airport.lat, lon: airport.lon, zoom: AIRPORT_ZOOM });
    return () => setFocus({});
  }, [airport, setFocus, flyTo]);

  if (!airport) return <Message>{t('airport.missing')}</Message>;
  const now = Date.now();
  const needle = query.trim().toLowerCase().replace(/\s+/g, '');
  const matching = (flights?.[board] ?? []).filter(
    (flight) =>
      (flight.expected ?? flight.scheduled) > now - RECENT_MS &&
      (!needle || `${flight.place}${flight.placeCode ?? ''}${flight.number}`.toLowerCase().replace(/\s+/g, '').includes(needle)),
  );
  const list = matching.slice(0, shown);
  const today = dayOf(now);
  const plan = new URLSearchParams({ view: 'plan', toLat: String(airport.lat), toLon: String(airport.lon), toName: `${airport.name} (${airport.iata})` });

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-3 pb-3">
        <BackButton />
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
          <Plane className="size-5.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-wide text-sky-600 uppercase dark:text-sky-400">{t('airport.kind')}</p>
          <h1 className="truncate text-[20px] leading-tight font-bold tracking-tight">
            {airport.name} <span className="text-muted">{airport.iata}</span>
          </h1>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
        <Link to={`/routes?${plan}&start=1`} className="primary-fill press flex h-12 items-center justify-center gap-2 rounded-full font-semibold">
          <Compass className="size-5" />
          {t('stop.directions')}
        </Link>
        <a href={airport.page} target="_blank" rel="noopener noreferrer" className="press flex h-12 items-center gap-2 rounded-full bg-raised px-4 font-semibold text-primary">
          Finavia
          <ExternalLink className="size-4" />
        </a>
      </div>

      <Segmented
        value={board}
        onChange={setBoard}
        options={[
          { value: 'departures', label: t('airport.departures') },
          { value: 'arrivals', label: t('airport.arrivals') },
        ]}
      />

      {flights && (
        <label className="mt-3 flex h-11 items-center gap-2.5 rounded-full bg-raised px-4">
          <Search className="size-[18px] shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('airport.search')}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            enterKeyHint="search"
          />
          {query && (
            <button type="button" aria-label={t('common.close')} onClick={() => setQuery('')} className="press -mr-1.5 grid size-7 place-items-center rounded-full text-muted">
              <X className="size-4" />
            </button>
          )}
        </label>
      )}

      <Card className="mt-3 overflow-hidden">
        {isLoading && <RowSkeleton rows={5} />}
        {!isLoading && !flights && (
          <div className="px-4 py-6 text-center">
            <p className="font-semibold">{t('airport.soon')}</p>
            <a href={airport.page} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary">
              {t('airport.openBoard')}
              <ExternalLink className="size-4" />
            </a>
          </div>
        )}
        {flights && !flights[board] && (
          <div className="px-4 py-6 text-center">
            <p className="font-semibold">{t('airport.soon')}</p>
            <a href={airport.page} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary">
              {t('airport.openBoard')}
              <ExternalLink className="size-4" />
            </a>
          </div>
        )}
        {flights?.[board] && !list.length && <Message>{t(needle ? 'airport.nothing' : 'airport.none')}</Message>}
        {list.length > 0 && (
          <Divided>
            {list.map((flight, i) => {
              const day = dayOf(flight.scheduled);
              const newDay = day !== (i ? dayOf(list[i - 1].scheduled) : today);
              return (
                <div key={`${flight.number}-${flight.scheduled}`}>
                  {newDay && (
                    <p className="bg-raised/60 px-4 py-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">
                      {new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Helsinki' }).format(flight.scheduled)}
                    </p>
                  )}
                  <FlightRow flight={flight} arrivals={board === 'arrivals'} />
                </div>
              );
            })}
          </Divided>
        )}
        {matching.length > list.length && (
          <button type="button" onClick={() => setShown(shown + SHOWN_FLIGHTS)} className="press w-full border-t border-hairline py-3 text-[15px] font-semibold text-primary">
            {t('airport.more')}
          </button>
        )}
      </Card>
      {flights && (
        <p className="mt-3 flex items-center justify-center gap-2 px-1 text-[12px] text-muted">
          <span className="live-dot" />
          {t('airport.source', { time: formatClock(flights.updated) })}
        </p>
      )}
    </>
  );
}
