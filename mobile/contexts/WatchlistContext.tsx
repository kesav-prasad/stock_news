import React, { createContext, useContext, ReactNode } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';

type WatchlistContextType = ReturnType<typeof useWatchlist>;

const WatchlistContext = createContext<WatchlistContextType | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const watchlist = useWatchlist();
  return (
    <WatchlistContext.Provider value={watchlist}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useSharedWatchlist(): WatchlistContextType {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useSharedWatchlist must be used within a WatchlistProvider');
  }
  return context;
}
