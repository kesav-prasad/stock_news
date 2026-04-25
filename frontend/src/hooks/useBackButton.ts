'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

/**
 * ★ Android Hardware Back Button Handler
 * 
 * Navigation stack priority (each press goes one level up):
 * 1. If in-app browser is open → close it
 * 2. If a company modal is open → close it
 * 3. If on a secondary tab → go back to Dashboard
 * 4. If already on Dashboard → exit app
 */
export function useBackButton(
  selectedCompany: any | null,
  onCloseModal: () => void,
  activeTab: string,
  onTabChange: (tab: string) => void,
) {
  const companyRef = useRef(selectedCompany);
  const tabRef = useRef(activeTab);

  // Keep refs updated so listeners see latest state
  useEffect(() => {
    companyRef.current = selectedCompany;
  }, [selectedCompany]);

  useEffect(() => {
    tabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any;

    (async () => {
      try {
        listener = await App.addListener('backButton', ({ canGoBack }) => {
          // Priority 1: Close the in-app browser if it's open
          // The Capacitor Browser plugin auto-closes on back press on Android,
          // so we just need to handle app-level navigation.

          // Priority 2: Close company modal
          if (companyRef.current) {
            onCloseModal();
            return;
          }

          // Priority 3: Return to Dashboard from other tabs
          if (tabRef.current !== 'all') {
            onTabChange('all');
            return;
          }

          // Priority 4: Exit app (double-back or single back from home)
          App.exitApp();
        });
      } catch (e) {
        console.log('[BackButton] Not running in Capacitor:', e);
      }
    })();

    return () => {
      if (listener && listener.remove) {
        listener.remove().catch(() => {});
      }
    };
  }, [onCloseModal, onTabChange]);
}
