'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { resilientFetch, isOnline } from '@/lib/offlineCache';

interface StockQuote {
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  symbol: string;
  name: string;
}

interface ChartPoint {
  time: number;
  value: number;
}

type Period = '1M' | '6M' | '1Y' | '5Y';

// ★ Client-side in-memory cache to avoid refetching on modal reopen
const quoteMemCache = new Map<string, { data: StockQuote; expires: number }>();
const histMemCache = new Map<string, { data: ChartPoint[]; expires: number }>();
const QUOTE_MEM_TTL = 30_000; // 30s client cache
const HIST_MEM_TTL = 120_000; // 2min client cache

/**
 * Hook to fetch live stock price + historical chart data.
 * Uses multiple cache layers for instant re-opens:
 *   1. In-memory Map (instant, survives modal close/reopen)
 *   2. Backend cache (60s quote, 5min historical)
 *   3. Yahoo Finance API (actual source)
 */
export function useStockPrice(companyId: string | null) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [period, setPeriod] = useState<Period>('1M');
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';

  // Fetch quote
  const fetchQuote = useCallback(async (id: string, force = false) => {
    // 1. Check memory cache
    if (!force) {
      const cached = quoteMemCache.get(id);
      if (cached && Date.now() < cached.expires) {
        setQuote(cached.data);
        return;
      }
    }

    if (!isOnline()) return;

    setIsQuoteLoading(true);
    try {
      const res = await resilientFetch(`${baseUrl}/api/companies/${id}/quote`, {
        timeoutMs: 10000,
        retries: 1,
      });
      const data = await res.json();
      if (data && data.price !== undefined) {
        setQuote(data);
        quoteMemCache.set(id, { data, expires: Date.now() + QUOTE_MEM_TTL });
      }
    } catch {
      // Silently fail — chart is supplementary
      console.log('[StockPrice] Quote fetch failed');
    } finally {
      setIsQuoteLoading(false);
    }
  }, [baseUrl]);

  // Fetch historical chart data
  const fetchChart = useCallback(async (id: string, p: Period) => {
    const cacheKey = `${id}_${p}`;
    // 1. Check memory cache
    const cached = histMemCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      setChartData(cached.data);
      return;
    }

    if (!isOnline()) return;

    setIsChartLoading(true);
    try {
      const res = await resilientFetch(`${baseUrl}/api/companies/${id}/historical?period=${p}`, {
        timeoutMs: 15000,
        retries: 1,
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setChartData(data);
        histMemCache.set(cacheKey, { data, expires: Date.now() + HIST_MEM_TTL });
      } else {
        setChartData([]);
      }
    } catch {
      console.log('[StockPrice] Chart fetch failed');
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  }, [baseUrl]);

  // Effect: when companyId changes, fetch quote + chart
  useEffect(() => {
    if (!companyId) {
      setQuote(null);
      setChartData([]);
      setError(null);
      return;
    }

    fetchQuote(companyId);
    fetchChart(companyId, period);

    // ★ Auto-refresh the quote every 30 seconds during market hours
    const intervalId = setInterval(() => {
      fetchQuote(companyId, true); // force flag ignores the 30s frontend cache
    }, 30000);

    return () => clearInterval(intervalId);
  }, [companyId, fetchQuote, fetchChart, period]);

  // Period change handler
  const changePeriod = useCallback((p: Period) => {
    setPeriod(p);
  }, []);

  // Derive quote from chart if quote fails but chart succeeds
  let derivedQuote = quote;
  if ((!derivedQuote || derivedQuote.price === 0) && chartData.length > 0) {
    const lastPoint = chartData[chartData.length - 1];
    const prevPoint = chartData.length > 1 ? chartData[chartData.length - 2] : lastPoint;
    const change = lastPoint.value - prevPoint.value;
    const changePercent = prevPoint.value ? (change / prevPoint.value) * 100 : 0;
    
    derivedQuote = {
      price: lastPoint.value,
      change,
      changePercent,
      timestamp: new Date(lastPoint.time * 1000),
      symbol: companyId || '',
      name: ''
    };
  }

  return {
    quote: derivedQuote,
    chartData,
    period,
    changePeriod,
    isQuoteLoading,
    isChartLoading,
    error,
  };
}
