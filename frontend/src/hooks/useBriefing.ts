import { useState, useEffect } from 'react';
import { resilientFetch } from '@/lib/offlineCache';

const CACHE_KEY = 'sn_ai_briefing';
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

export function useBriefing(articles: any[]) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!articles || articles.length === 0) return;

    // Check cache first
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setBriefing(cached.data);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Only hit API if we actually have priority articles
    const fetchBriefing = async () => {
      setIsLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
        
        const payload = articles.slice(0, 5).map(a => ({
          title: a.article.title,
          source: a.article.source
        }));

        const res = await resilientFetch(`${baseUrl}/api/briefing`, {
          timeoutMs: 15000,
          retries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles: payload })
          }
        });
        
        const data = await res.json();
        
        if (data.briefing) {
          setBriefing(data.briefing);
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: data.briefing,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error('Briefing fetch failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBriefing();
  }, [articles]);

  return { briefing, isLoading };
}
