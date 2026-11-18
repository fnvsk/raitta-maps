export interface TelegramLocationManager {
  isLocationAvailable: boolean;
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  openSettings: () => void;
  init: (callback?: () => void) => void;
  getLocation: (callback: (location: { latitude: number; longitude: number } | null) => void) => void;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  LocationManager?: TelegramLocationManager;
}

const LOCATION_INIT_TIMEOUT_MS = 2500;
let locationManager: Promise<TelegramLocationManager | undefined> | null = null;

let loaded: (app: TelegramWebApp | undefined) => void = () => {};
const telegramApp = new Promise<TelegramWebApp | undefined>((resolve) => (loaded = resolve));

export function telegramLocationManager(): Promise<TelegramLocationManager | undefined> {
  if (!insideTelegram) return Promise.resolve(undefined);
  locationManager ??= (async () => {
    const app = await telegramApp;
    const manager = app?.LocationManager;
    if (!manager || !app?.isVersionAtLeast?.('8.0')) return undefined;
    const ready = await Promise.race([
      new Promise<boolean>((resolve) => manager.init(() => resolve(true))),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), LOCATION_INIT_TIMEOUT_MS)),
    ]);
    return ready && manager.isLocationAvailable ? manager : undefined;
  })();
  return locationManager;
}

let insideTelegram = false;

export const isTelegram = () => insideTelegram;

export function initTelegram() {
  if (!window.location.hash.includes('tgWebApp')) return;
  insideTelegram = true;
  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-web-app.js';
  script.onload = () => {
    const app = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    app?.ready();
    app?.expand();

    app?.disableVerticalSwipes?.();
    loaded(app);
  };
  script.onerror = () => loaded(undefined);
  document.head.append(script);
}
