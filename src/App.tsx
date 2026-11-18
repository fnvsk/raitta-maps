import { LoadingMark } from '@/components/Logo';
import { openUpdate, useRequiredUpdate, type RequiredUpdate } from '@/update';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { DEFAULT_LANGUAGE } from '@/i18n';
import { useResumeLocation } from '@/map/location';
import { AirportPage } from '@/pages/AirportPage';
import { SchemePage } from '@/pages/SchemePage';
import { SchemeSite } from '@/pages/SchemeSite';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { ChargerPage, ChargingPage } from '@/pages/ChargingPage';
import { FuelPage } from '@/pages/FuelPage';
import { FuelStationPage } from '@/pages/FuelStationPage';
import { LineDetail } from '@/pages/LineDetail';
import { HomePage } from '@/pages/HomePage';
import { MapHome } from '@/pages/MapHome';
import { MapLinesPage } from '@/pages/MapLinesPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { RegionsPage } from '@/pages/RegionsPage';
import { RoadEventPage } from '@/pages/RoadEventPage';
import { PlacePage } from '@/pages/PlacePage';
import { RoutesPage } from '@/pages/RoutesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { StopDetail } from '@/pages/StopDetail';
import { StopsPage } from '@/pages/StopsPage';
import { VehicleDetail } from '@/pages/VehicleDetail';
import { StationDetail, TrainDetail, TrainsLayout, TrainsPage } from '@/pages/TrainsPage';
import { Welcome } from '@/pages/Welcome';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';
import { useApplyTheme } from '@/theme';

function useApplyLanguage() {
  const { i18n } = useTranslation();
  const chosen = useSettings((s) => s.language);
  const language = chosen ?? DEFAULT_LANGUAGE;
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);
}

function UpdateScreen({ update }: { update: RequiredUpdate }) {
  const { t } = useTranslation();
  return (
    <div className="safe-top fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-primary-strong px-8 text-center text-white">
      <LoadingMark className="size-24" color="#fff" />
      <h1 className="text-[26px] leading-tight font-bold">{t('update.title')}</h1>
      <p className="max-w-80 text-[16px] text-white/85">{t('update.text')}</p>
      <button type="button" onClick={() => void openUpdate(update.url)} className="press mt-2 rounded-full bg-white px-8 py-3.5 text-[17px] font-semibold text-primary-strong">
        {t('update.button')}
      </button>
      <p className="text-[13px] text-white/70">{t('update.version', { name: update.name })}</p>
    </div>
  );
}

export function App() {
  useApplyTheme();
  useApplyLanguage();
  useResumeLocation();
  const onboarded = useSettings((s) => s.onboarded);

  const cityChosen = useUi((s) => s.cityChosen);
  const update = useRequiredUpdate();
  const { pathname } = useLocation();

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel=canonical]');
    if (link) link.href = `https://maps.raitta.fi${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;
  }, [pathname]);

  if (pathname.startsWith('/schemes')) {
    return (
      <Routes>
        <Route path="schemes/:region/:kind" element={<SchemeSite />} />
        <Route path="*" element={<Navigate to="/schemes/helsinki/metro" replace />} />
      </Routes>
    );
  }

  return (
    <>
      {(onboarded || cityChosen) && (
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="transport" element={<MapHome />} />
            <Route path="stops" element={<StopsPage />} />
            <Route path="stops/:id" element={<StopDetail />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="routes/:id" element={<LineDetail />} />
            <Route path="vehicle/:ref" element={<VehicleDetail />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="map-lines" element={<MapLinesPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="regions" element={<RegionsPage />} />
            <Route path="fuel" element={<FuelPage />} />
            <Route path="trains" element={<TrainsLayout />}>
              <Route index element={<TrainsPage />} />
              <Route path="station/:code" element={<StationDetail />} />
              <Route path=":date/:number" element={<TrainDetail />} />
            </Route>
            <Route path="fuel/:id" element={<FuelStationPage />} />
            <Route path="charging" element={<ChargingPage />} />
            <Route path="charging/:id" element={<ChargerPage />} />
            <Route path="road/:id" element={<RoadEventPage />} />
            <Route path="place/:source/:id" element={<PlacePage />} />
            <Route path="airport/:iata" element={<AirportPage />} />
            <Route path="scheme/:kind" element={<SchemePage />} />
            <Route path="place/:source/:type/:id" element={<PlacePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      {!onboarded && <Welcome />}
      {update && <UpdateScreen update={update} />}
    </>
  );
}
