import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, History, Navigation } from 'lucide-react';
import { emblemOf } from '@/core/emblems';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSheetSnap } from '@/components/Panel';
import { Card, Divided, SupportButton, useModes, WhereTo } from '@/components/ui';
import { useRegion } from '@/data/hooks';
import { useDrive } from '@/state/drive';
import { useSettings } from '@/state/settings';
import { useTrip } from '@/state/trip';
import { useUi } from '@/state/ui';
import { useIsDesktop } from '@/theme';

const SHOWN_RECENT = 4;

function ModeCards() {
  const modes = useModes();
  const main = modes.filter((mode) => !mode.extra);
  const extras = modes.filter((mode) => mode.extra);
  return (
    <nav className="mb-4">
      <div className="grid grid-cols-2 gap-2.5">
        {main.map((mode) => (
          <Link
            key={mode.paths[0]}
            to={mode.to}
            aria-label={`${mode.label}: ${mode.hint}`}
            className={`press surface-card relative h-[88px] overflow-hidden rounded-[20px] bg-gradient-to-br ${mode.tint} to-transparent px-3 pt-2.5 ring-1 ring-inset ring-hairline`}
          >
            <span className="relative z-10 block truncate text-[16px] leading-tight font-bold">{mode.label}</span>
            <img
              src={mode.art}
              alt=""
              draggable={false}
              className="pointer-events-none absolute -right-1.5 -bottom-1 h-[64px] w-auto max-w-[82%] object-contain object-right-bottom"
            />
          </Link>
        ))}
      </div>
      {extras.length > 0 && (
        <div className="mt-2.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${extras.length}, minmax(0, 1fr))` }}>
          {extras.map((mode) => (
            <Link
              key={mode.paths[0]}
              to={mode.to}
              aria-label={`${mode.label}: ${mode.hint}`}
              className={`press surface-card relative flex h-[76px] flex-col items-center justify-end gap-1 overflow-hidden rounded-[18px] bg-gradient-to-b ${mode.tint} to-transparent px-1.5 pb-2 ring-1 ring-inset ring-hairline`}
            >
              <img src={mode.art} alt="" draggable={false} className="pointer-events-none h-[38px] w-auto max-w-full object-contain drop-shadow-[0_3px_5px_rgb(10_20_50/0.22)]" />
              <span className="w-full truncate text-center text-[13px] leading-tight font-bold">{mode.label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  useSheetSnap('peek');
  const desktop = useIsDesktop();
  const setFocus = useUi((s) => s.setFocus);
  const region = useRegion();
  const snap = useUi((s) => s.snap);
  const setSnap = useUi((s) => s.setSnap);
  const recent = useSettings((s) => s.recentPlaces);
  const onTrip = useTrip((s) => s.trip !== null);
  const driving = useDrive((s) => s.drive !== null);

  useEffect(() => {
    setFocus({ roadEvents: true });
    return () => setFocus({});
  }, [setFocus]);

  const plan = (place: (typeof recent)[number]) =>
    `/routes?${new URLSearchParams({ view: 'plan', toName: place.name, toLat: String(place.lat), toLon: String(place.lon) })}&start=1`;

  return (
    <>
      {(onTrip || driving) && (
        <Link to="/routes?view=plan" className="press primary-fill mb-3 flex items-center gap-2.5 rounded-full px-4 py-2.5 font-semibold">
          <Navigation className="size-[18px]" />
          <span className="flex-1">{t(driving ? 'drive.backToDrive' : 'trip.backToTrip')}</span>
          <ChevronRight className="size-5" />
        </Link>
      )}
      {desktop && (
        <div className="mb-3">
          <WhereTo />
        </div>
      )}
      <div data-sheet-drag data-sheet-fold className="flex touch-none items-center gap-2 pb-2.5">
        <Link to="/regions" aria-label={t('settings.region')} className="press flex min-w-0 flex-1 items-center gap-2.5">
          {emblemOf(region.id) && <img src={emblemOf(region.id)} alt="" className="size-11 shrink-0 object-contain drop-shadow-sm" />}
          <h2 className="min-w-0 truncate text-[22px] font-bold tracking-tight">{region.name}</h2>
          <ChevronDown className="size-5 shrink-0 text-muted" />
        </Link>
        {!desktop && (
          <button
            type="button"
            aria-label={t(snap === 'mini' ? 'home.unfold' : 'home.fold')}
            onClick={() => setSnap(snap === 'mini' ? 'peek' : 'mini')}
            className="press grid size-10 shrink-0 place-items-center rounded-full bg-raised text-muted"
          >
            {snap === 'mini' ? <ChevronsUpDown className="size-5" /> : <ChevronsDownUp className="size-5" />}
          </button>
        )}
      </div>

      <div className={`transition-opacity duration-300 ${snap === 'mini' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      <ModeCards />

      <div className="mb-4">
        <SupportButton compact />
      </div>

      {recent.length > 0 && (
        <>
          <h3 className="mt-1 mb-2 px-1 text-[15px] font-semibold text-muted">{t('plan.recent')}</h3>
          <Card>
            <Divided>
              {recent.slice(0, SHOWN_RECENT).map((place) => (
                <Link key={`${place.name}|${place.lat}|${place.lon}`} to={plan(place)} className="flex items-center gap-3 px-3 py-2.5 active:bg-raised">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-muted">
                    <History className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{place.name}</span>
                    {place.detail && <span className="block truncate text-[13px] text-muted">{place.detail}</span>}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-(--muted-icon)" />
                </Link>
              ))}
            </Divided>
          </Card>
        </>
      )}
      </div>
    </>
  );
}
