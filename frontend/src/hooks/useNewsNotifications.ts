'use client';

import { useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useWatchlist } from './useWatchlist';
import { resilientFetch, isOnline } from '@/lib/offlineCache';

export function useNewsNotifications() {
  const { watchlistIds } = useWatchlist();
  const watchlistRef = useRef<string[]>([]);

  // Keep ref updated so interval sees latest watchlist without recreating interval
  useEffect(() => {
    watchlistRef.current = Array.from(watchlistIds);
  }, [watchlistIds]);

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

    const checkNews = async () => {
      if (!isOnline()) return;

      const currentWatchlist = watchlistRef.current;
      if (!currentWatchlist || currentWatchlist.length === 0) return;

      // Determine the timestamp to track what we've already notified about
      let lastSeenMap: Record<string, string>;
      try {
        lastSeenMap = JSON.parse(localStorage.getItem('news_notifications_last_seen') || '{}');
      } catch {
        lastSeenMap = {};
      }

      const updatedLastSeen = { ...lastSeenMap };
      let notificationsScheduled = false;

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';

      // Check watchlist sequentially so we don't spam the network
      for (const id of currentWatchlist) {
        try {
          const res = await resilientFetch(`${baseUrl}/api/companies/${id}/news`, {
            timeoutMs: 8000,
            retries: 0
          });
          const articles = await res.json();
          if (Array.isArray(articles) && articles.length > 0) {
            const latestArticle = articles[0]; // Assuming backend returns DESC order
            const latestTime = new Date(latestArticle.publishedAt).getTime();
            
            const lastSeenTime = lastSeenMap[id] ? new Date(lastSeenMap[id]).getTime() : 0;

            // If we have never checked this company before, record the latest but don't notify right away (prevents initial push spam)
            if (!lastSeenMap[id]) {
              updatedLastSeen[id] = latestArticle.publishedAt;
            } else if (latestTime > lastSeenTime) {
              // WE HAVE NEW NEWS! ✨
              try {
                await LocalNotifications.schedule({
                  notifications: [
                    {
                      id: Math.floor(Math.random() * 100000),
                      title: `New News Alert: ${latestArticle.symbol || 'Watchlist'}`,
                      body: latestArticle.title,
                      schedule: { at: new Date(Date.now() + 1000) }, // Schedule 1 second from now
                    }
                  ]
                });
                notificationsScheduled = true;
                updatedLastSeen[id] = latestArticle.publishedAt;
              } catch (e) {
                console.log('Failed to schedule notification (might not be a Native build)', e);
              }
            }
          }
        } catch (e) {
          // completely ignore network failures for background tasks
        }
      }

      if (notificationsScheduled || Object.keys(lastSeenMap).length !== Object.keys(updatedLastSeen).length) {
        localStorage.setItem('news_notifications_last_seen', JSON.stringify(updatedLastSeen));
      }
    };

    // Run the check every 5 minutes (300,000 ms)
    const interval = setInterval(checkNews, 5 * 60 * 1000);
    
    // Also run once after 5 seconds of app start
    const timer = setTimeout(checkNews, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);
}
