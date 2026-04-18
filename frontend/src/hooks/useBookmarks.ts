'use client';

import { useState, useEffect, useCallback } from 'react';
import { getBookmarks, saveBookmarks } from '@/lib/offlineCache';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  const toggleBookmark = useCallback((articleObj: any) => {
    setBookmarks((prev) => {
      // Use URL as unique identifier
      const exists = prev.some((b) => b.article.url === articleObj.article.url);
      let nextList = [];
      if (exists) {
        nextList = prev.filter((b) => b.article.url !== articleObj.article.url);
      } else {
        nextList = [articleObj, ...prev];
      }
      saveBookmarks(nextList);
      return nextList;
    });
  }, []);

  const isBookmarked = useCallback(
    (url: string) => {
      return bookmarks.some((b) => b.article.url === url);
    },
    [bookmarks]
  );

  return { bookmarks, toggleBookmark, isBookmarked };
}
