import { useEffect, useSyncExternalStore } from 'react';
import { useSettings } from '@/state/settings';

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useSettings((s) => s.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}

export function useApplyTheme() {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#101827' : '#F5F7FB');
  }, [resolved]);
}
