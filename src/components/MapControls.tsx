import { ChevronRight, Layers, LoaderCircle, MapPin, Navigation, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { IN_CITY_MARGIN_DEG, inBounds, regionAt, regionConfig, regionName } from '@/core/regions';
import type { LatLon } from '@/core/types';
import { useRegion, useRegionId, useRegions } from '@/data/hooks';
import { useSettings, type MapLayers } from '@/state/settings';
import { useUi } from '@/state/ui';
import { askForLocation } from './LocationAsk';
import { Toggle } from './ui';

const control = 'press grid size-12 place-items-center text-ink';
const SWITCH_SETTLE_MS = 400;

type Elsewhere = { id: string; name: string } | null;

export function MapControls() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const layers = useSettings((s) => s.layers);
  const toggleLayer = useSettings((s) => s.toggleLayer);
  const region = useRegionId();
  const hiddenCount = useSettings((s) => s.hiddenLines[region]?.length ?? 0);
  const locating = useUi((s) => s.locating);
  const location = useUi((s) => s.location);
  const requestRecenter = useUi((s) => s.requestRecenter);
  const bearing = useUi((s) => s.mapBearing);
  const requestNorth = useUi((s) => s.requestNorth);
  const { i18n } = useTranslation();
  const city = useRegion();
  const { data: regions } = useRegions();
  const setRegion = useSettings((s) => s.setRegion);
  const [elsewhere, setElsewhere] = useState<Elsewhere | undefined>(undefined);
  const waitingForFix = useRef(false);
  const navigate = useNavigate();

  const showRider = (rider: LatLon) => {
    if (useUi.getState().focus.trains || !city.info || inBounds(city.info, rider, IN_CITY_MARGIN_DEG)) return requestRecenter();
    const other = regions ? regionAt(regions, rider) : undefined;
    setElsewhere(other ? { id: other.id, name: regionName(regionConfig(other.id), i18n.language) } : null);
  };

  useEffect(() => {
    if (location && waitingForFix.current) {
      waitingForFix.current = false;
      showRider(location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const switchCity = (id: string) => {
    setElsewhere(undefined);
    setRegion(id);
    
    setTimeout(requestRecenter, SWITCH_SETTLE_MS);
  };

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const layerRows: { key: keyof MapLayers; label: string }[] = [
    { key: 'buses', label: t('map.buses') },
    { key: 'rail', label: t('map.rail') },
    { key: 'stops', label: t('map.stops') },
    { key: 'places', label: t('map.places') },
    { key: 'buildings3d', label: t('map.buildings3d') },
  ];

  return (
    <div ref={root} className="relative">
      <div className="surface flex flex-col rounded-full">
        {bearing !== 0 && (
          <button type="button" aria-label={t('map.north')} title={t('map.north')} onClick={requestNorth} className={control}>
            <svg viewBox="0 0 24 24" className="size-[23px]" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden>
              <path d="M12 2.5 15.5 12h-7Z" fill="#e5484d" />
              <path d="M12 21.5 8.5 12h7Z" fill="currentColor" opacity="0.55" />
            </svg>
          </button>
        )}
        <Link to="/settings" aria-label={t('common.settings')} className={control}>
          <Settings className="size-[21px]" />
        </Link>
        <button type="button" aria-label={t('map.layers')} aria-expanded={open} onClick={() => setOpen(!open)} className={control}>
          <Layers className="size-[21px]" />
        </button>
        <button
          type="button"
          aria-label={t('map.locate')}
          className={control}
          onClick={() => {
            if (location) return showRider(location);
            waitingForFix.current = true;
            void askForLocation('locate').then((yes) => {
              if (!yes) waitingForFix.current = false;
            });
          }}
        >
          {locating ? (
            <LoaderCircle className="size-[21px] animate-spin text-primary" />
          ) : (
            <Navigation className={`size-[21px] ${location ? 'fill-primary text-primary' : ''}`} />
          )}
        </button>
      </div>
      {elsewhere !== undefined && createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-6" onClick={() => setElsewhere(undefined)}>
          <div role="dialog" aria-modal="true" className="surface-sheet w-full max-w-sm rounded-[28px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-raised text-primary">
              <MapPin className="size-6" />
            </span>
            <p className="text-[18px] leading-snug font-bold">{t('map.outsideCity', { city: city.name })}</p>
            <p className="mt-1.5 text-[15px] text-muted">{elsewhere ? t('map.switchAsk', { city: elsewhere.name }) : t('map.outsideAll')}</p>
            <div className="mt-4 flex flex-col gap-2">
              {elsewhere && (
                <button type="button" onClick={() => switchCity(elsewhere.id)} className="press primary-fill h-12 rounded-full font-semibold">
                  {t('map.switchYes', { city: elsewhere.name })}
                </button>
              )}
              {!elsewhere && (
                <button
                  type="button"
                  onClick={() => {
                    setElsewhere(undefined);
                    navigate('/regions');
                  }}
                  className="press primary-fill h-12 rounded-full font-semibold"
                >
                  {t('map.chooseCity')}
                </button>
              )}
              <button type="button" onClick={() => setElsewhere(undefined)} className="press h-12 rounded-full bg-raised font-semibold">
                {elsewhere ? t('map.switchNo', { city: city.name }) : t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {open && (
        <div className="surface-sheet absolute top-0 right-14 z-30 w-[244px] rounded-[26px] p-3.5">
          <p className="px-1 pb-1 text-[13px] font-semibold text-muted">{t('map.layers')}</p>
          {layerRows.map(({ key, label }) => (
            <Toggle key={key} label={label} checked={layers[key]} onChange={() => toggleLayer(key)} />
          ))}
          <Link
            to="/map-lines"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center justify-between gap-2 border-t border-hairline px-1 pt-3 font-medium"
          >
            <span className="min-w-0">
              {t('mapLines.title')}
              <span className="block text-[13px] font-normal text-muted">{hiddenCount ? t('mapLines.hiddenCount', { count: hiddenCount }) : t('mapLines.all')}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
          </Link>
        </div>
      )}
    </div>
  );
}
