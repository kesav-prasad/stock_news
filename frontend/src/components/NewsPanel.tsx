'use client';

import { Loader2, ExternalLink, WifiOff, RefreshCw } from 'lucide-react';
import { useNews } from '@/hooks/useNews';

export default function NewsPanel({ companyId }: { companyId: string }) {
  const { news, isLoading, isOffline, hasCachedData, isRefreshing, retry } = useNews(companyId);

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

      {/* News articles */}
      {news.length > 0 && (
        <>
          {news.map((article: any) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="block p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-md active:bg-gray-100 dark:active:bg-gray-750 hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
            >
              <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-2">
                <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                  {article.source}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400 shrink-0">
                  {new Date(article.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h4 className="font-bold text-xs sm:text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {article.title}
              </h4>
              <div className="flex items-center gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400 group-hover:text-blue-400 transition-colors">
                <ExternalLink size={10} className="sm:w-3 sm:h-3" />
                <span>Read full article</span>
              </div>
            </a>
          ))}
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
