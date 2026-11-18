import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeApp } from './platform';

export function initNativeApp() {
  if (!isNativeApp) return;

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });

  void StatusBar.setStyle({ style: Style.Default }).catch(() => {});
}
