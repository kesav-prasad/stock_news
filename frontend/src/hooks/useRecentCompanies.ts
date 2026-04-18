import { useState, useEffect, useCallback } from 'react';

const RECENT_COMPANIES_KEY = 'stocknews_recent_companies';

export function useRecentCompanies() {
  const [visited, setVisited] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_COMPANIES_KEY);
      if (stored) {
        setVisited(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Failed to load recent companies', err);
    }
    setHydrated(true);
  }, []);

  const recordVisit = useCallback((companyId: string) => {
    setVisited((prev) => {
      const updated = {
        ...prev,
        [companyId]: (prev[companyId] || 0) + 1,
      };
      
      try {
        localStorage.setItem(RECENT_COMPANIES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save recent companies', err);
      }
      return updated;
    });
  }, []);

  return {
    visitedCounts: visited,
    recordVisit,
    hydrated
  };
}
