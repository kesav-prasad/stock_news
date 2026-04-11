import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stocknews.app',
  appName: 'StockNews',
  webDir: 'out',
  android: {
    allowMixedContent: true,
  },
  server: {
    // Allow loading external resources (API calls, Clerk auth, etc.)
    androidScheme: 'https',
  },
};

export default config;

