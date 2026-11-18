import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raitta.fi',
  appName: 'RAITTA',

  webDir: 'dist-native',
  backgroundColor: '#155EEF',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      initialViewportFitValueHint: 'contain',
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#155EEF',
      showSpinner: false,
    },
  },
};

export default config;
