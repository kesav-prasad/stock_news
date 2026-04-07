'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

export function useWatchlist() {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const { data: watchlistData, isSuccess } = useQuery({
    queryKey: ['watchlist', isSignedIn],
    queryFn: async () => {
      if (!isSignedIn) return { watchlistIds: [] };
      const token = await getToken();
      if (!token) return { watchlistIds: [] };

      const res = await fetch(`${baseUrl}/api/watchlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      return res.json();
    },
    enabled: true,
  });

  const watchlistIds = useMemo(() => {
    return new Set<string>(watchlistData?.watchlistIds || []);
  }, [watchlistData]);

  const toggleMutation = useMutation({
    mutationFn: async (companyId: string) => {
      if (!isSignedIn) return;
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/watchlist/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ companyId })
      });
      if (!res.ok) throw new Error('Failed to toggle watchlist');
    },
    onMutate: async (companyId: string) => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] });
      const previous = queryClient.getQueryData(['watchlist', isSignedIn]);

      queryClient.setQueryData(['watchlist', isSignedIn], (old: any) => {
        if (!old) return { watchlistIds: [companyId] };
        const ids = new Set(old.watchlistIds);
        if (ids.has(companyId)) {
          ids.delete(companyId);
        } else {
          ids.add(companyId);
        }
        return { watchlistIds: Array.from(ids) };
      });

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['watchlist', isSignedIn], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const toggleWatchlist = useCallback((companyId: string) => {
    if (!isSignedIn) {
      alert("Please sign in to add companies to your watchlist.");
      return;
    }
    toggleMutation.mutate(companyId);
  }, [isSignedIn, toggleMutation]);

  const isInWatchlist = useCallback(
    (companyId: string) => watchlistIds.has(companyId),
    [watchlistIds]
  );

  const watchlistCount = useMemo(() => watchlistIds.size, [watchlistIds]);

  const clearWatchlist = useCallback(() => {
    console.warn("Clear watchlist is not supported via cloud sync yet.");
  }, []);

  return {
    watchlistIds,
    toggleWatchlist,
    isInWatchlist,
    watchlistCount,
    clearWatchlist,
    hydrated: isSuccess || !isSignedIn,
  };
}
