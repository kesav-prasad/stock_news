'use client';

/**
 * Offline-first cache layer using localStorage.
 * Stores news articles, company updates, and timestamps.
 * Designed for low-bandwidth / no-connectivity environments.
 */

const CACHE_PREFIX = 'sn_';
const NEWS_TTL = 1000 * 60 * 60 * 6; // 6 hours before news is considered stale
const COMPANIES_TTL = 1000 * 60 * 60 * 24; // 24 hours for company list refresh

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function safeGet<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function safeSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage is full — try to clear old news caches
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX + 'news_')) {
          keysToRemove.push(k);
        }
      }
      // Remove oldest half
      keysToRemove.sort();
      keysToRemove.slice(0, Math.floor(keysToRemove.length / 2)).forEach(k => {
        localStorage.removeItem(k);
      });
      // Retry
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // Give up silently — cache is a nice-to-have
    }
  }
}

// ─── Companies Cache ───

export function getCachedCompanies(): any[] | null {
  const entry = safeGet<any[]>('companies');
  if (!entry) return null;
  return entry.data;
}

export function setCachedCompanies(companies: any[]): void {
  safeSet('companies', companies);
}

export function isCompanyCacheStale(): boolean {
  const entry = safeGet<any[]>('companies');
  if (!entry) return true;
  return Date.now() - entry.timestamp > COMPANIES_TTL;
}

// ─── News Cache ───

export function getCachedNews(companyId: string): any[] | null {
  const entry = safeGet<any[]>(`news_${companyId}`);
  if (!entry) return null;
  return entry.data;
}

export function setCachedNews(companyId: string, news: any[]): void {
  safeSet(`news_${companyId}`, news);
}

export function isNewsCacheStale(companyId: string): boolean {
  const entry = safeGet<any[]>(`news_${companyId}`);
  if (!entry) return true;
  return Date.now() - entry.timestamp > NEWS_TTL;
}

// ─── Stock Data Cache ───

export function getCachedQuote(companyId: string): any | null {
  const entry = safeGet<any>(`quote_${companyId}`);
  if (!entry) return null;
  return entry.data;
}

export function setCachedQuote(companyId: string, quote: any): void {
  safeSet(`quote_${companyId}`, quote);
}

export function getCachedChart(companyId: string, period: string): any[] | null {
  const entry = safeGet<any[]>(`chart_${companyId}_${period}`);
  if (!entry) return null;
  return entry.data;
}

export function setCachedChart(companyId: string, period: string, data: any[]): void {
  safeSet(`chart_${companyId}_${period}`, data);
}

// ─── Watchlist (local-first, syncs when online) ───

export function getLocalWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + 'watchlist_local');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setLocalWatchlist(ids: string[]): void {
  try {
    localStorage.setItem(CACHE_PREFIX + 'watchlist_local', JSON.stringify(ids));
  } catch {
    // ignore
  }
}

// ─── Network helpers ───

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Fetch with timeout, retry, and fallback.
 * Designed to work on slow 2G/3G connections.
 */
export async function resilientFetch(
  url: string,
  options?: {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
  }
): Promise<Response> {
  const { timeoutMs = 10000, retries = 2, retryDelayMs = 1000 } = options || {};

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      // Wait before retry, with exponential backoff
      await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
    }
  }

  throw new Error('All retries exhausted');
}
