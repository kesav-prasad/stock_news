import { useState, useEffect, useRef } from 'react';
import { resilientFetch } from '@/lib/offlineCache';

const CACHE_KEY = 'sn_ai_briefing';
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

/**
 * Generate a smart client-side briefing from headlines
 * Used as an immediate fallback when the API is unreachable
 */
function generateLocalBriefing(articles: any[]): string {
  if (!articles || articles.length === 0) return '';
  
  const headlines = articles.slice(0, 3).map(a => a.article?.title || a.title).filter(Boolean);
  
  if (headlines.length >= 2) {
    return `${headlines[0]}. Meanwhile, ${headlines[1].charAt(0).toLowerCase()}${headlines[1].slice(1)}.`;
  }
  return `Market Update: ${headlines[0]}. Monitor your watchlist for further developments.`;
}

export function useBriefing(articles: any[]) {
  // Initialize from cache synchronously to prevent layout flashes and typewriter restarts
  const [briefing, setBriefing] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!articles || articles.length === 0) return;
    if (hasFetched.current) return;
    
    // If we already have briefing from initial synchronous load, mark as fetched
    if (briefing) {
      hasFetched.current = true;
      return;
    }

    hasFetched.current = true;

    const fetchBriefing = async () => {
      setIsLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
        
        const payload = articles.slice(0, 5).map(a => ({
          title: a.article?.title || '',
          source: a.article?.source || ''
        }));

        const res = await resilientFetch(`${baseUrl}/api/briefing`, {
          timeoutMs: 12000,
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
        console.error('Briefing API failed, using local fallback:', err);
        // Generate a smart local briefing instead of showing nothing
        const localBriefing = generateLocalBriefing(articles);
        if (localBriefing) {
          setBriefing(localBriefing);
          // Cache with shorter TTL (1 hour) since it's local-generated
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: localBriefing,
            timestamp: Date.now() - (CACHE_TTL - 1000 * 60 * 60)
          }));
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBriefing();
  }, [articles]);

  return { briefing, isLoading };
}
