'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'stocknews-watchlist';

/**
 * Custom hook for managing a watchlist persisted in localStorage.
 * SSR-safe — reads from storage only after mount.
 */
export function useWatchlist() {
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setWatchlistIds(new Set(parsed));
        }
      }
    } catch {
      // Corrupted data — start fresh
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever watchlistIds changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...watchlistIds]));
    } catch {
      // Storage full or unavailable — fail silently
    }
  }, [watchlistIds, hydrated]);

  // Listen for changes from other tabs
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setWatchlistIds(new Set(parsed));
          }
        } catch {
          // Ignore invalid data
        }
      }
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleWatchlist = useCallback((companyId: string) => {
    setWatchlistIds((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  }, []);

  const isInWatchlist = useCallback(
    (companyId: string) => watchlistIds.has(companyId),
    [watchlistIds]
  );

  const watchlistCount = useMemo(() => watchlistIds.size, [watchlistIds]);

  const clearWatchlist = useCallback(() => {
    setWatchlistIds(new Set());
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
