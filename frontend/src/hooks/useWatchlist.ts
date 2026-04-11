'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getLocalWatchlist, setLocalWatchlist, isOnline, resilientFetch } from '@/lib/offlineCache';

/**
 * Offline-first watchlist hook.
 * 
 * - Watchlist is stored LOCALLY first (instant, works offline)
 * - Syncs with server when online
 * - No loading states, no errors — always works
 */
export function useWatchlist() {
  const { getToken, isSignedIn } = useAuth();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';

  // Local-first state
  const [localIds, setLocalIds] = useState<string[]>(() => getLocalWatchlist());
  const [hydrated, setHydrated] = useState(false);

  // On mount + sign in: try to sync from server
  useEffect(() => {
    setHydrated(true);

    async function syncFromServer() {
      if (!isSignedIn || !isOnline()) return;

      try {
        const token = await getToken();
        if (!token) return;

        const res = await resilientFetch(`${baseUrl}/api/watchlist`, {
          timeoutMs: 10000,
          retries: 1,
        });
        // We need to pass headers, so use regular fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(`${baseUrl}/api/watchlist`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.watchlistIds) {
            // Merge: keep local additions, add server items
            const merged = [...new Set([...localIds, ...data.watchlistIds])];
            setLocalIds(merged);
            setLocalWatchlist(merged);
          }
        }
      } catch {
        // Silently ignore — local watchlist works fine
      }
    }

    syncFromServer();
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchlistIds = useMemo(() => new Set<string>(localIds), [localIds]);

  const toggleWatchlist = useCallback((companyId: string) => {
    setLocalIds(prev => {
      const newIds = prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId];
      setLocalWatchlist(newIds);

      // Try to sync with server in background (fire-and-forget)
      if (isSignedIn && isOnline()) {
        (async () => {
          try {
            const token = await getToken();
            if (!token) return;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            await fetch(`${baseUrl}/api/watchlist/toggle`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ companyId }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch {
            // Server sync failed — that's fine, local state is source of truth
          }
        })();
      }

      return newIds;
    });
  }, [isSignedIn, getToken, baseUrl]);

  const isInWatchlist = useCallback(
    (companyId: string) => watchlistIds.has(companyId),
    [watchlistIds]
  );

  const watchlistCount = useMemo(() => watchlistIds.size, [watchlistIds]);

  const clearWatchlist = useCallback(() => {
    setLocalIds([]);
    setLocalWatchlist([]);
  }, []);

  return {
    watchlistIds,
    toggleWatchlist,
    isInWatchlist,
    watchlistCount,
    clearWatchlist,
    hydrated,
  };
}
