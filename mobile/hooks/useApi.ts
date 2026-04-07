import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { API_ENDPOINTS } from '@/constants/api';
export { API_ENDPOINTS };
import AsyncStorage from '@react-native-async-storage/async-storage';

const COMPANIES_CACHE_KEY = 'stocknews-companies-cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

interface CompaniesResponse {
  companies: Company[];
  total: number;
  page: number;
  limit: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

/**
 * Fetch with automatic retry — handles Render free-tier cold starts
 * which can take 30-60 seconds to wake up.
 */
async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 45000): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) return res;

      // If server responded but with an error, throw immediately
      throw new Error(`Server error: ${res.status}`);
    } catch (err: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) throw err;

      // Wait 2 seconds before retrying (server might be waking up)
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Network error after retries');
}

export function useCompanies(search: string, exchange: string) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstMount = useRef(true);

  const fetchCompanies = useCallback(async (pageNum: number, isNewSearch: boolean) => {
    if (isNewSearch) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (exchange) params.append('exchange', exchange);
      params.append('page', pageNum.toString());
      params.append('limit', '40'); // Fetch 40 at a time for efficiency

      const res = await fetchWithRetry(`${API_ENDPOINTS.companies}?${params.toString()}`);
      const json: CompaniesResponse = await res.json();
      
      setCompanies(prev => isNewSearch ? json.companies : [...prev, ...json.companies]);
      setTotal(json.total);
      
      // Cache the first page of the "all" view for instant startup
      if (!search && !exchange && pageNum === 1) {
        AsyncStorage.setItem(COMPANIES_CACHE_KEY, JSON.stringify({
          data: json,
          timestamp: Date.now()
        })).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, exchange]);

  // Load cache on mount ONLY if no search is active
  useEffect(() => {
    if (!search && !exchange) {
      (async () => {
        try {
          const cached = await AsyncStorage.getItem(COMPANIES_CACHE_KEY);
          if (cached) {
            const { data: cachedData } = JSON.parse(cached);
            if (cachedData && cachedData.companies) {
              setCompanies(cachedData.companies);
              setTotal(cachedData.total);
              setLoading(false);
            }
          }
        } catch (e) {}
      })();
    }
  }, []);

  // Handle search/filter changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchCompanies(1, true);
      return;
    }

    const timeout = setTimeout(() => fetchCompanies(1, true), 400); // 400ms debounce
    return () => clearTimeout(timeout);
  }, [search, exchange]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || companies.length >= total) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCompanies(nextPage, false);
  }, [loading, loadingMore, companies.length, total, page, fetchCompanies]);

  return {
    companies,
    total,
    loading,
    loadingMore,
    error,
    refetch: () => fetchCompanies(1, true),
    loadMore,
  };
}

export function useCompanyNews(companyId: string | null) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    if (!companyId) {
      setNews([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(API_ENDPOINTS.companyNews(companyId));
      const json = await res.json();
      setNews(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { news, loading, error, refetch: fetchNews };
}
