import { useState, useEffect } from 'react';
import { getCachedChart, setCachedChart, resilientFetch } from '@/lib/offlineCache';

// Add to memory to avoid multiple instances fetching the same symbol simultaneously
const pendingFetches = new Map<string, Promise<any>>();

export function useSparkline(companyId: string) {
  const [data, setData] = useState<number[] | null>(null);
  const [isPositive, setIsPositive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    let isMounted = true;
    
    // Check purely offline cache first
    const cached = getCachedChart(companyId, '1D');
    if (cached && cached.length > 0) {
      const prices = cached.map((p: any) => p.close).filter(Boolean);
      if (prices.length > 0) {
        setData(prices);
        setIsPositive(prices[prices.length - 1] >= prices[0]);
        setIsLoading(false);
      }
    }

    const fetchSparkline = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
        
        let fetchPromise = pendingFetches.get(companyId);
        if (!fetchPromise) {
          fetchPromise = resilientFetch(`${baseUrl}/api/companies/${companyId}/historical?period=1D`, {
            timeoutMs: 5000,
            retries: 1
          }).then(res => res.json());
          pendingFetches.set(companyId, fetchPromise);
        }

        const rawData = await fetchPromise;
        if (isMounted && rawData && Array.isArray(rawData)) {
            setCachedChart(companyId, '1D', rawData);
            const prices = rawData.map((p: any) => p.close).filter(Boolean);
            if (prices.length > 0) {
              setData(prices);
              setIsPositive(prices[prices.length - 1] >= prices[0]);
            }
        }
      } catch (err) {
        // Silently fail: sparkline is an optional enhancement
      } finally {
        if (isMounted) setIsLoading(false);
        pendingFetches.delete(companyId);
      }
    };

    fetchSparkline();

    return () => {
      isMounted = false;
    };
  }, [companyId]);

  return { data, isPositive, isLoading };
}
