'use client';

import { useState, useEffect, useCallback } from 'react';
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
 * Offline-first news hook.
 * 
 * 1. Shows cached news INSTANTLY if available (from previous views)
 * 2. Fetches fresh news in background
 * 3. If no cache and offline → shows helpful "offline" message (not an error)
 * 4. If no cache and online → shows loading then data
 * 
 * Designed for slow 2G/3G forest area connections.
 */
export function useNews(companyId: string | null) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchNews = useCallback(async (id: string, force = false) => {
    // 1. Try cache first (instant)
    const cached = getCachedNews(id);
    if (cached && cached.length > 0) {
      setNews(cached);
      setHasCachedData(true);
      setIsLoading(false);

      // If cache is fresh enough and not forced, skip network
      if (!force && !isNewsCacheStale(id)) return;
    }

    // 2. Try fetching from server
    if (!isOnline()) {
      setIsOffline(true);
      if (!cached || cached.length === 0) {
        setIsLoading(false);
      }
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
        timeoutMs: 25000, // 25s for slow connections
        retries: 2,
        retryDelayMs: 3000,
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
