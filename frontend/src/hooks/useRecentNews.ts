'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { resilientFetch, isOnline } from '@/lib/offlineCache';

const MARKET_NEWS_CACHE_KEY = 'sn_market_news_feed';
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

interface MarketNewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

interface AggregatedNewsItem {
  article: MarketNewsArticle;
  company: {
    id: string;
    name: string;
    symbol: string;
  };
}

/**
 * Read cached market news from localStorage for instant render.
 */
function getCachedMarketNews(): AggregatedNewsItem[] | null {
  try {
    const raw = localStorage.getItem(MARKET_NEWS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || !Array.isArray(parsed.data)) return null;
    // Return cached data if within TTL
    if (Date.now() - parsed.timestamp < CACHE_TTL * 10) {
      return parsed.data;
    }
    return parsed.data; // Still return even if stale (for instant render)
  } catch {
    return null;
  }
}

function setCachedMarketNews(data: AggregatedNewsItem[]) {
  try {
    localStorage.setItem(MARKET_NEWS_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {}
}

/**
 * ★ Market News Feed hook.
 *
 * Fetches ALL Indian stock market news from a single /api/market-news endpoint.
 * Returns a flat chronological list (newest first), fully deduplicated.
 * Cache-first for instant rendering. Auto-refreshes every 3 minutes.
 */
export function useRecentNews(
  _allCompanies: { id: string; name: string; symbol: string }[],
  _watchlistIds: Set<string>,
  _visitedCounts: Record<string, number>,
) {
  const [allNews, setAllNews] = useState<AggregatedNewsItem[]>(() => {
    // Synchronous cache read for instant render — no loading flash
    if (typeof window !== 'undefined') {
      const cached = getCachedMarketNews();
      if (cached && cached.length > 0) return cached;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    // If we have cached data, don't show loading
    if (typeof window !== 'undefined') {
      const cached = getCachedMarketNews();
      if (cached && cached.length > 0) return false;
    }
    return true;
  });
  const [fetchKey, setFetchKey] = useState(0);
  const abortRef = useRef(false);

  const fetchMarketNews = useCallback(async (isForced = false) => {
    if (!isOnline() && !isForced) return;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
      const res = await resilientFetch(`${baseUrl}/api/market-news`, {
        timeoutMs: isForced ? 25000 : 20000,
        retries: isForced ? 1 : 0,
        retryDelayMs: 1000,
      });
      const articles: MarketNewsArticle[] = await res.json();

      if (!Array.isArray(articles) || articles.length === 0) return;

      // Transform into AggregatedNewsItem format
      // Since these are market-wide news (not company-specific), use source as the "company"
      const items: AggregatedNewsItem[] = articles.map(article => ({
        article,
        company: {
          id: article.source,
          name: article.source,
          symbol: article.source.substring(0, 4).toUpperCase(),
        },
      }));

      setAllNews(items);
      setCachedMarketNews(items);
    } catch (err) {
      console.error('[useRecentNews] Failed to fetch market news:', err);
    }
  }, []);

  useEffect(() => {
    abortRef.current = false;

    async function run() {
      const isForced = fetchKey > 0;

      if (isForced) {
        setAllNews([]);
        setIsLoading(true);
      }

      // If we already have cached data (from initial state), just background-refresh
      const hasCachedData = allNews.length > 0 && !isForced;

      if (!hasCachedData) {
        setIsLoading(true);
      }

      await fetchMarketNews(isForced);

      if (!abortRef.current) {
        setIsLoading(false);
      }
    }

    run();

    // ★ Auto-refresh every 3 minutes for fresh news
    const refreshInterval = setInterval(() => {
      if (!abortRef.current) {
        fetchMarketNews(false).catch(() => {});
      }
    }, CACHE_TTL);

    return () => {
      abortRef.current = true;
      clearInterval(refreshInterval);
    };
  }, [fetchKey, fetchMarketNews]);

  const refetch = useCallback(() => {
    setAllNews([]);
    setIsLoading(true);
    setFetchKey((k) => k + 1);
  }, []);

  return {
    priorityNews: allNews,
    otherNews: [] as AggregatedNewsItem[],
    allNews,
    isLoading,
    refetch,
  };
}
