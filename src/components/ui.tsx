import { LoadingMark } from './Logo';
import {
  Bus,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ExternalLink,
  Search,
  Ship,
  Star,
  Ticket,
  TrainFront,
  TrainFrontTunnel,
  TramFront,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { detectPlatform, openTicketAppNatively, ticketAppFor, ticketStoreUrl, ticketUrl, type TicketApp } from '@/core/tickets';
import { isNativeApp } from '@/platform';
import type { Departure, Mode, Stop } from '@/core/types';
import { formatClock, minutesUntil } from '@/core/time';
import { useLineIndex, useRegionId } from '@/data/hooks';
import { primaryMode } from '@/map/MapView';
import chargingArt from '@/assets/modes/charging.webp';
import fuelArt from '@/assets/modes/fuel.webp';
import metroArt from '@/assets/modes/metro.webp';
import tramArt from '@/assets/modes/tram.webp';
import routeArt from '@/assets/modes/route.webp';
import trainsArt from '@/assets/modes/trains.webp';
import transportArt from '@/assets/modes/transport.webp';
import { isTelegram } from '@/telegram';

export const MODE_BADGE: Record<Mode, string> = {
  bus: 'bg-primary-strong',
  tram: 'bg-tram',
  metro: 'bg-metro',
  train: 'bg-train',
  ferry: 'bg-ferry',
};

const MODE_TONE: Record<Mode, string> = {
  bus: 'text-primary',
  tram: 'text-tram',
  metro: 'text-metro',
  train: 'text-train',
  ferry: 'text-ferry',
};

export function ZoneChip({ zones, compact = false }: { zones: string; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[12px] font-bold text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
      {!compact && <span className="font-medium">{t('plan.zones')}</span>}
      <span className="tracking-wide">{zones}</span>
    </span>
  );
}

export function LineBadge({ line, mode, size = 'md' }: { line: string; mode: Mode; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-[22px] min-w-[28px] px-1.5 text-[12px] rounded-[8px]',
    md: 'h-[26px] min-w-[36px] px-2 text-[14px] rounded-[10px]',
    lg: 'h-[34px] min-w-[46px] px-2.5 text-[17px] rounded-[12px]',
  };
  return (
    <span className={`${MODE_BADGE[mode]} ${sizes[size]} tabular inline-flex max-w-32 items-center justify-center truncate font-semibold text-white`}>
      {line}
    </span>
  );
}

export function ModeIcon({ mode, className = 'size-5' }: { mode: Mode; className?: string }) {
  if (mode === 'tram') return <TramFront className={className} />;
  if (mode === 'metro') return <TrainFrontTunnel className={className} />;
  if (mode === 'train') return <TrainFront className={className} />;
  if (mode === 'ferry') return <Ship className={className} />;
  return <Bus className={className} />;
}

export function ModeDisc({ mode }: { mode: Mode }) {
  return (
    <span className={`${MODE_TONE[mode]} grid size-11 shrink-0 place-items-center rounded-full bg-raised`}>
      <ModeIcon mode={mode} />
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface-card rounded-card ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 mb-2.5 px-1 text-[19px] font-bold tracking-[-0.015em]">{children}</h2>;
}

export function Divided({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-hairline">{children}</div>;
}

export function Message({ children }: { children: ReactNode }) {
  return <p className="px-6 py-8 text-center text-[15px] leading-snug text-muted">{children}</p>;
}

const SLOW_LOAD_MS = 1200;
const VERY_SLOW_LOAD_MS = 8000;

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useTranslation();
  const online = useOnline();
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    const slow = setTimeout(() => setWaited(1), SLOW_LOAD_MS);
    const verySlow = setTimeout(() => setWaited(2), VERY_SLOW_LOAD_MS);
    return () => {
      clearTimeout(slow);
      clearTimeout(verySlow);
    };
  }, []);

  if (!online || waited > 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center" role="status">
        <LoadingMark className="size-12" color="var(--color-primary-strong)" />
        <p className="font-semibold">{!online ? t('common.offline') : waited > 1 ? t('common.slow') : t('common.loading')}</p>
        {(!online || waited > 1) && <p className="max-w-64 text-[13px] text-muted">{t(online ? 'common.slowHint' : 'common.offlineHint')}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-4 p-4" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/5" />
            <div className="skeleton h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label={t('common.back')}
      className="press -ml-1 grid size-10 shrink-0 place-items-center rounded-full bg-raised"
      onClick={() => (history.state?.idx > 0 ? navigate(-1) : navigate(fallback, { replace: true }))}
    >
      <ChevronLeft className="size-6" />
    </button>
  );
}

export function StarButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={t(active ? 'favorite.remove' : 'favorite.add')}
      onClick={onToggle}
      className="press grid size-11 shrink-0 place-items-center rounded-full bg-raised"
    >
      <Star className={`size-[22px] ${active ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="tablist" className="relative flex rounded-full bg-raised p-1">
      <span
        aria-hidden
        className="selected-pill absolute top-1 bottom-1 left-1 rounded-full"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`relative min-w-0 flex-1 truncate rounded-full px-1.5 py-2.5 text-[14.5px] font-semibold transition-colors duration-300 ${
            value === option.value ? 'text-ink' : 'text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 px-1 py-2">
      <span className="min-w-0">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-raised transition-colors peer-checked:bg-primary-strong peer-focus-visible:outline-2 peer-focus-visible:outline-primary after:absolute after:top-[3px] after:left-[3px] after:h-[22px] after:w-[26px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-[16px]" />
    </label>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div data-sheet-drag className="flex min-h-11 touch-none items-center justify-between gap-3 pb-2">
      <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.025em]">{children}</h1>
      {action}
    </div>
  );
}

export function TicketButton({ app: chosen, compact = false }: { app?: TicketApp; compact?: boolean } = {}) {
  const { t } = useTranslation();
  const region = useRegionId();
  const app = chosen ?? ticketAppFor(region);
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);

  const href = isTelegram() ? ticketStoreUrl(app, platform) : ticketUrl(app, platform);
  const nativeAndroid = isNativeApp && platform === 'android';
  const opensApp = nativeAndroid || href.startsWith('intent:');

  const external = href.startsWith('https:');
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={(event) => {
        if (!nativeAndroid) return;
        event.preventDefault();
        void openTicketAppNatively(app);
      }}
      aria-label={compact ? t('tickets.buy') : undefined}
      title={compact ? t('tickets.buy') : undefined}
      className={compact ? 'primary-fill press grid size-12 shrink-0 place-items-center rounded-full' : 'primary-fill press flex min-h-13 items-center gap-3 rounded-[22px] px-4 py-2.5'}
    >
      <Ticket className="size-[22px] shrink-0" />
      {!compact && (
      <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('tickets.buy')}</span>
        <span className="block truncate text-[12.5px] text-white/85">{t(opensApp ? 'tickets.opens' : 'tickets.opensStore', { app: app.name })}</span>
      </span>
      <ExternalLink className="size-[18px] shrink-0 text-white/85" />
      </>
      )}
    </a>
  );
}

export function WhereTo() {
  const { t } = useTranslation();
  return (
    <Link to="/routes?view=plan&start=1" className="surface press flex h-[50px] items-center gap-2.5 rounded-full px-4">
      <Search className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate font-medium">{t('plan.whereTo')}</span>
    </Link>
  );
}

export interface AppMode {
  to: string;
  art: string;
  label: string;
  hint: string;

  paths: string[];

  tint: string;

  extra?: boolean;
}

export function useModes(): AppMode[] {
  const { t } = useTranslation();
  const lines = useLineIndex();
  const has = (mode: string) => [...lines.values()].some((line) => line.mode === mode);
  return [
    { to: '/routes?view=plan&start=1', art: routeArt, label: t('home.route'), hint: t('home.routeHint'), paths: ['/routes'], tint: 'from-sky-500/14' },
    { to: '/transport', art: transportArt, label: t('fuel.transport'), hint: t('home.transportHint'), paths: ['/transport'], tint: 'from-blue-600/14' },
    { to: '/fuel', art: fuelArt, label: t('fuel.title'), hint: t('home.fuelHint'), paths: ['/fuel'], tint: 'from-orange-500/14' },
    { to: '/charging', art: chargingArt, label: t('charging.tab'), hint: t('home.chargingHint'), paths: ['/charging'], tint: 'from-green-500/14' },
    { to: '/trains', art: trainsArt, label: t('longTrains.tab'), hint: t('home.trainsHint'), paths: ['/trains'], tint: 'from-violet-500/14', extra: true },

    ...(has('metro') ? [{ to: '/scheme/metro', art: metroArt, label: t('scheme.metro'), hint: t('home.metroHint'), paths: ['/scheme/metro'], tint: 'from-orange-500/14', extra: true }] : []),
    ...(has('tram') ? [{ to: '/scheme/tram', art: tramArt, label: t('scheme.tram'), hint: t('home.tramHint'), paths: ['/scheme/tram'], tint: 'from-violet-500/14', extra: true }] : []),
  ];
}

export const isModeOpen = (mode: AppMode, pathname: string) => mode.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export function ServiceSwitch() {
  const { pathname } = useLocation();
  const modes = useModes();
  const row = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = () => {
    const el = row.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  const openIndex = modes.findIndex((mode) => isModeOpen(mode, pathname));
  useEffect(() => {
    const el = row.current;
    const tile = el?.children[openIndex] as HTMLElement | undefined;
    if (el && tile) el.scrollTo({ left: tile.offsetLeft - (el.clientWidth - tile.clientWidth) / 2 });
    measure();
  }, [openIndex, modes.length]);
  const fade = `linear-gradient(to right, ${edges.start ? 'transparent, black 28px' : 'black'}, ${edges.end ? 'black calc(100% - 36px), transparent' : 'black'})`;
  return (
    <nav
      ref={row}
      data-sheet-fold
      onScroll={measure}
      className="-mx-4 mb-3 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
    >
      {modes.map((mode) => {
        const open = isModeOpen(mode, pathname);
        return (
          <Link
            key={mode.paths[0]}
            to={mode.to}
            replace={!mode.to.startsWith('/routes')}
            aria-current={open ? 'page' : undefined}
            className={`press mode-tile group relative flex h-[108px] w-[100px] shrink-0 snap-start flex-col items-center justify-end overflow-hidden rounded-[24px] px-1.5 pb-2.5 ${
              open ? 'mode-tile-open' : `bg-gradient-to-b ${mode.tint} to-transparent`
            }`}
          >
            <img
              src={mode.art}
              alt=""
              draggable={false}
              className={`pointer-events-none absolute inset-x-2 top-2.5 mx-auto h-[62px] w-auto max-w-[calc(100%-16px)] object-contain drop-shadow-[0_5px_8px_rgb(10_20_50/0.3)] transition-transform duration-300 ${
                open ? 'scale-110' : 'group-active:scale-95'
              }`}
            />
            <span className={`relative w-full truncate text-center text-[14px] leading-tight font-bold tracking-[-0.01em] ${open ? 'text-primary' : 'text-ink'}`}>{mode.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export const SUPPORT_URL = 'https://ko-fi.com/raitta';

export function SupportButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  if (isNativeApp) return null;
  if (compact)
    return (
      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="press flex h-11 items-center justify-center gap-2 rounded-full bg-rose-500/12 px-4 text-[15px] font-semibold text-rose-500">
        <Coffee className="size-[18px] shrink-0" />
        <span className="truncate">{t('support.title')}</span>
      </a>
    );
  return (
    <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="surface-card press flex items-center gap-3 rounded-card px-3.5 py-3 ring-1 ring-inset ring-hairline">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-500">
        <Coffee className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('support.title')}</span>
        <span className="block text-[13px] leading-snug text-muted">{t('support.hint')}</span>
      </span>
      <ExternalLink className="size-[18px] shrink-0 text-(--muted-icon)" />
    </a>
  );
}

export function useDistanceLabel() {
  const { t, i18n } = useTranslation();
  return (meters: number) =>
    meters < 1000
      ? `≈ ${t('map.meters', { count: Math.round(meters / 10) * 10 })}`
      : `≈ ${t('map.kilometers', {
          value: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(meters / 1000),
        })}`;
}

export function LineChips({ lines, max = 6 }: { lines: string[]; max?: number }) {
  const index = useLineIndex();
  const shown = lines.slice(0, max);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((line) => (
        <LineBadge key={line} line={line} mode={index.get(line)?.mode ?? 'bus'} size="sm" />
      ))}
      {lines.length > max && <span className="tabular px-1 text-[12px] text-muted">+{lines.length - max}</span>}
    </div>
  );
}

export function StopRow({ stop, subtitle }: { stop: Stop; subtitle?: string }) {
  const lines = useLineIndex();
  return (
    <Link to={`/stops/${stop.id}`} className="flex items-center gap-3 p-3 active:bg-raised">
      <ModeDisc mode={primaryMode(stop, (line) => lines.get(line)?.mode)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{stop.name}</span>
        <span className="mb-1 block truncate text-[13px] text-muted">{subtitle ?? stop.city}</span>
        <LineChips lines={stop.lines} />
      </span>
      <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
    </Link>
  );
}

export function useCountdown() {
  const { t } = useTranslation();
  return (time: number, now: number) => {
    const minutes = minutesUntil(time, now);
    if (minutes < 1) return t('departure.now');
    if (minutes >= 60) return formatClock(time);
    return t('departure.minutes', { count: minutes });
  };
}

export function useDelayLabel() {
  const { t } = useTranslation();
  return (delaySec: number) => {
    if (Math.abs(delaySec) < 60) return { text: t('departure.onTime'), tone: 'text-success' };
    const count = Math.round(Math.abs(delaySec) / 60);
    return delaySec > 0
      ? { text: t('departure.late', { count }), tone: 'text-warning' }
      : { text: t('departure.early', { count }), tone: 'text-primary' };
  };
}

export function DepartureRow({ departure, now }: { departure: Departure; now: number }) {
  const { t } = useTranslation();
  const lines = useLineIndex();
  const countdown = useCountdown();
  const delayLabel = useDelayLabel();
  const mode = lines.get(departure.line)?.mode ?? 'bus';
  const delay = delayLabel(departure.delaySec);

  const body = (
    <>
      <LineBadge line={departure.line} mode={mode} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{departure.headsign}</span>
        <span className={`block truncate text-[13px] ${departure.live ? delay.tone : 'text-muted'}`}>
          {departure.live ? delay.text : t('departure.scheduled')}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tabular flex items-center justify-end gap-2 text-[17px] font-semibold">
          {departure.live && <span className="live-dot" title={t('departure.live')} />}
          {countdown(departure.time, now)}
        </span>
        {minutesUntil(departure.time, now) < 60 && (
          <span className="tabular block text-[12px] text-muted">{formatClock(departure.time)}</span>
        )}
      </span>
    </>
  );

  const rowClass = 'flex items-center gap-3 px-3 py-2.5';
  return departure.vehicleRef ? (
    <Link to={`/vehicle/${encodeURIComponent(departure.vehicleRef)}`} className={`${rowClass} active:bg-raised`}>
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
  );
}
