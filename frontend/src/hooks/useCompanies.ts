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
 * ★ PERFORMANCE-OPTIMIZED: Offline-first company data hook.
 * 
 * Previous behavior: 400ms artificial delay → skeleton → data
 * New behavior: INSTANT data from cache/embedded → paint in <50ms
 * 
 * Priority order:
 * 1. localStorage cache (fast, from previous server fetches)
 * 2. EMBEDDED data (baked into build, always available)
 * 3. Background API fetch (silent refresh when online & stale)
 */
export function useCompanies() {
  // ★ INSTANT LOAD: Initialize with data immediately — NO loading state
  const [companies, setCompanies] = useState<Company[]>(() => {
    // Try cache first (may have fresher data from last server fetch)
    if (typeof window !== 'undefined') {
      const cached = getCachedCompanies();
      if (cached && cached.length > 0) return cached;
    }
    // Fall back to embedded data (always available, zero network)
    return embeddedCompanies as Company[];
  });

  // ★ NO loading state — data is available synchronously from initialization
  const [isLoading] = useState(false);
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

  const total = companies.length || (embeddedCompanies as Company[]).length;

  return { companies, total, lastRefresh, isLoading };
}
