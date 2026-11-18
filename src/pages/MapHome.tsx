import { ChevronDown, ChevronRight, LocateFixed, Navigation } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { Card, Divided, RowSkeleton, ServiceSwitch, StopRow, TicketButton, useDistanceLabel, WhereTo } from '@/components/ui';
import { nearest } from '@/core/geo';
import { regionAt, regionConfig, regionName } from '@/core/regions';
import { useRegion, useRegions, useStops, useVehicles } from '@/data/hooks';
import { startLocating, useReferencePoint } from '@/map/location';
import { useSettings } from '@/state/settings';
import { useTrip } from '@/state/trip';
import { useUi } from '@/state/ui';
import { useIsDesktop } from '@/theme';

export function MapHome() {
  const { t, i18n } = useTranslation();
  useSheetSnap('peek');
  const desktop = useIsDesktop();
  const setFocus = useUi((s) => s.setFocus);
  const locationError = useUi((s) => s.locationError);
  const { point, isRider, isFar } = useReferencePoint();
  const { data: stops } = useStops();
  const { data: vehicles } = useVehicles();
  const distanceLabel = useDistanceLabel();
  const region = useRegion();
  const { data: regions } = useRegions();
  const location = useUi((s) => s.location);
  const setRegion = useSettings((s) => s.setRegion);
  const requestRecenter = useUi((s) => s.requestRecenter);
  
  const riderRegion = isFar && location && regions ? regionAt(regions, location) : undefined;

  const onTrip = useTrip((s) => s.trip !== null);
  const noLocation = useSettings((s) => s.noLocation);

  useEffect(() => setFocus({}), [setFocus]);

  const close = useMemo(() => nearest(stops ?? [], point, 8), [stops, point]);

  const notice = isFar
    ? t('map.farAway', { city: region.name })
    : locationError === 'denied'
      ? t('map.locationDenied')
      : locationError === 'unavailable'
        ? t('map.locationUnavailable')
        : null;

  return (
    <>
      {onTrip && (
        <Link to="/routes?view=plan" className="press primary-fill mb-3 flex items-center gap-2.5 rounded-full px-4 py-2.5 font-semibold">
          <Navigation className="size-[18px]" />
          <span className="flex-1">{t('trip.backToTrip')}</span>
          <ChevronRight className="size-5" />
        </Link>
      )}
      {desktop && (
        <div className="mb-3">
          <WhereTo />
        </div>
      )}
      <div data-sheet-drag className="touch-none pb-2.5">
        <div className="flex items-center justify-between gap-3">
          <Link to="/regions" aria-label={t('settings.region')} className="press flex min-w-0 items-center gap-1">
            <h2 className="min-w-0 truncate text-[22px] font-bold tracking-tight">{region.name}</h2>
            <ChevronDown className="size-5 shrink-0 text-muted" />
          </Link>
          {vehicles && (
            <span className="flex shrink-0 items-center gap-2 text-[12px] text-muted">
              <span className="live-dot" />
              <span className="tabular whitespace-nowrap">{t('map.vehiclesLive', { count: vehicles.length })}</span>
            </span>
          )}
        </div>
      </div>

      <ServiceSwitch />

      <div className="mb-3">
        <TicketButton />
      </div>

      {notice && <p className="mb-2.5 text-[13px] text-muted">{notice}</p>}
      {riderRegion && (
        <button
          type="button"
          onClick={() => {
            setRegion(riderRegion.id);
            requestRecenter();
          }}
          className="primary-fill press mb-3 flex h-11 w-full items-center justify-center rounded-full font-semibold"
        >
          {t('map.switchTo', { city: regionName(regionConfig(riderRegion.id), i18n.language) })}
        </button>
      )}
      {!isRider && !isFar && !locationError && !noLocation && (
        <button
          type="button"
          onClick={() => startLocating(true)}
          className="mb-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary-soft font-medium text-primary"
        >
          <LocateFixed className="size-[18px]" />
          {t('map.useLocation')}
        </button>
      )}

      <h3 className="mb-2 px-1 text-[15px] font-semibold text-muted">{t(isRider ? 'map.nearby' : 'map.nearCenter')}</h3>
      <Card>
        {stops ? (
          <Divided>
            {close.map(({ item, distance }) => (
              <StopRow key={item.id} stop={item} subtitle={isRider ? distanceLabel(distance) : item.code} />
            ))}
          </Divided>
        ) : (
          <RowSkeleton rows={3} />
        )}
      </Card>
    </>
  );
}
