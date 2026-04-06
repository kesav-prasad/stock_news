import { useState, useEffect, useCallback, useRef } from 'react';
import { API_ENDPOINTS } from '@/constants/api';
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
  const [data, setData] = useState<CompaniesResponse | null>(null);
  const [loading, setLoading] = useState(true); // default to true if no cache
  const [error, setError] = useState<string | null>(null);
  const isFirstMount = useRef(true);

  // 1. Load from cache on mount
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(COMPANIES_CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          const isExpired = Date.now() - timestamp > CACHE_EXPIRY;
          
          if (cachedData) {
            setData(cachedData);
            // If cache is fresh, we can stop "initial" loading
            if (!isExpired) {
              setLoading(false);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load companies from cache:', e);
      }
    })();
  }, []);

  const fetchCompanies = useCallback(async () => {
    // Only show loading if we don't have ANY data yet
    if (!data) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (exchange) params.append('exchange', exchange);
      params.append('limit', '5000'); // Maintain large limit for searchability

      const res = await fetchWithRetry(`${API_ENDPOINTS.companies}?${params.toString()}`);
      const json: CompaniesResponse = await res.json();
      
      setData(json);
      
      // Update cache in background
      if (!search && !exchange) {
        AsyncStorage.setItem(COMPANIES_CACHE_KEY, JSON.stringify({
          data: json,
          timestamp: Date.now()
        })).catch(() => {});
      }
    } catch (err: any) {
      // Don't show error if we have cached data, unless it's the first mount and it failed
      if (!data) {
        setError(err.message || 'Network error');
      }
      console.warn('Silent background sync failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [search, exchange, data]);

  useEffect(() => {
    // Skip the very first run since cache loader is handling the mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      // Triger background fetch on mount if no search
      if (!search && !exchange) {
        fetchCompanies();
      }
      return;
    }

    const timeout = setTimeout(fetchCompanies, search || exchange ? 400 : 0); // debounce for search, instant for mount/filters
    return () => clearTimeout(timeout);
  }, [fetchCompanies, search, exchange]);

  return {
    companies: data?.companies || [],
    total: data?.total || 0,
    loading,
    error,
    refetch: fetchCompanies,
  };
}

export function useCompanyNews(companyId: string | null) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setNews([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithRetry(API_ENDPOINTS.companyNews(companyId));
        const json = await res.json();
        if (!cancelled) setNews(json);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load news');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { news, loading, error };
}
