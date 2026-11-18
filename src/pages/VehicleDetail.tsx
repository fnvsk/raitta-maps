import { Flag, Route, Star } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Message, ModeIcon, RowSkeleton, useCountdown, useDelayLabel } from '@/components/ui';
import { stationName } from '@/core/departures';
import { formatClock } from '@/core/time';
import type { Mode } from '@/core/types';
import { vehiclePattern } from '@/core/vehicleDirection';
import { useNow, usePatterns, useRegionId, useStopIndex, useVehicleDetail } from '@/data/hooks';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

const MAX_STOPS = 14;

const MODE_COLOR: Record<Mode, string> = {
  bus: 'var(--color-primary-strong)',
  tram: 'var(--color-tram)',
  metro: 'var(--color-metro)',
  train: 'var(--color-train)',
  ferry: 'var(--color-ferry)',
};

interface Row {
  stopId: string;
  
  time?: number;
}

export function VehicleDetail() {
  const { t } = useTranslation();
  const { ref = '' } = useParams();
  useSheetSnap('half');
  const { data: vehicle, isLoading } = useVehicleDetail(ref);
  const stops = useStopIndex();
  const now = useNow(10_000);
  const countdown = useCountdown();
  const delayLabel = useDelayLabel();
  const setFocus = useUi((s) => s.setFocus);
  const region = useRegionId();

  const { data: patterns } = usePatterns();
  const line = vehicle?.line;
  
  const pattern = useMemo(
    () => (vehicle && patterns ? vehiclePattern(patterns, vehicle, (id) => stops.get(id)) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patterns, stops, ref, line, vehicle?.direction, vehicle?.destinationStop, vehicle?.headsign, !!vehicle?.onward.length],
  );
  const patternId = pattern?.id;
  useEffect(() => setFocus({ vehicleRef: ref, line, patternId }), [ref, line, patternId, setFocus]);
  const favorite = useSettings((s) => (line ? (s.favoriteLines[region]?.includes(line) ?? false) : false));
  const toggleFavorite = useSettings((s) => s.toggleFavoriteLine);

  if (!vehicle) {
    return (
      <>
        <BackButton />
        {isLoading ? <RowSkeleton /> : <Message>{t('vehicle.gone')}</Message>}
      </>
    );
  }

  const color = MODE_COLOR[vehicle.mode];
  const delay = vehicle.delaySec === null ? null : delayLabel(vehicle.delaySec);
  const destination = vehicle.headsign ?? stops.get(vehicle.destinationStop)?.name;
  
  const predicted: Row[] = vehicle.onward.filter((call) => call.time >= now - 30_000).map((call) => ({ stopId: call.stopId, time: call.time }));
  const fromPattern: Row[] = (() => {
    if (predicted.length || !pattern || !vehicle.nextStop) return [];
    const at = pattern.stops.indexOf(vehicle.nextStop);
    return at < 0 ? [] : pattern.stops.slice(at).map((stopId) => ({ stopId }));
  })();
  const all = predicted.length ? predicted : fromPattern;
  const rows = all.slice(0, MAX_STOPS);
  const last = all.at(-1);
  const nextName = vehicle.nextStop ? stops.get(vehicle.nextStop)?.name : undefined;

  return (
    <>
      <div data-sheet-drag className="mb-3 flex touch-none items-start gap-2.5">
        <BackButton />
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-[22px] px-4 py-3.5 text-white" style={{ background: color }}>
          <div className="flex items-center gap-2.5">
            <span className="tabular grid h-10 min-w-12 place-items-center rounded-[13px] bg-white/95 px-2 text-[19px] font-extrabold" style={{ color }}>
              {vehicle.line}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide uppercase opacity-85">
                <ModeIcon mode={vehicle.mode} className="size-3.5" />
                {t(`vehicle.${vehicle.mode}`)}
              </p>
              <h1 className="truncate text-[19px] leading-tight font-bold">{destination ? `→ ${stationName(destination)}` : t(`vehicle.${vehicle.mode}`)}</h1>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[13px] font-semibold">
            {delay && <span className="rounded-full bg-white/20 px-2.5 py-1">{delay.text}</span>}
            {nextName && (
              <span className="max-w-full truncate rounded-full bg-white/20 px-2.5 py-1">
                {t('vehicle.nextStop')}: {nextName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
        <Link to={`/routes/${encodeURIComponent(vehicle.line)}`} className="press flex h-11 items-center justify-center gap-2 rounded-full bg-raised font-semibold text-primary">
          <Route className="size-[18px]" />
          {t('vehicle.viewLine')}
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(vehicle.line)}
          aria-pressed={favorite}
          aria-label={t(favorite ? 'vehicle.unfavorite' : 'vehicle.favorite')}
          className={`press grid size-11 place-items-center rounded-full ${favorite ? 'bg-amber-400/20 text-amber-500' : 'bg-raised text-muted'}`}
        >
          <Star className="size-5" fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <h2 className="mb-2 px-1 text-[13px] font-bold tracking-wide text-muted uppercase">{t('vehicle.nextStops')}</h2>
          <ol className="surface-card relative rounded-card py-2">
            {rows.map((row, index) => {
              const first = index === 0;
              const final = row === last;
              const name = stops.get(row.stopId)?.name ?? row.stopId;
              return (
                <li key={`${row.stopId}-${index}`} className="relative">
                  {index < rows.length - 1 && <span aria-hidden className="absolute top-1/2 left-[27px] h-full w-[3px] rounded-full opacity-70" style={{ background: color }} />}
                  <Link to={`/stops/${row.stopId}`} className="relative flex items-center gap-3 py-2 pr-4 pl-4 active:bg-raised">
                    <span className="relative grid size-6 shrink-0 place-items-center">
                      {first && <span className="absolute size-6 animate-ping rounded-full opacity-30" style={{ background: color }} />}
                      {final ? (
                        <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: color }}>
                          <Flag className="size-3.5" />
                        </span>
                      ) : (
                        <span className={`rounded-full border-[3px] bg-card ${first ? 'size-4' : 'size-3'}`} style={{ borderColor: color }} />
                      )}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${first ? 'text-[16px] font-bold' : final ? 'font-semibold' : ''}`}>{name}</span>
                    {row.time !== undefined && (
                      <span className="shrink-0 text-right">
                        <span className={`tabular block ${first ? 'text-[16px] font-bold' : 'font-semibold'}`}>{countdown(row.time, now)}</span>
                        <span className="tabular block text-[12px] text-muted">{formatClock(row.time)}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
          {all.length > rows.length && last && (
            <p className="mt-2 px-1 text-center text-[13px] text-muted">{t('vehicle.more', { count: all.length - rows.length, last: stops.get(last.stopId)?.name ?? '' })}</p>
          )}
        </>
      )}
    </>
  );
}
