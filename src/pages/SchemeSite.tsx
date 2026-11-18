import { ChevronDown, Download, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { LoadingMark, LogoTile } from '@/components/Logo';
import { REGIONS, regionName } from '@/core/regions';
import { buildNetwork, rideOf, routeOnScheme } from '@/core/scheme';
import type { StationSigns } from '@/core/schemeDraw';
import { picturesFor, schemeFor } from '@/core/schemeHand';
import type { Line, Mode, Pattern, Stop } from '@/core/types';
import { Flag } from '@/components/Flag';
import { StationSearch } from '@/components/StationSearch';
import { emblemOf } from '@/core/emblems';
import { LANGUAGES, type Language } from '@/i18n';
import { useSettings } from '@/state/settings';
import { useCityFile, useLandmarks } from '@/data/hooks';
import { dataUrl } from '@/platform';
import { SchemeCanvas } from './SchemePage';

type Kind = 'metro' | 'tram' | 'rail';
const MODE_OF: Record<Kind, Mode> = { metro: 'metro', tram: 'tram', rail: 'train' };

export const SCHEME_PAGES: { region: string; kind: Kind }[] = [
  { region: 'helsinki', kind: 'metro' },
  { region: 'helsinki', kind: 'tram' },
  { region: 'helsinki', kind: 'rail' },
  { region: 'tampere', kind: 'tram' },
];

const PANEL_W = 380;
const WIDE_PX = 860;

function useHeight(initial: number) {
  const ref = useRef<HTMLElement | null>(null);
  const [height, setHeight] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  });
  return [ref as React.RefObject<HTMLElement & HTMLDivElement>, height] as const;
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

export function SchemeSite() {
  const { t, i18n } = useTranslation();
  const { region = 'helsinki', kind: kindParam = 'metro' } = useParams();
  const kind = (['metro', 'tram', 'rail'].includes(kindParam) ? kindParam : 'metro') as Kind;
  const config = REGIONS.find((r) => r.id === region);
  const cityName = config ? regionName(config, i18n.language) : region;
  const { data: lines } = useCityFile<Line[]>(region, 'lines.json.gz');
  const { data: patterns } = useCityFile<Pattern[]>(region, 'patterns.json.gz');
  const { data: stops } = useCityFile<Stop[]>(region, 'stops.json.gz');
  const { data: landmarks } = useLandmarks();
  const network = useMemo(() => (lines && patterns && stops ? buildNetwork(MODE_OF[kind], lines, patterns, stops) : null), [kind, lines, patterns, stops]);
  const layout = useMemo(() => (network ? schemeFor(network) : null), [network]);
  const signs = useMemo(() => {
    if (!network || !layout) return {};
    const pictures = picturesFor(network, landmarks ? Object.values(landmarks).flat() : [], i18n.language);
    const out: Record<string, StationSigns & { sight?: string }> = {};
    for (const station of network.stations) {
      const picture = pictures[station.id];
      const kinds = layout.kinds[station.id];
      if (!kinds && !picture) continue;
      out[station.id] = { kinds, picture: picture ? { url: dataUrl(`sights/${String(picture.pic).padStart(2, '0')}.png`), title: picture.title } : undefined };
    }
    return out;
  }, [network, layout, landmarks, i18n.language]);

  const [menu, setMenu] = useState<'schemes' | 'language' | null>(null);
  const setLanguage = useSettings((st) => st.setLanguage);
  const language = (LANGUAGES.find((l) => l.code === i18n.language)?.code ?? 'en') as Language;
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    setFrom(null);
    setTo(null);
    setFocus(null);
  }, [region, kind]);
  const route = useMemo(() => (network && from && to ? routeOnScheme(network, from, to) : null), [network, from, to]);
  const names = useMemo(() => new Map(network?.stations.map((s) => [s.id, s.name]) ?? []), [network]);
  const pick = (id: string) => {
    if (!from || (from && to)) {
      setFrom(id);
      setTo(null);
    } else if (id !== from) setTo(id);
  };

  const title = `${t(`scheme.${kind}`)} · ${cityName}`;
  useEffect(() => {
    document.title = `${title} — RAITTA`;
  }, [title]);

  const { w, h } = useWindowSize();
  const wide = w >= WIDE_PX;
  const [headerRef, headerH] = useHeight(104);
  const [panelRef, panelH] = useHeight(220);

  const top = headerH + 16;
  const freeArea = wide ? { left: PANEL_W + 28, top, width: w - PANEL_W - 28, height: h - top } : { left: 0, top, width: w, height: Math.max(160, h - top - panelH - 16) };

  const plan = useMemo(() => {
    if (!network || !route || !from || !to) return null;
    const a = network.stations.find((s) => s.id === from)!;
    const b = network.stations.find((s) => s.id === to)!;
    return `/routes?${new URLSearchParams({ view: 'plan', region, fromLat: String(a.lat), fromLon: String(a.lon), fromName: a.name, toLat: String(b.lat), toLon: String(b.lon), toName: b.name, ride: rideOf(network, route) })}`;
  }, [network, route, from, to, region]);

  const panel = (
    <div className="space-y-3">
      {network && <StationSearch network={network} from={from} to={to} onFrom={setFrom} onTo={setTo} />}
      {!from && !to && <p className="px-1 text-[13.5px] leading-snug text-muted">{t('scheme.hint')}</p>}
      {(from || to) && !route && (
        <button type="button" onClick={() => { setFrom(null); setTo(null); }} className="press flex items-center gap-1.5 px-1 text-[13.5px] font-semibold text-primary">
          <RotateCcw className="size-3.5" />
          {t('scheme.reset')}
        </button>
      )}
      {route && network && (
        <div className="surface-card rounded-card p-3.5">
          {route && network && (
            <>
              <p className="text-[14px] text-muted">{t('scheme.summary', { minutes: route.minutes, stations: route.stations.length - 1, changes: route.legs.length - 1 })}</p>
              <ol className="mt-2 space-y-1.5">
                {route.legs.map((leg, i) => (
                  <li key={i} className="flex items-center gap-2 text-[14px]">
                    <span className="grid h-6 min-w-9 place-items-center rounded-[8px] px-1.5 text-[12px] font-bold text-white" style={{ background: network.colors[leg.line] }}>
                      {leg.line}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {names.get(leg.stations[0])} → {names.get(leg.stations.at(-1)!)}
                    </span>
                    <span className="shrink-0 text-muted">{t('scheme.stops', { count: leg.stations.length - 1 })}</span>
                  </li>
                ))}
              </ol>
              {plan && (
                <Link to={plan} className="press primary-fill mt-3 flex h-11 w-full items-center justify-center rounded-full font-semibold">
                  {t('scheme.openInApp')}
                </Link>
              )}
            </>
          )}
        </div>
      )}
      {network && (wide || !route) && (
        <div className="flex flex-wrap gap-1.5">
          {network.lines.map((line) => (
            <button
              key={line}
              type="button"
              aria-pressed={focus === line}
              onClick={() => setFocus(focus === line ? null : line)}
              className={`press grid h-8 min-w-11 place-items-center rounded-[10px] px-2.5 text-[13.5px] font-bold text-white ${focus && focus !== line ? 'opacity-35' : ''}`}
              style={{ background: network.colors[line] }}
            >
              {line}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg text-ink">
      {network && layout && (
        <SchemeCanvas inline controls freeArea={freeArea} network={network} layout={layout} signs={signs} visible route={route} from={from} to={to} focus={focus} onStation={pick} />
      )}
      {!network && (
        <div className="absolute inset-0 grid place-items-center">
          <LoadingMark className="size-14" color="var(--color-primary-strong)" />
        </div>
      )}

      <header ref={headerRef} className="surface absolute inset-x-3 top-3 z-20 flex items-center gap-2 rounded-[22px] p-2 md:right-auto md:w-[min(720px,calc(100%-24px))]">
        <a href="/" className="press flex shrink-0 items-center gap-2 rounded-2xl px-1" aria-label="RAITTA">
          <LogoTile className="size-9" />
          <span className="hidden text-[18px] font-extrabold tracking-tight md:inline">RAITTA</span>
        </a>
        <button
          type="button"
          aria-expanded={menu === 'schemes'}
          onClick={() => setMenu(menu === 'schemes' ? null : 'schemes')}
          className="press flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-raised px-2.5 text-left"
        >
          {emblemOf(region) && <img src={emblemOf(region)} alt="" className="size-8 shrink-0 object-contain" />}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15.5px] font-bold">{t(`scheme.${kind}`)}</span>
            <span className="block truncate text-[12.5px] text-muted">{cityName}</span>
          </span>
          <ChevronDown className={`size-5 shrink-0 text-muted transition-transform ${menu === 'schemes' ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          aria-label={t('settings.language')}
          aria-expanded={menu === 'language'}
          onClick={() => setMenu(menu === 'language' ? null : 'language')}
          className="press grid size-11 shrink-0 place-items-center rounded-2xl bg-raised"
        >
          <Flag language={language} round className="size-6" />
        </button>
        <a href="/download" className="press primary-fill flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[14px] font-semibold">
          <Download className="size-[18px]" />
          <span className="hidden md:inline">{t('scheme.getApp')}</span>
        </a>

        {menu === 'schemes' && (
          <div className="surface absolute inset-x-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-[22px] p-2">
            {[...new Set(SCHEME_PAGES.map((p) => p.region))].map((city) => (
              <div key={city} className="flex items-center gap-3 rounded-2xl p-2">
                {emblemOf(city) && <img src={emblemOf(city)} alt="" className="size-11 shrink-0 object-contain" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{regionName(REGIONS.find((r) => r.id === city)!, i18n.language)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {SCHEME_PAGES.filter((p) => p.region === city).map((page) => {
                      const active = page.region === region && page.kind === kind;
                      return (
                        <Link
                          key={page.kind}
                          to={`/schemes/${page.region}/${page.kind}`}
                          onClick={() => setMenu(null)}
                          className={`press h-9 rounded-full px-3.5 text-[14px] leading-9 font-semibold ${active ? 'primary-fill' : 'bg-raised'}`}
                        >
                          {t(`scheme.${page.kind}`)}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {menu === 'language' && (
          <div className="surface absolute top-full right-0 z-30 mt-2 w-56 overflow-hidden rounded-[20px] p-1.5">
            {LANGUAGES.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  setLanguage(option.code);
                  setMenu(null);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-semibold ${option.code === language ? 'bg-primary-soft text-primary' : 'hover:bg-raised'}`}
              >
                <Flag language={option.code} round className="size-6" />
                {option.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {wide ? (
        <aside className="surface absolute left-3 z-10 max-h-[calc(100%-140px)] w-[380px] overflow-y-auto rounded-[24px] p-3" style={{ top: headerH + 24 }}>
          {panel}
        </aside>
      ) : (
        <aside ref={panelRef} className="surface absolute inset-x-2 bottom-2 z-10 max-h-[52%] overflow-y-auto rounded-[24px] p-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
          {panel}
        </aside>
      )}
    </div>
  );
}
