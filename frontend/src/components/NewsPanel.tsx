'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, ExternalLink } from 'lucide-react';

export default function NewsPanel({ companyId }: { companyId: string }) {
  const { data: newsItems, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['news', companyId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/companies/${companyId}/news`);
      if (!res.ok) throw new Error('Failed to fetch news');
      return res.json();
    },
    retry: 3,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return (
    <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
        <h3 className="text-base sm:text-lg font-semibold dark:text-gray-100">Latest News</h3>
        <span className="text-[10px] sm:text-xs text-gray-400 ml-auto">No duplicates</span>
      </div>

      {isLoading || (isFetching && !newsItems) ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Loader2 className="animate-spin w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-gray-400">Fetching AI-analyzed news...</span>
        </div>
      ) : error && !isFetching ? (
        <div className="flex flex-col items-center justify-center text-red-500 text-sm py-10 gap-2">
          <span>Failed to load news from Google.</span>
          <button 
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition"
          >
            Try Again
          </button>
        </div>
      ) : newsItems && newsItems.length > 0 ? (
        newsItems.map((news: any) => (
          <a
            key={news.id}
            href={news.url}
            target="_blank"
            rel="noreferrer"
            className="block p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-md active:bg-gray-100 dark:active:bg-gray-750 hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
          >
            <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-2">
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                {news.source}
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400 shrink-0">
                {new Date(news.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <h4 className="font-bold text-xs sm:text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {news.title}
            </h4>
            <div className="flex items-center gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400 group-hover:text-blue-400 transition-colors">
              <ExternalLink size={10} className="sm:w-3 sm:h-3" />
              <span>Read full article</span>
            </div>
          </a>
        ))
      ) : (
        <div className="text-center text-gray-500 text-sm py-10">
          No recent news articles found for this company.
        </div>
      )}
    </div>
  );
}
