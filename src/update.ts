import { useEffect, useState } from 'react';
import { isNativeApp, siteUrl } from '@/platform';

export interface RequiredUpdate {
  url: string;
  name: string;
}

interface VersionFile {
  android?: { latest: number; minimum: number; name: string; url: string };
}

async function check(): Promise<RequiredUpdate | null> {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.getPlatform() !== 'android') return null;

  if (import.meta.env.VITE_CHANNEL === 'play') return null;
  const { App } = await import('@capacitor/app');
  const [info, published] = await Promise.all([
    App.getInfo(),
    fetch(siteUrl(`/app-version.json?t=${Date.now()}`), { cache: 'no-store' }).then((res) => (res.ok ? (res.json() as Promise<VersionFile>) : null)),
  ]);
  const android = published?.android;

  if (!android) return null;
  return Number(info.build) < android.minimum ? { url: android.url, name: android.name } : null;
}

export function useRequiredUpdate() {
  const [update, setUpdate] = useState<RequiredUpdate | null>(null);
  useEffect(() => {
    if (!isNativeApp) return;
    const run = () => void check().then(setUpdate).catch(() => {});
    run();
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App }) =>
      App.addListener('resume', run).then((handle) => (remove = () => void handle.remove())),
    );
    return () => remove?.();
  }, []);
  return update;
}

export async function openUpdate(url: string) {
  const { AppLauncher } = await import('@capacitor/app-launcher');
  await AppLauncher.openUrl({ url }).catch(() => window.open(url, '_blank'));
}
