import { useEffect, useMemo } from 'react';
import { inBounds, regionAt } from '@/core/regions';
import type { LatLon } from '@/core/types';
import { useRegion, useRegions } from '@/data/hooks';
import { useSettings } from '@/state/settings';
import { telegramLocationManager, type TelegramLocationManager } from '@/telegram';
import { isNativeApp } from '@/platform';
import { useUi } from '@/state/ui';

const REGION_MARGIN_DEG = 0.15;

const TELEGRAM_POLL_MS = 15_000;

let watching = false;

function located(lat: number, lon: number) {
  const state = useUi.getState();
  state.setLocation({ lat, lon });
  state.setLocating(false);
  if (!useSettings.getState().locationAllowed) useSettings.getState().setLocationAllowed(true);
}

function refused(denied: boolean) {
  watching = false;
  useUi.getState().setLocationError(denied ? 'denied' : 'unavailable');
  if (denied) useSettings.getState().setLocationAllowed(false);
}

let browserWatch: number | null = null;
let nativeWatch: string | null = null;
let telegramTimer: ReturnType<typeof setInterval> | null = null;

function watchBrowserLocation() {
  if (!('geolocation' in navigator)) return refused(false);
  browserWatch = navigator.geolocation.watchPosition(
    ({ coords }) => located(coords.latitude, coords.longitude),
    (error) => refused(error.code === error.PERMISSION_DENIED),
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
  );
}

async function watchTelegramLocation(manager: TelegramLocationManager) {
  if (manager.isAccessRequested && !manager.isAccessGranted) {
    manager.openSettings();
    return refused(true);
  }
  const read = () =>
    manager.getLocation((location) => {
      if (location) located(location.latitude, location.longitude);
      else if (!manager.isAccessGranted) refused(true);
    });
  read();
  telegramTimer = setInterval(() => {
    if (watching && !document.hidden) read();
  }, TELEGRAM_POLL_MS);
}

async function watchNativeLocation() {
  const { Geolocation } = await import('@capacitor/geolocation');
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location !== 'granted' && (await Geolocation.requestPermissions()).location !== 'granted') return refused(true);
    nativeWatch = await Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }, (position, error) => {
      if (position) located(position.coords.latitude, position.coords.longitude);
      
      else if (error && !/time/i.test(error.message ?? '')) refused(false);
    });
  } catch {
    refused(false);
  }
}

export function stopLocating() {
  watching = false;
  if (browserWatch !== null) navigator.geolocation.clearWatch(browserWatch);
  if (telegramTimer) clearInterval(telegramTimer);
  if (nativeWatch !== null) void import('@capacitor/geolocation').then(({ Geolocation }) => Geolocation.clearWatch({ id: nativeWatch! }));
  browserWatch = nativeWatch = telegramTimer = null;
  useUi.getState().setLocation(null);
  useUi.getState().setLocating(false);
}

export function startLocating(asked = false) {
  if (useSettings.getState().noLocation) {
    if (!asked) return;
    useSettings.getState().setNoLocation(false);
  }
  if (watching) return;
  watching = true;
  useUi.getState().setLocating(true);
  if (isNativeApp) {
    void watchNativeLocation();
    return;
  }
  void telegramLocationManager().then((manager) => (manager ? watchTelegramLocation(manager) : watchBrowserLocation()));
}

export function useResumeLocation() {
  useEffect(() => {
    void (async () => {
      if (isNativeApp) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const status = await Geolocation.checkPermissions().catch(() => null);
        if (status?.location === 'granted') startLocating();
        return;
      }
      const manager = await telegramLocationManager();
      if (manager) {
        if (manager.isAccessGranted) startLocating();
        return;
      }
      
      const granted = await navigator.permissions
        ?.query({ name: 'geolocation' })
        .then((status) => status.state === 'granted')
        .catch(() => false);
      if (granted || useSettings.getState().locationAllowed) startLocating();
    })();
  }, []);
}

export function useRegionFollowsRider() {
  const hasFix = useUi((s) => s.location !== null);
  const { data: regions } = useRegions();
  useEffect(() => {
    const { location, requestRecenter } = useUi.getState();
    if (!hasFix || !location || !regions) return;
    
    if (regionAt(regions, location)?.id === useSettings.getState().region) requestRecenter();
  }, [hasFix, regions]);
}

export interface ReferencePoint {
  point: LatLon;
  
  isRider: boolean;
  
  isFar: boolean;
}

export function useReferencePoint(): ReferencePoint {
  const location = useUi((s) => s.location);
  const region = useRegion();
  return useMemo(() => {
    const inside = !!location && !!region.info && inBounds(region.info, location, REGION_MARGIN_DEG);
    if (location && inside) return { point: location, isRider: true, isFar: false };
    return { point: region.center, isRider: false, isFar: !!location && !!region.info };
  }, [location, region]);
}
