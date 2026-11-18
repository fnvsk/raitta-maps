import { Clock, Compass, Fuel, Globe, MapPin, Phone, Tag } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Divided, Message, RowSkeleton, SectionTitle, useDistanceLabel } from '@/components/ui';
import type { ReportedPrices } from '@/core/fuel';
import { useFuelStations, useReportedPrices, useStationDetails } from '@/data/hooks';
import { useReferencePoint } from '@/map/location';
import { useUi } from '@/state/ui';
import { PriceTile, ReportForm, useEuros } from './FuelPage';

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

function reportAge(updated: number, language: string) {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const minutes = Math.max(1, Math.round((Date.now() - updated) / MINUTE_MS));
  if (minutes < HOUR_MINUTES) return format.format(-minutes, 'minute');
  if (minutes < DAY_MINUTES) return format.format(-Math.round(minutes / HOUR_MINUTES), 'hour');
  return format.format(-Math.round(minutes / DAY_MINUTES), 'day');
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-(--muted-icon)">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

export function FuelStationPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  useSheetSnap('half');
  const setFocus = useUi((s) => s.setFocus);
  const distanceLabel = useDistanceLabel();
  const euros = useEuros();
  const { point } = useReferencePoint();
  const { data: stations, isLoading } = useFuelStations(point);
  const station = stations?.find((candidate) => candidate.id === id);
  const { data: reported } = useReportedPrices(stations);
  const { data: details, isLoading: loadingDetails } = useStationDetails(station);
  const [own, setOwn] = useState<ReportedPrices | null>(null);
  const [reporting, setReporting] = useState(false);
  const [thanked, setThanked] = useState(false);

  useEffect(() => {
    if (station) setFocus({ fuel: [station], roadEvents: true });
    return () => setFocus({});
  }, [station, setFocus]);

  if (!station) {
    return (
      <>
        <BackButton fallback="/fuel" />
        {isLoading ? <RowSkeleton /> : <Message>{t('fuel.stationMissing')}</Message>}
      </>
    );
  }

  const prices = own ?? reported?.[station.id];
  const plan = new URLSearchParams({ view: 'plan', toLat: String(station.lat), toLon: String(station.lon), toName: station.name });

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-2 pb-3">
        <BackButton fallback="/fuel" />
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-orange-600 text-white">
          <Fuel className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pl-1">
          <h1 className="truncate text-[21px] leading-tight font-bold tracking-tight">{station.name}</h1>
          <p className="truncate text-[14px] text-muted">{[details?.brand, distanceLabel(station.meters)].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <Link to={`/routes?${plan}&start=1`} className="primary-fill press flex h-12 items-center justify-center gap-2 rounded-full font-semibold">
        <Compass className="size-5 shrink-0" />
        {t('stop.directions')}
      </Link>

      <SectionTitle>{t('fuel.pricesTitle')}</SectionTitle>
      <Card className="p-3">
        {prices ? (
          <>
            <div className="flex gap-2">
              {prices.petrol95 !== undefined && <PriceTile label={t('fuel.petrol')} value={euros(prices.petrol95)} />}
              {prices.diesel !== undefined && <PriceTile label={t('fuel.diesel')} value={euros(prices.diesel)} />}
            </div>
            <p className="mt-2 px-0.5 text-[13px] text-muted">
              {t('fuel.reportedBy', { time: reportAge(prices.updated, i18n.language) })}
            </p>
          </>
        ) : (
          <p className="px-0.5 py-1 text-muted">{t('fuel.noPrices')}</p>
        )}
        {thanked ? (
          <p className="mt-2 px-0.5 font-medium text-primary">{t('fuel.priceThanks')}</p>
        ) : (
          !reporting && (
            <button type="button" onClick={() => setReporting(true)} className="press mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-soft font-semibold text-primary">
              <Tag className="size-[18px]" />
              {t('fuel.reportPrice')}
            </button>
          )
        )}
        {reporting && (
          <ReportForm
            station={station}
            onDone={(next) => {
              setOwn(next);
              setReporting(false);
              setThanked(true);
            }}
          />
        )}
      </Card>

      <SectionTitle>{t('fuel.stationInfo')}</SectionTitle>
      <Card>
        <Divided>
          {station.address && <InfoRow icon={<MapPin className="size-5" />}>{station.address}</InfoRow>}
          {details?.phone && (
            <InfoRow icon={<Phone className="size-5" />}>
              <a href={`tel:${details.phone.replaceAll(' ', '')}`} className="font-medium text-primary">
                {details.phone}
              </a>
            </InfoRow>
          )}
          {details?.website && (
            <InfoRow icon={<Globe className="size-5" />}>
              <a href={details.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary">
                {details.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </InfoRow>
          )}
          {details?.openingHours && <InfoRow icon={<Clock className="size-5" />}>{details.openingHours}</InfoRow>}
          {!!details?.fuels.length && (
            <InfoRow icon={<Fuel className="size-5" />}>
              <span className="flex flex-wrap gap-1.5">
                {details.fuels.map((fuel) => (
                  <span key={fuel} className="rounded-lg bg-raised px-2 py-0.5 text-[13px] font-semibold">
                    {fuel}
                  </span>
                ))}
              </span>
            </InfoRow>
          )}
          {loadingDetails && <RowSkeleton rows={1} />}
        </Divided>
      </Card>
    </>
  );
}
