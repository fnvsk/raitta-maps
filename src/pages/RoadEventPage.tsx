import { CalendarClock, Construction, Info, MapPin, OctagonX, TriangleAlert } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Divided, Message, RowSkeleton, SectionTitle } from '@/components/ui';
import { shownRestrictions, signPoint, type RoadEvent, type RoadEventKind } from '@/core/roadEvents';
import { useRoadEvents } from '@/data/hooks';
import { useUi } from '@/state/ui';

const EVENT_ZOOM = 14;

export const ROAD_EVENT_STYLE: Record<RoadEventKind, { icon: typeof Construction; tone: string }> = {
  closure: { icon: OctagonX, tone: 'bg-red-600' },
  accident: { icon: TriangleAlert, tone: 'bg-red-600' },
  roadwork: { icon: Construction, tone: 'bg-orange-600' },
  notice: { icon: Info, tone: 'bg-amber-500' },
};

export function useRoadTitle() {
  const { t } = useTranslation();
  return (event: RoadEvent) => {
    const road = event.road ? t('road.number', { number: event.road }) : '';
    return [road, event.name].filter(Boolean).join(' ') || event.towns.join(', ') || t(`road.kinds.${event.kind}`);
  };
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0 text-(--muted-icon)">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

export function RoadEventPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  useSheetSnap('peek');
  const setFocus = useUi((s) => s.setFocus);
  const flyTo = useUi((s) => s.flyTo);
  const { data, isLoading } = useRoadEvents();
  const event = data?.events.find((candidate) => candidate.id === id);
  const title = useRoadTitle();

  useEffect(() => {
    setFocus({ roadEvents: true, roadEventId: id });
    return () => setFocus({});
  }, [id, setFocus]);
  const sign = event ? signPoint(event) : null;
  useEffect(() => {
    if (sign) flyTo({ lon: sign[0], lat: sign[1], zoom: EVENT_ZOOM });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, flyTo]);

  if (!event) {
    return (
      <>
        <BackButton />
        {isLoading ? <RowSkeleton /> : <Message>{t('road.missing')}</Message>}
      </>
    );
  }

  const { icon: Icon, tone } = ROAD_EVENT_STYLE[event.kind];
  const format = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' }).format(new Date(iso));
  const restrictions = shownRestrictions(event);

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2 pb-3">
        <BackButton />
        <span className={`grid size-11 shrink-0 place-items-center rounded-[14px] text-white ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pl-1">
          <h1 className="truncate text-[21px] leading-tight font-bold tracking-tight">{title(event)}</h1>
          <p className="truncate text-[14px] text-muted">{[t(`road.kinds.${event.kind}`), event.towns.join(', ')].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      {(restrictions.length > 0 || event.now === false) && (
        <Card className="p-3">
          {event.now === false && <p className="mb-2 px-0.5 text-[14px] font-medium text-muted">{t('road.notNow')}</p>}
          <div className="flex flex-wrap gap-1.5">
            {restrictions.map((r) => (
              <span key={r.t} className={`rounded-lg px-2.5 py-1 text-[14px] font-semibold ${r.t === 'ROAD_CLOSED' ? 'bg-red-600 text-white' : 'bg-raised'}`}>
                {t(`road.r.${r.t}`, { v: r.v, u: r.u })}
              </span>
            ))}
          </div>
        </Card>
      )}

      <SectionTitle>{t('fuel.stationInfo')}</SectionTitle>
      <Card>
        <Divided>
          {(event.start || event.end) && (
            <Row icon={<CalendarClock className="size-5" />}>
              {event.end ? t('road.period', { from: event.start ? format(event.start) : '…', to: format(event.end) }) : t('road.since', { from: format(event.start!) })}
            </Row>
          )}
          {event.where && (
            <Row icon={<MapPin className="size-5" />}>
              <span lang="fi">{event.where}</span>
            </Row>
          )}
          {event.fi && (
            <Row icon={<Info className="size-5" />}>
              <span className="block text-[13px] text-muted">{t('road.original')}</span>
              <span lang="fi" className="whitespace-pre-line">
                {event.fi}
              </span>
            </Row>
          )}
        </Divided>
      </Card>
      <p className="mt-3 px-1 text-center text-[13px] text-muted">{t('road.source')}</p>
    </>
  );
}
