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
      params.append('limit', '500');

      const res = await fetch(`${API_ENDPOINTS.companies}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch companies');
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
        const res = await fetch(API_ENDPOINTS.companyNews(companyId));
        if (!res.ok) throw new Error('Failed to fetch news');
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
