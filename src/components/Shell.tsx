import { Heart, Map as MapIcon, Route, SignpostBig, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useForgetOldCities, useLines, usePrefetchTrains, useRegion, useStops, useVehicles } from '@/data/hooks';
import { useRegionFollowsRider } from '@/map/location';
import { MapView } from '@/map/MapView';
import { TrainSearch } from '@/pages/TrainsPage';
import { useDrive } from '@/state/drive';
import { useUi } from '@/state/ui';
import { useIsDesktop } from '@/theme';
import { LoadingMark, LogoTile } from './Logo';
import { MapControls } from './MapControls';
import { LocationAsk } from './LocationAsk';
import { MapPressMenu } from './MapPressMenu';
import { BottomSheet } from './Panel';
import { useOnline, WhereTo } from './ui';

const TAB_PATHS = ['/', '/stops', '/routes', '/favorites'];

const MODE_PATHS = ['/transport', '/fuel', '/charging', '/trains'];

function useTabs() {
  const { t } = useTranslation();
  return [
    { to: '/', icon: MapIcon, label: t('tabs.map') },
    { to: '/stops', icon: SignpostBig, label: t('tabs.stops') },
    { to: '/routes', icon: Route, label: t('tabs.routes') },
    { to: '/favorites', icon: Heart, label: t('tabs.favorites') },
  ];
}

function TabBar() {
  const tabs = useTabs();
  const { pathname } = useLocation();
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-card"
      style={{ height: 'var(--tabbar-height)', paddingBottom: 'var(--safe-bottom)' }}
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive || (to === '/' && MODE_PATHS.includes(pathname)) ? 'text-primary' : 'text-muted'
            }`
          }
        >
          <Icon className="size-[23px]" />
          <span className="max-w-full truncate px-1">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function DesktopNav({ pathname }: { pathname: string }) {
  const tabs = useTabs();
  const active = Math.max(0, TAB_PATHS.indexOf(pathname));
  return (
    <nav className="relative flex rounded-full bg-raised p-1">
      {TAB_PATHS.includes(pathname) && (
        <span
          aria-hidden
          className="selected-pill absolute top-1 bottom-1 left-1 rounded-full"
          style={{ width: `calc((100% - 8px) / ${tabs.length})`, transform: `translateX(${active * 100}%)` }}
        />
      )}
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          aria-label={label}
          title={label}
          className={({ isActive }) =>
            `relative flex flex-1 items-center justify-center rounded-full py-2 ${isActive ? 'text-primary' : 'text-muted hover:text-ink'}`
          }
        >
          <Icon className="size-[19px]" />
        </NavLink>
      ))}
    </nav>
  );
}

function StatusPill() {
  const { t } = useTranslation();
  const online = useOnline();
  const vehicles = useVehicles();
  const lines = useLines();

  let message: ReactNode = null;
  if (lines.isError) message = t('status.dataFailed');
  else if (!online) message = t('status.offline');
  else if (vehicles.isError) message = t('status.liveDown');
  if (!message) return null;

  return (
    <div role="status" className="surface flex items-start gap-2 rounded-[20px] px-3.5 py-2.5 text-[13px]">
      {online ? <TriangleAlert className="mt-px size-4 shrink-0 text-warning" /> : <LoadingMark className="size-5 shrink-0" color="var(--color-warning, #f59e0b)" />}
      <span>{message}</span>
    </div>
  );
}

function CityLoading({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation();
  const city = useRegion();
  const stops = useStops();
  const lines = useLines();
  const sheetInset = useUi((s) => s.sheetInset);
  if ((stops.data && lines.data) || stops.isError || lines.isError) return null;
  return (
    <div
      role="status"
      className="city-loading absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 bg-bg"
      style={desktop ? { paddingLeft: 432 } : { paddingBottom: sheetInset }}
    >
      <LoadingMark className="size-16 text-primary" />
      <p className="px-8 text-center text-[16px] font-semibold text-muted">{t('map.loadingCity', { city: city.name })}</p>
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const desktop = useIsDesktop();
  const snap = useUi((s) => s.snap);
  useRegionFollowsRider();
  useForgetOldCities();
  usePrefetchTrains();
  const driving = useDrive((s) => s.drive !== null);
  const isTab = TAB_PATHS.includes(location.pathname) || MODE_PATHS.includes(location.pathname);
  const isHome = location.pathname === '/' || location.pathname === '/transport';
  
  const withTabBar = isTab && !(snap === 'mini' && location.pathname === '/routes') && !driving;
  const mapVisible = desktop || snap !== 'full';

  return (
    <div className="app-shell fixed inset-0 overflow-hidden">
      <MapView />
      <MapPressMenu />
      <LocationAsk />
      <CityLoading desktop={desktop} />

      {desktop ? (
        <>
          <aside className="surface-sheet absolute top-4 bottom-4 left-4 z-20 flex w-[400px] flex-col overflow-hidden rounded-panel">
            <header className="flex shrink-0 items-center gap-3 p-4 pb-2">
              <LogoTile className="size-9" />
              <span className="text-[19px] font-bold tracking-[0.06em]">RAITTA</span>
            </header>
            <div className="shrink-0 px-4 pb-3">
              <DesktopNav pathname={location.pathname} />
            </div>
            <div key={location.pathname} className="scroll-area page-enter min-h-0 flex-1 px-4 pb-6">
              <Outlet />
            </div>
          </aside>
          <div className="absolute top-4 right-4 z-10">
            <MapControls />
          </div>
          <div className="absolute bottom-4 left-1/2 z-10 max-w-sm -translate-x-1/2">
            <StatusPill />
          </div>
        </>
      ) : (
        <>
          {mapVisible && !driving && (
            <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10">
              <div className="space-y-2 px-3 pt-2.5">
                {isHome && (
                  <div className="pointer-events-auto">
                    <WhereTo />
                  </div>
                )}
                {location.pathname === '/trains' && (
                  <div className="pointer-events-auto">
                    <TrainSearch />
                  </div>
                )}
                <div className={`flex items-start justify-end gap-3 ${isHome || location.pathname === '/trains' ? '' : 'pt-1'}`}>
                  <div className="min-w-0 flex-1">
                    <StatusPill />
                  </div>
                  <div className="pointer-events-auto">
                    <MapControls />
                  </div>
                </div>
              </div>
            </div>
          )}
          <BottomSheet withTabBar={withTabBar} routeKey={location.pathname} driving={driving}>
            <Outlet />
          </BottomSheet>
          {withTabBar && <TabBar />}
        </>
      )}
    </div>
  );
}
