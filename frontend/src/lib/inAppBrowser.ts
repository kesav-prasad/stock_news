/**
 * In-App Browser utility for StockNews.
 * 
 * On Android (Capacitor): Opens URLs in a native in-app browser overlay.
 * On Web: Falls back to window.open (new tab).
 * 
 * Benefits for forest areas:
 * - No app context switch (stays in StockNews)
 * - Instant return to app (just close the overlay)
 * - Native Chrome Custom Tab — fast, familiar, secure
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Opens a URL inside the app (in-app browser on Android, new tab on web).
 */
export async function openInAppBrowser(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Native: Use Chrome Custom Tab overlay — stays inside the app
    try {
      await Browser.open({
        url,
        presentationStyle: 'popover',
        toolbarColor: '#030712', // Match dark theme (gray-950)
        windowName: '_blank',
      });
    } catch (err) {
      console.warn('[StockNews] In-app browser failed, falling back:', err);
      window.open(url, '_blank', 'noopener');
    }
  } else {
    // Web: Open in new tab
    window.open(url, '_blank', 'noopener');
  }
}

/**
 * Check if in-app browser is available (running in Capacitor).
 */
export function isInAppBrowserAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
