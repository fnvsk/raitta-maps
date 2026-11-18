export interface TicketApp {
  name: string;
  appStoreId: number;
  androidPackage: string;
  web: string;

  androidLink?: string;
}

const WALTTI_LINKS = 'kauppa.waltti.fi';

const APPS = {
  hsl: {
    name: 'HSL',
    appStoreId: 1340229182,
    androidPackage: 'fi.hsl.app',
    web: 'https://www.hsl.fi/en/tickets-and-fares/hsl-app',
  },
  nysse: {
    name: 'Nysse Mobiili',
    androidLink: `${WALTTI_LINKS}/nysseapp/`,
    appStoreId: 1447099214,
    androidPackage: 'nysse.fi.mobiili',
    web: 'https://www.nysse.fi/en/tickets-and-fares.html',
  },
  foli: {
    name: 'Föli',
    appStoreId: 853235899,
    androidPackage: 'net.iqpai.turunjoukkoliikenne',
    web: 'https://www.foli.fi/en/tickets',
  },
  osl: {
    name: 'OSL',
    androidLink: `${WALTTI_LINKS}/oslapp/`,
    appStoreId: 6450253928,
    androidPackage: 'osl.fi.mobiili',
    web: 'https://apps.apple.com/fi/app/id6450253928',
  },
  vilkku: {
    name: 'Vilkku',
    appStoreId: 6753071019,
    androidPackage: 'fi.vilkku.mobiili',
    web: 'https://apps.apple.com/fi/app/id6753071019',
  },
  waltti: {
    name: 'Waltti Mobile',
    androidLink: `${WALTTI_LINKS}/walttiapp/`,
    appStoreId: 1467878273,
    androidPackage: 'waltti.com.mobiili',
    web: 'https://apps.apple.com/fi/app/id1467878273',
  },
} satisfies Record<string, TicketApp>;

const BY_REGION: Record<string, TicketApp> = {
  helsinki: APPS.hsl,
  tampere: APPS.nysse,
  turku: APPS.foli,
  oulu: APPS.osl,
  kuopio: APPS.vilkku,
};

export const ticketAppFor = (regionId: string): TicketApp => BY_REGION[regionId] ?? APPS.waltti;

export const TRAIN_TICKETS: TicketApp = {
  name: 'VR Matkalla',
  appStoreId: 1410647394,
  androidPackage: 'fi.vr.mobile.app',
  web: 'https://www.vr.fi/en',
};

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/Android/i.test(userAgent)) return 'android';

  if (/iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  return 'other';
}

export function ticketStoreUrl(app: TicketApp, platform: Platform): string {
  if (platform === 'ios') return `https://apps.apple.com/fi/app/id${app.appStoreId}`;
  if (platform === 'android') return `https://play.google.com/store/apps/details?id=${app.androidPackage}`;
  return app.web;
}

export async function openTicketAppNatively(app: TicketApp): Promise<void> {
  const { AppLauncher } = await import('@capacitor/app-launcher');
  const { completed } = await AppLauncher.openUrl({ url: app.androidPackage }).catch(() => ({ completed: false }));
  if (!completed) await AppLauncher.openUrl({ url: ticketStoreUrl(app, 'android') });
}

export function ticketUrl(app: TicketApp, platform: Platform): string {
  if (platform === 'ios') return `itms-apps://apps.apple.com/app/id${app.appStoreId}`;
  if (platform === 'android' && app.androidLink) {
    const store = encodeURIComponent(ticketStoreUrl(app, platform));
    return `intent://${app.androidLink}#Intent;scheme=https;package=${app.androidPackage};S.browser_fallback_url=${store};end`;
  }
  return ticketStoreUrl(app, platform);
}
