import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './i18n';
import './index.css';
import { captureInstallPrompt, fitInstalledIphone } from './pwa';
import { initNativeApp } from './native';
import { isNativeApp } from './platform';
import { initTelegram } from './telegram';

captureInstallPrompt();
fitInstalledIphone();
initTelegram();
initNativeApp();

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true } },
});

const LAUNCH_MS = 1500;

const R_DRAWN_MS = 1100;
const launched = isNativeApp || matchMedia('(display-mode: standalone)').matches || window.location.hash.includes('tgWebApp');

function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.style.opacity = '0';
  window.setTimeout(() => boot.remove(), 300);
}

function start() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
  if (!launched) return hideBoot();

  requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(hideBoot, Math.max(0, LAUNCH_MS - performance.now()))));
}

if (launched) window.setTimeout(start, Math.max(0, R_DRAWN_MS - performance.now()));
else start();
