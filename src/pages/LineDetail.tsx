import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, LineBadge, Message, RowSkeleton, Segmented, StarButton } from '@/components/ui';
import type { Mode, Pattern } from '@/core/types';
import { distanceM } from '@/core/geo';
import { vehiclePattern } from '@/core/vehicleDirection';
import { useLineIndex, useLines, useLineStream, usePatterns, useRegionId, useStopIndex, useVehicles } from '@/data/hooks';
import { useReferencePoint } from '@/map/location';
import { useKeptState } from '@/state/kept';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

const LINE_COLORS: Record<Mode, { dotColor: string; railColor: string }> = {
  bus: { dotColor: 'border-primary-strong', railColor: 'bg-primary-strong' },
  tram: { dotColor: 'border-tram', railColor: 'bg-tram' },
  metro: { dotColor: 'border-metro', railColor: 'bg-metro' },
  train: { dotColor: 'border-train', railColor: 'bg-train' },
  ferry: { dotColor: 'border-ferry', railColor: 'bg-ferry' },
};

function mainPatterns(patterns: Pattern[], line: string) {
  const byDirection = new Map<number, Pattern>();
  for (const p of patterns) {
    if (p.line !== line) continue;
    const best = byDirection.get(p.dir);
    if (!best || p.trips > best.trips) byDirection.set(p.dir, p);
  }
  return [...byDirection.values()];
}

export function LineDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  useSheetSnap('half');
  const { data: allLines } = useLines();
  const line = useLineIndex().get(id);
  const { data: patterns } = usePatterns();
  const stops = useStopIndex();
  const { data: vehicles } = useVehicles();
  const setFocus = useUi((s) => s.setFocus);
  const region = useRegionId();
  const favorite = useSettings((s) => s.favoriteLines[region]?.includes(id) ?? false);
  const toggleFavorite = useSettings((s) => s.toggleFavoriteLine);

  const directions = useMemo(() => mainPatterns(patterns ?? [], id), [patterns, id]);

  const [dir, setDir] = useKeptState<string>('dir', '0');
  const pattern = directions.find((p) => String(p.dir) === dir) ?? directions[0];
  const [vehicleRef, setVehicleRef] = useKeptState<string | undefined>('vehicleRef', undefined);

  useLineStream(id);
  const [params, setParams] = useSearchParams();
  const findNearest = params.has('nearest');
  const { point } = useReferencePoint();
  useEffect(() => {
    if (!findNearest || !vehicles || !patterns) return;
    const nearest = vehicles
      .filter((v) => v.line === id)
      .sort((a, b) => distanceM(point, a) - distanceM(point, b))[0];
    if (!nearest) return;
    setVehicleRef(nearest.ref);
    const going = vehiclePattern(patterns, nearest, (stopId) => stops.get(stopId));
    if (going && directions.some((p) => p.dir === going.dir)) setDir(String(going.dir));
    setParams({}, { replace: true });
  }, [findNearest, vehicles, patterns, id, point, stops, directions, setParams]);

  useEffect(() => setFocus({ line: id, patternId: pattern?.id, vehicleRef }), [id, pattern?.id, vehicleRef, setFocus]);

  if (!line) {
    return (
      <>
        <BackButton fallback="/routes" />
        {allLines ? <Message>{t('routes.notFound')}</Message> : <RowSkeleton />}
      </>
    );
  }

  const running = vehicles?.filter((v) => v.line === id).length ?? 0;
  const { dotColor, railColor } = LINE_COLORS[line.mode];

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2.5 pb-3">
        <BackButton fallback="/routes" />
        <LineBadge line={line.id} mode={line.mode} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] leading-snug font-semibold">{line.name}</h1>
          <p className="truncate text-[13px] text-muted">
            {running ? t('routes.vehiclesOnLine', { count: running }) : t('routes.noVehicles')}
          </p>
        </div>
        <StarButton active={favorite} onToggle={() => toggleFavorite(id)} />
      </div>

      {directions.length > 1 && (
        <Segmented
          value={pattern ? String(pattern.dir) : dir}
          onChange={setDir}
          options={directions.map((p) => ({ value: String(p.dir), label: p.headsign }))}
        />
      )}

      {pattern && (
        <>
          <p className="mt-4 mb-2 px-1 text-[13px] font-medium text-muted">
            {t('routes.towards', { place: pattern.headsign })} · {t('routes.stopCount', { count: pattern.stops.length })}
          </p>
          <Card className="py-2">
            <ol>
              {pattern.stops.map((stopId, i) => {
                const first = i === 0;
                const last = i === pattern.stops.length - 1;
                return (
                  <li key={`${stopId}-${i}`}>
                    <Link to={`/stops/${stopId}`} className="flex items-stretch gap-3 px-4 active:bg-raised">
                      <span className="relative flex w-3 shrink-0 justify-center">
                        <span
                          className={`absolute w-[3px] ${railColor}`}
                          style={{ top: first ? '50%' : 0, bottom: last ? '50%' : 0 }}
                        />
                        <span className={`relative my-auto size-3 rounded-full border-[2.5px] bg-card ${dotColor}`} />
                      </span>
                      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-2.5">
                        <span className={`truncate ${first || last ? 'font-semibold' : ''}`}>{stops.get(stopId)?.name ?? stopId}</span>
                        <span className="tabular shrink-0 text-[13px] text-muted">
                          {!first && t('departure.minutes', { count: pattern.offsets[i] })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>
        </>
      )}
    </>
  );
}
