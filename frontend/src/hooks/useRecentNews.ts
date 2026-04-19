'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

interface AggregatedNewsItem {
  article: NewsArticle;
  company: {
    id: string;
    name: string;
    symbol: string;
  };
}

// Default pool of popular companies to always show news from
// Uses base ticker prefixes — matched with startsWith to handle .NS/.BO suffixes
const DEFAULT_POOL_PREFIXES = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
  'WIPRO', 'TATAMOTORS', 'MARUTI', 'ADANIENT', 'BAJFINANCE',
];

/** Check if a symbol matches any of the default pool prefixes */
function isDefaultPoolSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return DEFAULT_POOL_PREFIXES.some((prefix) => upper === prefix || upper.startsWith(prefix + '.'));
}

/**
 * ★ Aggregated Recent News hook.
 *
 * Fetches news for MULTIPLE companies concurrently, then splits them into:
 *   - priorityNews: from user's watchlist + frequently visited companies
 *   - otherNews: from a default pool of popular companies
 *
 * Both arrays are sorted by publishedAt (newest first).
 */
export function useRecentNews(
  allCompanies: { id: string; name: string; symbol: string }[],
  watchlistIds: Set<string>,
  visitedCounts: Record<string, number>,
) {
  const [priorityNews, setPriorityNews] = useState<AggregatedNewsItem[]>([]);
  const [otherNews, setOtherNews] = useState<AggregatedNewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0); // Incremented to force re-fetch
  const abortRef = useRef(false);

  // Build the list of priority company IDs (watchlist + visited, deduplicated)
  const priorityCompanyIds = useMemo(() => {
    const ids = new Set<string>();
    // Watchlist first
    watchlistIds.forEach((id) => ids.add(id));
    // Then frequently visited, sorted by visit count
    const sortedVisited = Object.entries(visitedCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => id);
    sortedVisited.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [watchlistIds, visitedCounts]);

  // Build the list of "other" company IDs (popular companies not in priority)
  const otherCompanyIds = useMemo(() => {
    const prioritySet = new Set(priorityCompanyIds);
    return allCompanies
      .filter((c) => isDefaultPoolSymbol(c.symbol) && !prioritySet.has(c.id))
      .map((c) => c.id)
      .slice(0, 5); // Reduced cap to 5 to massively improve load speeds
  }, [allCompanies, priorityCompanyIds]);

  // Map for quick company lookup
  const companyMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; symbol: string }>();
    allCompanies.forEach((c) => map.set(c.id, c));
    return map;
  }, [allCompanies]);

  const fetchNewsForCompany = useCallback(
    async (companyId: string, forceFetch = false): Promise<NewsArticle[]> => {
      // 1. Try cache first
      const cached = getCachedNews(companyId);
      
      // If we have cache and we aren't forcing a hard refresh, return it instantly
      if (!forceFetch && cached && cached.length > 0) {
        // If it's stale, fetch in the background silently
        if (isOnline() && isNewsCacheStale(companyId)) {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
          resilientFetch(`${baseUrl}/api/companies/${companyId}/news`, {
            timeoutMs: 10000,
            retries: 0,
          }).then(res => res.json()).then(fresh => {
            if (Array.isArray(fresh) && fresh.length > 0) setCachedNews(companyId, fresh);
          }).catch(() => {}); // silent fail in background
        }
        return cached;
      }

      // 2. Network fetch required
      if (!isOnline()) {
        return cached || [];
      }

      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
        const res = await resilientFetch(`${baseUrl}/api/companies/${companyId}/news`, {
          timeoutMs: forceFetch ? 15000 : 8000, // Shorter timeout for initial loads
          retries: forceFetch ? 1 : 0,
          retryDelayMs: 1000,
        });
        const freshNews = await res.json();
        if (Array.isArray(freshNews) && freshNews.length > 0) {
          setCachedNews(companyId, freshNews);
          return freshNews;
        }
      } catch {
        // Fallback to cached
      }

      return cached || [];
    },
    [],
  );

  useEffect(() => {
    if (allCompanies.length === 0) return;
    abortRef.current = false;

    async function fetchAll() {
      setIsLoading(true);

      const isForced = fetchKey > 0;
      const priorityIds = priorityCompanyIds.slice(0, 5); // Reduced from 15 to 5 for speed
      
      // Clear current state if forced refresh
      if (isForced) {
        setPriorityNews([]);
        setOtherNews([]);
      }

      const processCompany = async (id: string, isPriority: boolean, limit: number) => {
        const company = companyMap.get(id);
        if (!company) return;

        // Synchronously check cache for instant render
        const cached = getCachedNews(id);
        const hasCache = !isForced && cached && cached.length > 0;
        
        if (hasCache) {
          const items = cached.slice(0, limit).map((a) => ({
            article: a,
            company: { id: company.id, name: company.name, symbol: company.symbol },
          }));
          
          if (isPriority) {
            setPriorityNews(prev => {
              const combined = [...prev, ...items];
              const unique = Array.from(new Map(combined.map(item => [item.article.id || item.article.url, item])).values());
              return unique.sort((a, b) => new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime());
            });
          } else {
            setOtherNews(prev => {
              const combined = [...prev, ...items];
              const unique = Array.from(new Map(combined.map(item => [item.article.id || item.article.url, item])).values());
              return unique.sort((a, b) => new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime());
            });
          }
        }

        // Await the fetch results
        const articles = await fetchNewsForCompany(id, isForced);
        if (abortRef.current || !articles || articles.length === 0) return;

        // If we didn't add from cache, or if we did a forced refresh, append network results
        if (!hasCache || isForced) {
          const items = articles.slice(0, limit).map((a) => ({
            article: a,
            company: { id: company.id, name: company.name, symbol: company.symbol },
          }));

          if (isPriority) {
            setPriorityNews(prev => {
              const combined = [...prev, ...items];
              const unique = Array.from(new Map(combined.map(item => [item.article.id || item.article.url, item])).values());
              return unique.sort((a, b) => new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime());
            });
          } else {
            setOtherNews(prev => {
              const combined = [...prev, ...items];
              const unique = Array.from(new Map(combined.map(item => [item.article.id || item.article.url, item])).values());
              return unique.sort((a, b) => new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime());
            });
          }
        }
      };

      // Set up promises without blocking each other
      const priorityPromises = priorityIds.map(id => processCompany(id, true, 3));
      const otherPromises = otherCompanyIds.map(id => processCompany(id, false, 2));

      // Wait for all to finish just to remove the loading state
      await Promise.all([...priorityPromises, ...otherPromises]);

      if (!abortRef.current) {
        setIsLoading(false);
      }
    }

    fetchAll();

    return () => {
      abortRef.current = true;
    };
    // fetchKey in deps ensures refetch() actually re-triggers the effect
  }, [allCompanies.length, priorityCompanyIds, otherCompanyIds, companyMap, fetchNewsForCompany, fetchKey]);

  // Allow manual refetch — increment fetchKey to force useEffect re-run
  const refetch = useCallback(() => {
    setPriorityNews([]);
    setOtherNews([]);
    setIsLoading(true);
    setFetchKey((k) => k + 1);
  }, []);

  return { priorityNews, otherNews, isLoading, refetch };
}
