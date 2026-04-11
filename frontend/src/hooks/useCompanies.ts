'use client';

import { useState, useEffect, useMemo } from 'react';
import embeddedCompanies from '@/data/companies.json';
import {
  getCachedCompanies,
  setCachedCompanies,
  isCompanyCacheStale,
  resilientFetch,
  isOnline,
} from '@/lib/offlineCache';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

/**
 * Offline-first company data hook.
 * 
 * Priority order:
 * 1. EMBEDDED data (instant, 0ms, always available, baked into APK)
 * 2. localStorage cache (for any server-fetched updates)
 * 3. Background API fetch (silent refresh when online)
 * 
 * This NEVER shows a loading spinner or error for companies.
 */
export function useCompanies() {
  // Start with embedded data IMMEDIATELY (no loading state ever!)
  const [companies, setCompanies] = useState<Company[]>(() => {
    // Try cached version first (might have fresher data from a previous online session)
    const cached = getCachedCompanies();
    if (cached && cached.length > 0) return cached;
    // Fall back to embedded data (always available, baked into APK at build time)
    return embeddedCompanies as Company[];
  });

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Background refresh — silently update if online and cache is stale
  useEffect(() => {
    let cancelled = false;

    async function refreshFromServer() {
      if (!isOnline()) return;
      if (!isCompanyCacheStale()) return;

      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
        const res = await resilientFetch(`${baseUrl}/api/companies?limit=5000`, {
          timeoutMs: 30000, // 30s timeout for slow connections
          retries: 2,
        });
        const data = await res.json();
        if (data.companies && data.companies.length > 0 && !cancelled) {
          const freshCompanies = data.companies.map((c: any) => ({
            id: c.id,
            symbol: c.symbol,
            name: c.name,
            exchange: c.exchange,
            sector: c.sector || undefined,
          }));
          setCompanies(freshCompanies);
          setCachedCompanies(freshCompanies);
          setLastRefresh(new Date());
        }
      } catch {
        // Silently ignore — we already have embedded data showing
        console.log('[StockNews] Background refresh failed, using cached/embedded data');
      }
    }

    refreshFromServer();

    // Also refresh when the app comes back online
    function handleOnline() {
      refreshFromServer();
    }
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const total = companies.length;

  return { companies, total, lastRefresh };
}
