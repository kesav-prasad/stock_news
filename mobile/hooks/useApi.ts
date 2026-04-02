import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '@/constants/api';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (exchange) params.append('exchange', exchange);
      params.append('limit', '5000');

      const res = await fetchWithRetry(`${API_ENDPOINTS.companies}?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [search, exchange]);

  useEffect(() => {
    const timeout = setTimeout(fetchCompanies, 400); // debounce
    return () => clearTimeout(timeout);
  }, [fetchCompanies]);

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
