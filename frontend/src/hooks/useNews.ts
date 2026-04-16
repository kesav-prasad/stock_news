'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCachedNews,
  setCachedNews,
  isNewsCacheStale,
  resilientFetch,
  isOnline,
} from '@/lib/offlineCache';

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

/**
 * ★ PERFORMANCE-OPTIMIZED: Offline-first news hook.
 * 
 * Key improvements:
 * - Shows cached news INSTANTLY (no loading spinner if cache exists)
 * - Reduced timeouts for faster failure detection (15s vs 25s)
 * - Single retry instead of 2 to reduce wait time
 * - Deduplication: won't refetch if already fetching for same company
 */
export function useNews(companyId: string | null) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchingRef = useRef<string | null>(null);

  const fetchNews = useCallback(async (id: string, force = false) => {
    // ★ Prevent duplicate fetches for the same company
    if (fetchingRef.current === id && !force) return;
    fetchingRef.current = id;

    // 1. Try cache first (instant)
    const cached = getCachedNews(id);
    if (cached && cached.length > 0) {
      setNews(cached);
      setHasCachedData(true);
      setIsLoading(false);

      // If cache is fresh enough and not forced, skip network
      if (!force && !isNewsCacheStale(id)) {
        fetchingRef.current = null;
        return;
      }
    }

    // 2. Try fetching from server
    if (!isOnline()) {
      setIsOffline(true);
      if (!cached || cached.length === 0) {
        setIsLoading(false);
      }
      fetchingRef.current = null;
      return;
    }

    // Only show loading spinner if we have NO cached data
    if (!cached || cached.length === 0) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
      const res = await resilientFetch(`${baseUrl}/api/companies/${id}/news`, {
        timeoutMs: 15000,  // ★ Reduced from 25s → 15s for faster response
        retries: 1,        // ★ Reduced from 2 → 1 for faster failure
        retryDelayMs: 2000,
      });
      const freshNews = await res.json();
      if (Array.isArray(freshNews) && freshNews.length > 0) {
        setNews(freshNews);
        setCachedNews(id, freshNews);
        setHasCachedData(true);
      }
      setIsOffline(false);
    } catch {
      // If we already have cached data, just continue showing it
      if (cached && cached.length > 0) {
        console.log('[StockNews] News refresh failed, showing cached data');
      } else {
        // Mark as offline so the UI can show a helpful message
        setIsOffline(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      fetchingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!companyId) {
      setNews([]);
      setIsLoading(false);
      setIsOffline(false);
      setHasCachedData(false);
      return;
    }

    fetchNews(companyId);
  }, [companyId, fetchNews]);

  const retry = useCallback(() => {
    if (companyId) {
      setIsOffline(false);
      fetchNews(companyId, true);
    }
  }, [companyId, fetchNews]);

  return {
    news,
    isLoading,
    isOffline,
    hasCachedData,
    isRefreshing,
    retry,
  };
}
