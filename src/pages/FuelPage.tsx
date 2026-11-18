import { ChevronRight, ExternalLink, Fuel } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { Card, Divided, Message, RowSkeleton, SectionTitle, ServiceSwitch, useDistanceLabel } from '@/components/ui';
import { parsePrice, reportPrices, type FuelStation, type ReportedPrices } from '@/core/fuel';
import { useFuelPrices, useFuelStations, useRegionId, useReportedPrices } from '@/data/hooks';
import { useReferencePoint } from '@/map/location';
import { useUi } from '@/state/ui';
import { EnergySwitch } from './ChargingPage';

export function useEuros() {
  const { i18n } = useTranslation();
  return (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR', minimumFractionDigits: 3 }).format(value);
}

export function PriceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-[14px] bg-raised px-3 py-2.5">
      <span className="block truncate text-[13px] text-muted">{label}</span>
      <span className="tabular block text-[20px] font-bold">{value}</span>
    </div>
  );
}

export function ReportForm({ station, onDone }: { station: FuelStation; onDone: (prices: ReportedPrices) => void }) {
  const { t } = useTranslation();
  const [petrol, setPetrol] = useState('');
  const [diesel, setDiesel] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'failed' | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const petrol95 = parsePrice(petrol);
    const dieselPrice = parsePrice(diesel);
    if (petrol95 === null || dieselPrice === null || (petrol95 === undefined && dieselPrice === undefined)) {
      setProblem('invalid');
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      onDone(await reportPrices(station.id, { petrol95, diesel: dieselPrice }));
    } catch {
      setProblem('failed');
    } finally {
      setSending(false);
    }
  };

  const field = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="min-w-0 flex-1 text-[13px] text-muted">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder="2,249"
        className="tabular mt-1 h-11 w-full rounded-[12px] bg-raised px-3 text-[17px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted focus:ring-2 focus:ring-primary"
      />
    </label>
  );

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-2.5 space-y-2.5">
      <div className="flex gap-2">
        {field(t('fuel.petrol'), petrol, setPetrol)}
        {field(t('fuel.diesel'), diesel, setDiesel)}
      </div>
      {problem && <p className="text-[13px] text-rose-500">{t(problem === 'invalid' ? 'fuel.priceInvalid' : 'fuel.priceFailed')}</p>}
      <button type="submit" disabled={sending} className="primary-fill press h-11 w-full rounded-full font-semibold disabled:opacity-60">
        {t('fuel.sendPrice')}
      </button>
    </form>
  );
}

function StationRow({ station, reported }: { station: FuelStation; reported?: ReportedPrices | null }) {
  const distanceLabel = useDistanceLabel();
  const euros = useEuros();

  return (
    <Link to={`/fuel/${encodeURIComponent(station.id)}`} className="flex items-center gap-3 p-3 active:bg-raised">
      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-orange-600 text-white">
        <Fuel className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{station.name}</span>
        <span className="block truncate text-[13px] text-muted">{[distanceLabel(station.meters), station.address].filter(Boolean).join(' · ')}</span>
        {reported && (
          <span className="tabular mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px]">
            {reported.petrol95 !== undefined && <span className="rounded-lg bg-primary-soft px-2 py-0.5 font-semibold text-primary">95: {euros(reported.petrol95)}</span>}
            {reported.diesel !== undefined && <span className="rounded-lg bg-raised px-2 py-0.5 font-semibold">D: {euros(reported.diesel)}</span>}
          </span>
        )}
      </span>
      <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
    </Link>
  );
}

export function FuelPage() {
  const { t, i18n } = useTranslation();
  useSheetSnap('peek');
  const setFocus = useUi((s) => s.setFocus);
  const region = useRegionId();
  const { point, isRider } = useReferencePoint();
  const { data: stations, isLoading, isError } = useFuelStations(point);
  const { data: prices } = useFuelPrices();
  const { data: reported } = useReportedPrices(stations);
  const euros = useEuros();

  useEffect(() => {
    setFocus({ fuel: stations ?? [], roadEvents: true });
    return () => setFocus({});
  }, [stations, setFocus]);

  const city = region.charAt(0).toUpperCase() + region.slice(1);

  return (
    <>
      <div data-sheet-drag className="touch-none">
        <ServiceSwitch />
        <EnergySwitch value="fuel" />
      </div>

      {prices && (
        <Card className="mb-1 p-3">
          <h2 className="mb-2 px-0.5 font-semibold">{t('fuel.average')}</h2>
          <div className="flex gap-2">
            <PriceTile label={t('fuel.petrol')} value={euros(prices.petrol95)} />
            <PriceTile label={t('fuel.diesel')} value={euros(prices.diesel)} />
          </div>
          <p className="mt-2 px-0.5 text-[13px] text-muted">{t('fuel.asOf', { date: new Date(prices.updated).toLocaleDateString(i18n.language) })}</p>
        </Card>
      )}

      <SectionTitle>{t(isRider ? 'fuel.nearby' : 'fuel.nearCenter')}</SectionTitle>
      <Card>
        {isLoading && <RowSkeleton rows={3} />}
        {isError && <Message>{t('fuel.failed')}</Message>}
        {stations && !stations.length && <Message>{t('fuel.none')}</Message>}
        <Divided>{stations?.map((station) => <StationRow key={station.id} station={station} reported={reported?.[station.id]} />)}</Divided>
      </Card>

      <a
        href={`https://www.polttoaine.net/${city}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 py-1 text-[14px] font-medium text-primary"
      >
        {t('fuel.stationPrices')}
        <ExternalLink className="size-4 shrink-0" />
      </a>
    </>
  );
}
