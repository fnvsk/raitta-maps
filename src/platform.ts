import { Capacitor } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();

export const SITE = 'https://raitta.fi';

const remote = isNativeApp || import.meta.env.MODE === 'maps';

export const dataUrl = (path: string) => (isNativeApp ? `${SITE}/app/data/${path}` : `${import.meta.env.BASE_URL}data/${path}`);

export const siteUrl = (path: string) => (remote ? `${SITE}${path}` : path);
