import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Bus,
  Car,
  ChevronUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Footprints,
  GitMerge,
  ListOrdered,
  Navigation,
  RotateCcw,
  RotateCw,
  Ship,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, Message, RowSkeleton } from '@/components/ui';
import { eventsAlong, type CarRoute } from '@/core/driving';
import type { RoadEvent, RoadEventKind } from '@/core/roadEvents';
import { formatClock } from '@/core/time';
import type { LatLon } from '@/core/types';
import { useCarRoutes, useClosures, useRoadEvents } from '@/data/hooks';
import type { Travel } from '@/state/settings';
import { useUi } from '@/state/ui';
import { ROAD_EVENT_STYLE } from './RoadEventPage';

export function useDriveTime() {
  const { t } = useTranslation();
  return (seconds: number) => {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes < 60 ? t('plan.duration', { count: minutes }) : t('drive.hoursMinutes', { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, '0') });
  };
}

export function useRouteDistance() {
  const { t, i18n } = useTranslation();
  return (metres: number) =>
    metres < 1000
      ? t('map.meters', { count: Math.max(10, Math.round(metres / 10) * 10) })
      : t('map.kilometers', { value: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: metres < 20_000 ? 1 : 0 }).format(metres / 1000) });
}

export function maneuverIcon(type: number): LucideIcon {
  if ([1, 2, 3].includes(type)) return Navigation;
  if ([4, 5, 6].includes(type)) return Flag;
  if ([9, 18, 20, 23, 37].includes(type)) return ArrowUpRight;
  if ([16, 19, 21, 24, 38].includes(type)) return ArrowUpLeft;
  if ([10, 11].includes(type)) return CornerUpRight;
  if ([14, 15].includes(type)) return CornerUpLeft;
  if (type === 12) return RotateCw;
  if (type === 13) return RotateCcw;
  if ([26, 27].includes(type)) return RotateCw;
  if ([28, 29].includes(type)) return Ship;
  if (type === 25) return GitMerge;
  return ArrowUp;
}

export function TravelTabs({ value, onChange, times }: { value: Travel; onChange: (travel: Travel) => void; times: Record<Travel, string | undefined> }) {
  const { t } = useTranslation();
  const tabs: { value: Travel; icon: LucideIcon; label: string }[] = [
    { value: 'car', icon: Car, label: t('drive.car') },
    { value: 'transit', icon: Bus, label: t('drive.transit') },
    { value: 'walk', icon: Footprints, label: t('plan.onFoot') },
  ];
  return (
    <div role="tablist" className="mb-3 grid grid-cols-3 gap-2">
      {tabs.map(({ value: tab, icon: Icon, label }) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          aria-label={label}
          title={label}
          onClick={() => onChange(tab)}
          className={`press flex h-[54px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 ${value === tab ? 'primary-fill shadow-sm' : 'bg-raised'}`}
        >
          <Icon className={`size-5 shrink-0 ${value === tab ? '' : 'text-primary'}`} />
          <span className="tabular w-full truncate text-center text-[13px] font-semibold">{times[tab] ?? '…'}</span>
        </button>
      ))}
    </div>
  );
}

function EventChips({ events }: { events: RoadEvent[] }) {
  const { t } = useTranslation();
  const counts = new Map<RoadEventKind, number>();
  for (const event of events) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
  return (
    <>
      {[...counts.entries()].map(([kind, count]) => {
        const { icon: Icon, tone } = ROAD_EVENT_STYLE[kind];
        return (
          <span key={kind} className="inline-flex h-6 items-center gap-1 rounded-full bg-raised px-2 text-[12.5px] font-medium">
            <span className={`grid size-4 place-items-center rounded-full text-white ${tone}`}>
              <Icon className="size-2.5" />
            </span>
            {t(`road.kinds.${kind}`)}
            {count > 1 && <span className="text-muted">· {count}</span>}
          </span>
        );
      })}
    </>
  );
}

function RouteCard({ route, index, fastest, selected, events, onSelect }: { route: CarRoute; index: number; fastest: boolean; selected: boolean; events: RoadEvent[]; onSelect: () => void }) {
  const { t } = useTranslation();
  const time = useDriveTime();
  const distance = useRouteDistance();
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className="press mb-2.5 block w-full text-left">
      <Card className={`p-3.5 ${selected ? 'ring-2 ring-primary' : ''}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="tabular text-[22px] leading-tight font-bold">{time(route.seconds)}</span>
          <span className="tabular shrink-0 text-[15px] text-muted">{distance(route.meters)}</span>
        </div>
        <p className="mt-0.5 truncate text-[14px] text-muted">
          {[t('drive.arriveAt', { time: formatClock(Date.now() + route.seconds * 1000) }), route.via.length ? t('drive.via', { roads: route.via.map((road) => (/^d+$/.test(road) ? t('road.number', { number: road }) : road)).join(', ') }) : ''].filter(Boolean).join(' · ')}
        </p>
        {(fastest || route.toll || route.ferry || events.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fastest && index === 0 && <span className="inline-flex h-6 items-center rounded-full bg-primary-soft px-2 text-[12.5px] font-semibold text-primary">{t('drive.fastest')}</span>}
            {route.toll && <span className="inline-flex h-6 items-center rounded-full bg-raised px-2 text-[12.5px] font-medium">{t('drive.toll')}</span>}
            {route.ferry && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-raised px-2 text-[12.5px] font-medium">
                <Ship className="size-3.5" />
                {t('drive.ferry')}
              </span>
            )}
            <EventChips events={events} />
          </div>
        )}
      </Card>
    </button>
  );
}

function CarSteps({ route }: { route: CarRoute }) {
  const { t } = useTranslation();
  const distance = useRouteDistance();
  const flyTo = useUi((s) => s.flyTo);
  return (
    <Card className="mb-3">
      <h3 className="px-4 pt-3 pb-1 text-[13px] font-bold tracking-wide text-muted uppercase">{t('drive.steps')}</h3>
      <ol className="divide-y divide-hairline">
        {route.maneuvers.map((maneuver, index) => {
          const Icon = maneuverIcon(maneuver.type);
          const [lon, lat] = route.path[Math.min(maneuver.begin, route.path.length - 1)];
          return (
            <li key={index}>
              <button type="button" onClick={() => flyTo({ lat, lon, zoom: 16.5 })} className="press flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-raised">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-snug">{maneuver.stop ? t('drive.stopReached', { n: maneuver.stop }) : maneuver.instruction}</span>
                {maneuver.meters > 0 && <span className="tabular shrink-0 text-[13px] text-muted">{distance(maneuver.meters)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function CarOptions({
  origin,
  destination,
  via,
  fromMe,
  onGo,
  onFromMe: _onFromMe,
}: {
  origin: LatLon;
  destination: LatLon;

  via: LatLon[];

  fromMe: boolean;
  onGo: (route: CarRoute) => void;
  onFromMe: () => void;
}) {
  const [showSteps, setShowSteps] = useState(false)
  const { t, i18n } = useTranslation();
  const time = useDriveTime();
  const { data: routes, isLoading, isError } = useCarRoutes(origin, destination, i18n.language, via);
  const { data: roadEvents } = useRoadEvents();
  const closures = useClosures();
  const pick = useUi((s) => s.carPick);
  const setPick = useUi((s) => s.setCarPick);
  const picked = routes?.[Math.min(pick, routes.length - 1)];
  const fastest = routes ? Math.min(...routes.map((route) => route.seconds)) : 0;
  const along = useMemo(() => routes?.map((route) => eventsAlong(route, roadEvents?.events ?? [])) ?? [], [routes, roadEvents]);

  if (isLoading || !closures.ready)
    return (
      <Card>
        <RowSkeleton rows={2} />
      </Card>
    );
  if (isError || !routes?.length) return <Message>{t('drive.unavailable')}</Message>;

  return (
    <>
      {picked && fromMe && (
        <button type="button" onClick={() => onGo(picked)} className="press primary-fill mb-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold">
          <Navigation className="size-[18px]" />
          {t('drive.go')} · {time(picked.seconds)}
        </button>
      )}
      {picked && !fromMe && (
        <div className="mb-2.5 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={() => onGo(picked)} className="press primary-fill flex h-12 items-center justify-center gap-2 rounded-full text-[16px] font-semibold">
            <Navigation className="size-[18px]" />
            {t('drive.goFromHere')}
          </button>
          <button
            type="button"
            onClick={() => setShowSteps(!showSteps)}
            aria-expanded={showSteps}
            aria-label={t('drive.steps')}
            title={t('drive.steps')}
            className={`press grid size-12 place-items-center rounded-full ${showSteps ? 'bg-primary-soft text-primary' : 'bg-raised'}`}
          >
            <ListOrdered className="size-5" />
          </button>
        </div>
      )}
      {picked && !fromMe && showSteps && <CarSteps route={picked} />}
      {routes.map((route, index) => (
        <RouteCard
          key={`${index}:${route.meters}`}
          route={route}
          index={index}
          fastest={route.seconds === fastest && routes.length > 1}
          selected={route === picked}
          events={along[index] ?? []}
          onSelect={() => setPick(index)}
        />
      ))}
      {closures.avoid.length > 0 && <p className="px-1 text-[13px] text-muted">{t('drive.avoided')}</p>}
      <p className="mt-1 px-1 text-[12px] text-muted">
        {t('drive.source')}{' '}
        <Link to="/privacy" className="underline">
          OpenStreetMap
        </Link>
      </p>
    </>
  );
}

export function CarSummary({ route, fromMe, onExpand, onGo }: { route: CarRoute; fromMe: boolean; onExpand: () => void; onGo: () => void }) {
  const { t } = useTranslation();
  const time = useDriveTime();
  const distance = useRouteDistance();
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={t('routes.plan')} onClick={onExpand} className="press flex h-[54px] min-w-0 flex-1 items-center gap-2 text-left">
        <Car className="size-5 shrink-0 text-primary" />
        <span className="tabular shrink-0 text-[17px] font-bold">{time(route.seconds)}</span>
        <span className="tabular min-w-0 flex-1 truncate text-muted">
          {distance(route.meters)} · {formatClock(Date.now() + route.seconds * 1000)}
        </span>
        <ChevronUp className="size-5 shrink-0 text-(--muted-icon)" />
      </button>
      <button type="button" onClick={onGo} aria-label={t(fromMe ? 'drive.go' : 'drive.goFromHere')} title={t(fromMe ? 'drive.go' : 'drive.goFromHere')} className="press primary-fill grid size-11 shrink-0 place-items-center rounded-full">
        <Navigation className="size-5" />
      </button>
    </div>
  );
}
