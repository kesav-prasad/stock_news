import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stocknews.app',
  appName: 'StockNews',
  webDir: 'out',
  android: {
    allowMixedContent: true,
    backgroundColor: '#030712', // gray-950
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#030712',
      showSpinner: false,
    },
  },
};

export default config;
