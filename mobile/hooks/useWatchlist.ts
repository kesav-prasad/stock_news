import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stocknews-watchlist';

/**
 * Custom hook for managing a watchlist persisted in AsyncStorage.
 * Compatible with React Native (uses AsyncStorage instead of localStorage).
 */
export function useWatchlist() {
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setWatchlistIds(new Set(parsed));
          }
        }
      } catch {
        // Corrupted data or storage error — start fresh
      }
      setHydrated(true);
    })();
  }, []);

  // Persist to AsyncStorage whenever watchlistIds changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...watchlistIds]));
      } catch {
        // Storage full or unavailable — fail silently
      }
    })();
  }, [watchlistIds, hydrated]);

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
