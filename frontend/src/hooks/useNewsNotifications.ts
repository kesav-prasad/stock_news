'use client';

import { useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useWatchlist } from './useWatchlist';
import { resilientFetch, isOnline } from '@/lib/offlineCache';

const LAST_SEEN_KEY = 'news_notifications_last_seen';

/**
 * Read the last-seen map from localStorage.
 * Maps companyId → ISO timestamp of the most recent article we already know about.
 */
function getLastSeenMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLastSeenMap(map: Record<string, string>) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * ★ Immediately seed a company into the last-seen map so we NEVER
 *   fire notifications for existing/old articles when the user first
 *   adds it to their watchlist. We set the timestamp to "now" which
 *   means only articles published AFTER this moment will trigger alerts.
 */
function seedCompanyIfNeeded(companyId: string) {
  const map = getLastSeenMap();
  if (!map[companyId]) {
    map[companyId] = new Date().toISOString();
    saveLastSeenMap(map);
  }
}

/**
 * Clean up stale entries: remove companies no longer in the watchlist.
 */
function pruneLastSeenMap(currentWatchlistIds: string[]) {
  const map = getLastSeenMap();
  const watchSet = new Set(currentWatchlistIds);
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!watchSet.has(id)) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) saveLastSeenMap(map);
}

export function useNewsNotifications(onNotificationClick?: (companyId: string) => void) {
  const { watchlistIds } = useWatchlist();
  const watchlistRef = useRef<string[]>([]);

  // ★ KEY FIX: Every time the watchlist changes, immediately seed any
  //   new companies so the poller never treats their existing news as "new".
  useEffect(() => {
    const ids = Array.from(watchlistIds);
    watchlistRef.current = ids;

    // Seed every company that isn't already tracked
    ids.forEach(seedCompanyIfNeeded);

    // Remove entries for companies no longer in watchlist
    pruneLastSeenMap(ids);
  }, [watchlistIds]);

  const clickRef = useRef(onNotificationClick);
  useEffect(() => {
    clickRef.current = onNotificationClick;
  }, [onNotificationClick]);

  useEffect(() => {
    // Request permission (on Android 13+ / iOS this is required)
    const requestPermission = async () => {
      try {
        const { display } = await LocalNotifications.requestPermissions();
        console.log('[NewsNotifications] Permission status:', display);
      } catch (e) {
        console.log('[NewsNotifications] Not running in Capacitor / Permissions error', e);
      }
    };
    requestPermission();

    let listenerRef: any = null;
    (async () => {
      try {
        listenerRef = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (notificationAction) => {
            const extra = notificationAction.notification.extra;
            if (extra && extra.companyId && clickRef.current) {
              clickRef.current(extra.companyId);
            }
          }
        );
      } catch (e) {
        // Not running in Capacitor
      }
    })();

    const checkNews = async () => {
      if (!isOnline()) return;

      const currentWatchlist = watchlistRef.current;
      if (!currentWatchlist || currentWatchlist.length === 0) return;

      const lastSeenMap = getLastSeenMap();
      const updatedLastSeen = { ...lastSeenMap };
      let dirty = false;

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';

      // Check each watchlisted company sequentially
      for (const id of currentWatchlist) {
        try {
          const res = await resilientFetch(`${baseUrl}/api/companies/${id}/news`, {
            timeoutMs: 8000,
            retries: 0,
          });
          const articles = await res.json();

          if (!Array.isArray(articles) || articles.length === 0) continue;

          // Backend returns articles sorted by publishedAt DESC
          const latestArticle = articles[0];
          const latestTime = new Date(latestArticle.publishedAt).getTime();
          const lastSeenTime = lastSeenMap[id]
            ? new Date(lastSeenMap[id]).getTime()
            : Date.now(); // If somehow unseeded, treat "now" as baseline (no notification)

          // ★ Only notify if:
          //   1. The latest article was published AFTER our last-seen timestamp
          //   2. The article is actually recent (within last 6 hours) — avoids
          //      stale articles from slow-updating RSS feeds triggering alerts
          const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
          const isArticleRecent = (Date.now() - latestTime) < SIX_HOURS_MS;
          const isArticleNew = latestTime > lastSeenTime;

          if (isArticleNew && isArticleRecent) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(Math.random() * 100000),
                    title: `📰 ${latestArticle.source || 'News Alert'}`,
                    body: latestArticle.title,
                    schedule: { at: new Date(Date.now() + 1000) },
                    extra: { companyId: id },
                  },
                ],
              });
              console.log(`[NewsNotifications] Notified for company ${id}: ${latestArticle.title}`);
            } catch (e) {
              console.log('[NewsNotifications] Failed to schedule (non-native?)', e);
            }
          }

          // Always update the last-seen to the latest article timestamp
          // (even if we didn't notify — this prevents re-checking old articles)
          if (latestTime > (updatedLastSeen[id] ? new Date(updatedLastSeen[id]).getTime() : 0)) {
            updatedLastSeen[id] = latestArticle.publishedAt;
            dirty = true;
          }
        } catch (e) {
          // Silently ignore network failures for background checks
        }
      }

      if (dirty) {
        saveLastSeenMap(updatedLastSeen);
      }
    };

    // Run check every 5 minutes
    const interval = setInterval(checkNews, 5 * 60 * 1000);

    // Initial check after 10 seconds (give app time to hydrate + seed watchlist)
    const timer = setTimeout(checkNews, 10_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      if (listenerRef && listenerRef.remove) {
        listenerRef.remove().catch(() => {});
      }
    };
  }, []);
}
