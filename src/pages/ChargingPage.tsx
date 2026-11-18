import { ChevronRight, CircleCheck, Clock, Compass, ExternalLink, Globe, Info, MapPin, Phone, Zap } from 'lucide-react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { BackButton, Card, Divided, Message, RowSkeleton, SectionTitle, Segmented, ServiceSwitch, useDistanceLabel } from '@/components/ui';
import {
  connectorGroups,
  FAST_KW,
  matches,
  nearestSites,
  PLUG_LABELS,
  priceNow,
  summarize,
  tariffText,
  type ChargerFilter,
  type ChargerSite,
  type ChargersData,
  type ChargerStatus,
  type ConnectorGroup,
  type Plug,
  type PriceStep,
  type SiteState,
} from '@/core/charging';
import { distanceM } from '@/core/geo';
import { useChargers, useChargerStatus } from '@/data/hooks';
import { useReferencePoint } from '@/map/location';
import { useSettings } from '@/state/settings';
import { useUi, type ChargerPin } from '@/state/ui';

const LISTED_SITES = 20;
const MINUTES_PER_HOUR = 60;

export const STATE_STYLE: Record<SiteState, { tile: string; pill: string; dot: string }> = {
  free: { tile: 'bg-green-600', pill: 'bg-green-500/15 text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  busy: { tile: 'bg-amber-600', pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  down: { tile: 'bg-slate-500', pill: 'bg-raised text-muted', dot: 'bg-slate-400' },
  unknown: { tile: 'bg-teal-600', pill: 'bg-raised text-muted', dot: 'bg-teal-500' },
};

export function EnergySwitch({ value }: { value: 'fuel' | 'charging' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setEnergy = useSettings((s) => s.setEnergy);

  useEffect(() => setEnergy(value), [value, setEnergy]);
  return (
    <div className="mb-3">
      <Segmented
        value={value}
        options={[
          { value: 'fuel', label: t('charging.fuel') },
          { value: 'charging', label: t('charging.electric') },
        ]}
        onChange={(next) => {
          setEnergy(next);
          navigate(next === 'fuel' ? '/fuel' : '/charging', { replace: true });
        }}
      />
    </div>
  );
}

function useEuro(digits = 2) {
  const { i18n } = useTranslation();
  return (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

const toPin = (site: ChargerSite, status?: ChargerStatus): ChargerPin => {
  const summary = summarize(site, status);
  return { id: site.id, lat: site.y, lon: site.x, state: summary.state, kw: summary.maxKw };
};

const kwLabel = (kw: number) => (kw % 1 && kw < 10 ? kw.toFixed(1) : String(Math.round(kw)));

export function PlugIcon({ plug, className = 'size-6' }: { plug: Plug; className?: string }) {
  const pin = (cx: number, cy: number, r = 1.15) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
  const type2 = (y: number, scale: number) => (
    <g transform={`translate(12 ${y}) scale(${scale}) translate(-12 -12)`}>
      <path d="M6.2 5.5h11.6a8 8 0 1 1-11.6 0Z" />
      {[pin(9.8, 8.6), pin(14.2, 8.6), pin(7.6, 12.2), pin(12, 12.2), pin(16.4, 12.2), pin(9.8, 15.8), pin(14.2, 15.8)]}
    </g>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      {plug === 't2' || plug === 't2c' ? (
        type2(12, 1)
      ) : plug === 'ccs' ? (
        <>
          {type2(8.4, 0.72)}
          <path d="M6.5 15.6h11a3.4 3.4 0 0 1 0 6.4h-11a3.4 3.4 0 0 1 0-6.4Z" />
          {[pin(9.2, 18.8, 1.6), pin(14.8, 18.8, 1.6)]}
        </>
      ) : plug === 'chademo' ? (
        <>
          <circle cx={12} cy={12} r={8.5} />
          {[pin(8.2, 12, 2.1), pin(15.8, 12, 2.1), pin(12, 7.4, 0.9), pin(12, 16.6, 0.9)]}
        </>
      ) : plug === 'schuko' ? (
        <>
          <circle cx={12} cy={12} r={8.5} />
          {[pin(8.6, 12, 1.4), pin(15.4, 12, 1.4)]}
        </>
      ) : (
        <path d="M13 3 6 13.5h5L10 21l7-10.5h-5L13 3Z" />
      )}
    </svg>
  );
}

function PowerTile({ kw, state, large = false }: { kw: number; state: SiteState; large?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`flex shrink-0 flex-col items-center justify-center rounded-[14px] text-white ${STATE_STYLE[state].tile} ${large ? 'size-14' : 'size-12'}`}>
      <span className={`tabular leading-none font-bold ${large ? 'text-[20px]' : 'text-[17px]'}`}>{kwLabel(kw)}</span>
      <span className="mt-0.5 text-[10.5px] leading-none font-semibold opacity-90">{t('charging.kw')}</span>
    </span>
  );
}

function StatusPill({ site, status }: { site: ChargerSite; status?: ChargerStatus }) {
  const { t } = useTranslation();
  const { free, total, state } = summarize(site, status);
  const style = STATE_STYLE[state];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold ${style.pill}`}>
      <span className={`size-1.5 rounded-full ${style.dot}`} />
      {state === 'unknown' ? t('charging.points', { count: total }) : state === 'down' ? t('charging.outOfOrder') : t('charging.free', { free, total })}
    </span>
  );
}

function SiteRow({ site, meters, data, status }: { site: ChargerSite; meters: number; data: ChargersData; status?: ChargerStatus }) {
  const distanceLabel = useDistanceLabel();
  const summary = summarize(site, status);
  const plugs = [...new Map(summary.plugs.filter((plug) => plug !== 'other').map((plug) => [PLUG_LABELS[plug], plug])).entries()];
  return (
    <Link to={`/charging/${encodeURIComponent(site.id)}`} className="flex items-center gap-3 p-3 active:bg-raised">
      <PowerTile kw={summary.maxKw} state={summary.state} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{site.n}</span>
        <span className="block truncate text-[13px] text-muted">{[distanceLabel(meters), data.operators[site.o]?.name].filter(Boolean).join(' · ')}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusPill site={site} status={status} />
          {plugs.map(([label, plug]) => (
            <span key={label} className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-muted ring-1 ring-hairline">
              <PlugIcon plug={plug} className="size-3.5" />
              {label}
            </span>
          ))}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
    </Link>
  );
}

function ToggleChip({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`press flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[12px] px-2 text-[14px] font-semibold ${
        active ? 'bg-primary-soft text-primary' : 'bg-raised text-ink'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function FilterBar({ filter, onChange }: { filter: ChargerFilter; onChange: (filter: ChargerFilter) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Segmented
        value={filter.plug}
        options={[
          { value: 'all', label: t('charging.allPlugs') },
          { value: 'ccs', label: 'CCS' },
          { value: 'type2', label: 'Type 2' },
          { value: 'chademo', label: 'CHAdeMO' },
        ]}
        onChange={(plug) => onChange({ ...filter, plug })}
      />
      <div className="grid grid-cols-2 gap-2">
        <ToggleChip
          active={filter.fastOnly}
          icon={<Zap className="size-4" />}
          label={t('charging.fast', { kw: FAST_KW })}
          onClick={() => onChange({ ...filter, fastOnly: !filter.fastOnly })}
        />
        <ToggleChip
          active={filter.freeOnly}
          icon={<CircleCheck className="size-4" />}
          label={t('charging.freeOnly')}
          onClick={() => onChange({ ...filter, freeOnly: !filter.freeOnly })}
        />
      </div>
    </div>
  );
}

export function ChargingPage() {
  const { t } = useTranslation();
  useSheetSnap('peek');
  const setFocus = useUi((s) => s.setFocus);
  const filter = useSettings((s) => s.chargerFilter);
  const setFilter = useSettings((s) => s.setChargerFilter);
  const { point, isRider } = useReferencePoint();
  const { data, isLoading, isError } = useChargers();
  const { data: status } = useChargerStatus();

  const nearby = useMemo(
    () => (data ? nearestSites(data.sites.filter((site) => matches(site, filter, status)), point, Infinity) : []),
    [data, filter, status, point],
  );

  useEffect(() => {
    setFocus({ chargers: nearby.map(({ site }) => toPin(site, status)), roadEvents: true });
  }, [nearby, status, setFocus]);
  useEffect(() => () => setFocus({}), [setFocus]);

  return (
    <>
      <div data-sheet-drag className="touch-none">
        <ServiceSwitch />
        <EnergySwitch value="charging" />
      </div>
      <FilterBar filter={filter} onChange={setFilter} />

      <SectionTitle>{t(isRider ? 'charging.nearby' : 'charging.nearCenter')}</SectionTitle>
      <Card>
        {isLoading && <RowSkeleton rows={3} />}
        {isError && <Message>{t('charging.failed')}</Message>}
        {data && !nearby.length && <Message>{t('charging.none')}</Message>}
        <Divided>
          {data &&
            nearby.slice(0, LISTED_SITES).map(({ site, meters }) => <SiteRow key={site.id} site={site} meters={meters} data={data} status={status} />)}
        </Divided>
      </Card>
      <p className="mt-3 px-1 text-center text-[13px] text-muted">{t('charging.source')}</p>
    </>
  );
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-(--muted-icon)">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

function stepsText(steps: PriceStep[], t: (key: string, options?: Record<string, unknown>) => string, euro: (value: number) => string) {
  return steps
    .map((step, index) => {
      const price = step.price === 0 ? t('charging.freeOfCharge') : t('charging.perMinute', { price: euro(step.price / MINUTES_PER_HOUR) });
      return index === 0 && step.fromMin === 0 ? price : t('charging.fromMinute', { minutes: step.fromMin, price });
    })
    .join(', ');
}

function GroupRow({ group, data, status }: { group: ConnectorGroup; data: ChargersData; status?: ChargerStatus }) {
  const { t, i18n } = useTranslation();
  const euro = useEuro(2);
  const tariff = data.tariffs[group.tariff];
  const price = tariff ? priceNow(tariff, group.kw) : undefined;
  const note = tariff ? tariffText(tariff, i18n.language) : undefined;
  const extras = price
    ? [
        price.time && `${t('charging.time')}: ${stepsText(price.time, t, euro)}`,
        price.parking && `${t('charging.parking')}: ${stepsText(price.parking, t, euro)}`,
        price.congestion && `${t('charging.congestion')}: ${stepsText(price.congestion, t, euro)}`,
        price.flat !== undefined && `${t('charging.startFee')}: ${euro(price.flat)}`,
      ].filter(Boolean)
    : [];
  const free = status ? group.free > 0 : undefined;

  return (
    <div className="flex items-start gap-3 p-3">
      <span className={`grid size-11 shrink-0 place-items-center rounded-[12px] ${group.kw >= FAST_KW ? 'bg-primary-soft text-primary' : 'bg-raised'}`}>
        <PlugIcon plug={group.plug} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {PLUG_LABELS[group.plug]} <span className="font-normal text-muted">· {t('charging.upTo', { kw: kwLabel(group.kw) })}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px]">
          <span className={`size-1.5 shrink-0 rounded-full ${free === undefined ? 'bg-teal-500' : free ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className={free ? 'font-semibold text-green-700 dark:text-green-400' : 'text-muted'}>
            {status ? t('charging.free', { free: group.free, total: group.total }) : t('charging.points', { count: group.total })}
          </span>
          {group.plug === 't2c' && <span className="text-muted">· {t('charging.cable')}</span>}
        </span>
        {extras.map((line) => (
          <span key={line as string} className="mt-1 block text-[13px] text-muted">
            {line}
          </span>
        ))}
        {!tariff && <span className="mt-1 block text-[13px] text-muted">{t('charging.noTariff')}</span>}
        {note && <span className="mt-1 block text-[13px] text-muted">{note}</span>}
        {tariff?.url && (
          <a href={tariff.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
            {t('charging.operatorPage')}
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </span>
      {price?.energy !== undefined && (
        <span className="shrink-0 text-right">
          <span className="tabular block text-[17px] leading-tight font-bold">{euro(price.energy)}</span>
          <span className="block text-[12px] text-muted">/{t('charging.kwh')}</span>
        </span>
      )}
    </div>
  );
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function ChargerPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  useSheetSnap('half');
  const setFocus = useUi((s) => s.setFocus);
  const distanceLabel = useDistanceLabel();
  const { point } = useReferencePoint();
  const { data, isLoading } = useChargers();
  const { data: status } = useChargerStatus();
  const site = data?.sites.find((candidate) => candidate.id === id);

  useEffect(() => {
    if (site) setFocus({ chargers: [toPin(site, status)], roadEvents: true });
  }, [site, status, setFocus]);
  useEffect(() => () => setFocus({}), [setFocus]);

  if (!site || !data) {
    return (
      <>
        <BackButton fallback="/charging" />
        {isLoading ? <RowSkeleton /> : <Message>{t('charging.missing')}</Message>}
      </>
    );
  }

  const summary = summarize(site, status);
  const operator = data.operators[site.o];
  const plan = new URLSearchParams({ view: 'plan', toLat: String(site.y), toLon: String(site.x), toName: site.n });
  const meters = distanceM(point, { lat: site.y, lon: site.x });

  return (
    <>
      <div data-sheet-drag className="flex touch-none items-center gap-3 pb-3">
        <BackButton fallback="/charging" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[21px] leading-tight font-bold tracking-tight">{site.n}</h1>
          <p className="truncate text-[14px] text-muted">{[operator?.name, distanceLabel(meters)].filter(Boolean).join(' · ')}</p>
        </div>
        <PowerTile kw={summary.maxKw} state={summary.state} large />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <StatusPill site={site} status={status} />
        {!site.h && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-raised px-2 text-[13px] font-medium">
            <Clock className="size-3.5" />
            {t('charging.allDay')}
          </span>
        )}
      </div>

      <Link to={`/routes?${plan}&start=1`} className="primary-fill press flex h-12 items-center justify-center gap-2 rounded-full font-semibold">
        <Compass className="size-5 shrink-0" />
        {t('stop.directions')}
      </Link>

      <SectionTitle>{t('charging.pointsTitle')}</SectionTitle>
      <Card>
        <Divided>
          {connectorGroups(site, status).map((group) => (
            <GroupRow key={`${group.plug}|${group.kw}|${group.tariff}`} group={group} data={data} status={status} />
          ))}
        </Divided>
      </Card>
      <p className="mt-2 px-1 text-[13px] text-muted">{t('charging.priceNote')}</p>

      <SectionTitle>{t('fuel.stationInfo')}</SectionTitle>
      <Card>
        <Divided>
          {site.a && <InfoRow icon={<MapPin className="size-5" />}>{site.a}</InfoRow>}
          {site.d && <InfoRow icon={<Info className="size-5" />}>{site.d}</InfoRow>}
          {site.h && (
            <InfoRow icon={<Clock className="size-5" />}>
              <span className="tabular block text-[14px]">
                {site.h.map(([day, from, to], index) => (
                  <span key={index} className="block">
                    {t(`charging.days.${DAY_KEYS[day]}`)} {from}–{to}
                  </span>
                ))}
              </span>
            </InfoRow>
          )}
          {site.ph && (
            <InfoRow icon={<Phone className="size-5" />}>
              <a href={`tel:${site.ph.replaceAll(' ', '')}`} className="font-medium text-primary">
                {site.ph}
              </a>
            </InfoRow>
          )}
          {operator?.web && (
            <InfoRow icon={<Globe className="size-5" />}>
              <a href={operator.web} target="_blank" rel="noopener noreferrer" className="font-medium text-primary">
                {operator.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </InfoRow>
          )}
        </Divided>
      </Card>
      <p className="mt-3 px-1 text-center text-[13px] text-muted">{t('charging.source')}</p>
    </>
  );
}
