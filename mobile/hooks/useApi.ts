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
  const [fullData, setFullData] = useState<CompaniesResponse | null>(null);
  const [searchResults, setSearchResults] = useState<CompaniesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstMount = useRef(true);

  // 1. Load from cache on mount
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(COMPANIES_CACHE_KEY);
        if (cached) {
          const { data: cachedData } = JSON.parse(cached);
          if (cachedData) {
            setFullData(cachedData);
            setLoading(false);
          }
        }
      } catch (e) {
        console.warn('Failed to load companies from cache:', e);
      }
    })();
  }, []);

  // 2. Compute locally filtered results for INSTANT UI updates from master list
  const locallyFiltered = useMemo(() => {
    if (!fullData?.companies) return { companies: [], total: 0 };
    
    let filtered = fullData.companies;
    
    if (exchange) {
      filtered = filtered.filter(c => c.exchange.toUpperCase() === exchange.toUpperCase());
    }
    
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.symbol.toLowerCase().includes(term)
      );
    }
    
    return {
      companies: filtered,
      total: filtered.length
    };
  }, [fullData, search, exchange]);

  const fetchCompanies = useCallback(async () => {
    // Only show loading if we have NO results for the current search/filter
    const hasLocalResults = locallyFiltered.companies.length > 0;
    if (!hasLocalResults) setLoading(true);
    
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (exchange) params.append('exchange', exchange);
      params.append('limit', '5000');

      const res = await fetchWithRetry(`${API_ENDPOINTS.companies}?${params.toString()}`);
      const json: CompaniesResponse = await res.json();
      
      if (!search && !exchange) {
        setFullData(json);
        AsyncStorage.setItem(COMPANIES_CACHE_KEY, JSON.stringify({
          data: json,
          timestamp: Date.now()
        })).catch(() => {});
      } else {
        setSearchResults(json);
      }
    } catch (err: any) {
      if (!hasLocalResults) {
        setError(err.message || 'Network error');
      }
    } finally {
      setLoading(false);
    }
  }, [search, exchange, locallyFiltered.companies.length]); // Use length to stabilize dependency

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchCompanies();
      return;
    }

    const timeout = setTimeout(fetchCompanies, search || exchange ? 500 : 0);
    return () => clearTimeout(timeout);
  }, [fetchCompanies, search, exchange]);

  // Priority: 1. Search Results (API) > 2. Local Filter (from Master) > 3. Master List
  const displayData = (search || exchange) 
    ? (searchResults || locallyFiltered) 
    : (fullData || locallyFiltered);

  return {
    companies: displayData.companies,
    total: displayData.total,
    loading,
    error,
    refetch: fetchCompanies,
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
