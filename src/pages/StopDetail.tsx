import { Compass, Hash, Layers3, MapPin } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import {
  BackButton,
  Card,
  DepartureRow,
  Divided,
  LineChips,
  Message,
  ModeDisc,
  RowSkeleton,
  Segmented,
  SectionTitle,
  StarButton,
  TicketButton,
  useDistanceLabel,
} from '@/components/ui';
import { distanceM } from '@/core/geo';
import { useDepartures, useLineIndex, useNow, useRegion, useStopIndex, useStops } from '@/data/hooks';
import { useReferencePoint } from '@/map/location';
import { primaryMode } from '@/map/MapView';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

const COLLAPSED_ROWS = 6;
const EXPANDED_ROWS = 40;

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-(--muted-icon)">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function StopDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  useSheetSnap('half');
  const { data: stops, isLoading } = useStops();
  const stop = useStopIndex().get(id);
  const lines = useLineIndex();
  const now = useNow();
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'departures' | 'map'>('departures');
  const setFocus = useUi((s) => s.setFocus);
  const setSnap = useUi((s) => s.setSnap);
  const snap = useUi((s) => s.snap);
  const region = useRegion();
  const favorite = useSettings((s) => s.favoriteStops[region.id]?.includes(id) ?? false);
  const toggleFavorite = useSettings((s) => s.toggleFavoriteStop);
  const { point, isRider } = useReferencePoint();
  const distanceLabel = useDistanceLabel();
  const { departures, loading, liveFailed } = useDepartures(stop);

  useEffect(() => setFocus({ stopId: id }), [id, setFocus]);
  useEffect(() => setView(snap === 'peek' ? 'map' : 'departures'), [snap]);

  if (!stop) {
    return (
      <>
        <BackButton />
        {stops || !isLoading ? <Message>{t('stop.notFound')}</Message> : <RowSkeleton />}
      </>
    );
  }

  const shown = departures.slice(0, expanded ? EXPANDED_ROWS : COLLAPSED_ROWS);

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2 pb-3">
        <BackButton fallback="/stops" />
        <ModeDisc mode={primaryMode(stop, (line) => lines.get(line)?.mode)} />
        <div className="min-w-0 flex-1 pl-1">
          <h1 className="truncate text-[22px] leading-tight font-bold tracking-tight">{stop.name}</h1>
          <p className="tabular truncate text-[14px] text-muted">
            {t('stop.code', { code: stop.code })}
            {isRider && ` · ${distanceLabel(distanceM(point, stop))}`}
          </p>
        </div>
        <StarButton active={favorite} onToggle={() => toggleFavorite(id)} />
      </div>

      <Link to={`/routes?view=plan&to=${stop.id}&start=1`} className="primary-fill press mb-3 flex h-12 items-center justify-center gap-2 rounded-full font-semibold">
        <Compass className="size-5 shrink-0" />
        {t('stop.directions')}
      </Link>

      <Segmented
        value={view}
        onChange={(next) => {
          setView(next);
          setSnap(next === 'map' ? 'peek' : 'half');
        }}
        options={[
          { value: 'departures', label: t('stop.departures') },
          { value: 'map', label: t('stop.onMap') },
        ]}
      />

      <SectionTitle>{t('stop.next')}</SectionTitle>
      {liveFailed && <p className="mb-2 px-1 text-[13px] text-warning">{t('stop.liveFailed')}</p>}
      {!region.hasPredictions && <p className="mb-2 px-1 text-[13px] text-muted">{t('stop.noLive', { city: region.name })}</p>}
      <Card>
        {loading && <RowSkeleton />}
        {!loading && !departures.length && <Message>{t('stop.none')}</Message>}
        <Divided>
          {shown.map((departure) => (
            <DepartureRow key={`${departure.line}-${departure.scheduled}-${departure.vehicleRef ?? ''}`} departure={departure} now={now} />
          ))}
        </Divided>
        {departures.length > COLLAPSED_ROWS && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="w-full border-t border-hairline py-3 font-medium text-primary">
            {t(expanded ? 'stop.showLess' : 'stop.showAll')}
          </button>
        )}
      </Card>

      <SectionTitle>{t('stop.info')}</SectionTitle>
      <Card>
        <Divided>
          <InfoRow icon={<MapPin className="size-5" />}>{`${stop.name}, ${stop.city || region.name}`}</InfoRow>
          {stop.zone && <InfoRow icon={<Layers3 className="size-5" />}>{t('stop.zone', { zone: stop.zone })}</InfoRow>}
          <InfoRow icon={<Hash className="size-5" />}>
            <LineChips lines={stop.lines} max={24} />
          </InfoRow>
        </Divided>
      </Card>

      <div className="mt-4">
        <TicketButton />
      </div>
    </>
  );
}
