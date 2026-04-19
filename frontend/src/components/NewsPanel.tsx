'use client';

import { useCallback } from 'react';
import { Loader2, ExternalLink, WifiOff, RefreshCw, Newspaper, Bookmark } from 'lucide-react';
import { useNews } from '@/hooks/useNews';
import { useBookmarks } from '@/hooks/useBookmarks';
import { openInAppBrowser } from '@/lib/inAppBrowser';

interface CompanyProps {
  id: string;
  name: string;
  symbol: string;
}

export default function NewsPanel({ company }: { company: CompanyProps }) {
  const { news, isLoading, isOffline, hasCachedData, isRefreshing, retry } = useNews(company.id);
  const { toggleBookmark, isBookmarked } = useBookmarks();

  const handleOpenArticle = useCallback((url: string) => {
    openInAppBrowser(url);
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
        <h3 className="text-base sm:text-lg font-semibold dark:text-gray-100">Latest News</h3>
        {isRefreshing && (
          <RefreshCw size={12} className="animate-spin text-blue-500 ml-1" />
        )}
        <span className="text-[10px] sm:text-xs text-gray-400 ml-auto">
          {hasCachedData && news.length > 0 ? 'Cached' : 'No duplicates'}
        </span>
      </div>

      {/* Loading state — only shown when we have zero cached data */}
      {isLoading && news.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Loader2 className="animate-spin w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-gray-400">Fetching news...</span>
          <span className="text-[10px] text-gray-500">This may take a moment on slow connections</span>
        </div>
      )}

      {/* Offline state — only when no cache AND offline */}
      {isOffline && news.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <WifiOff size={24} className="text-amber-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              You&apos;re offline
            </p>
            <p className="text-xs text-gray-400 mt-1">
              News will load when you&apos;re back online
            </p>
          </div>
          <button
            onClick={retry}
            className="mt-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            Try Again
          </button>
        </div>
      )}

      {/* News articles — opens in-app browser instead of external Chrome */}
      {news.length > 0 && (
        <>
          {news.map((article: any) => {
            const isSaved = isBookmarked(article.url);
            
            return (
              <div
                key={article.id}
                onClick={() => handleOpenArticle(article.url)}
                className="block w-full cursor-pointer text-left p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-150 active:translate-y-[2px] active:scale-[0.985] active:brightness-95 dark:active:brightness-105 active:shadow-none group"
              >
                <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-2">
                  <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 truncate max-w-[60%]">
                    {article.source}
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-400 shrink-0">
                    {new Date(article.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <h4 className="font-bold text-xs sm:text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">
                  {article.title}
                </h4>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400 group-hover:text-blue-400 dark:text-gray-500 dark:group-hover:text-blue-500 transition-colors">
                    <Newspaper size={10} className="sm:w-3 sm:h-3" />
                    <span className="font-medium">Read in-app</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {article.sentiment === 'bullish' && (
                      <span className="font-bold text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Bullish
                      </span>
                    )}
                    {article.sentiment === 'bearish' && (
                      <span className="font-bold text-[9px] uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                        Bearish
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark({ article, company });
                      }}
                      className={`p-1.5 -mr-1.5 rounded-full transition-all duration-300 active:scale-75 ${
                        isSaved
                          ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                          : 'text-gray-300 dark:text-gray-600 hover:text-amber-500'
                      }`}
                    >
                      <Bookmark size={14} className={isSaved ? 'fill-current' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* No news found (not an error, just no articles) */}
      {!isLoading && !isOffline && news.length === 0 && (
        <div className="text-center text-gray-500 text-sm py-10">
          No recent news articles found for this company.
        </div>
      )}
    </div>
  );
}

