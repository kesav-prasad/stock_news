'use client';

import { memo, useCallback, useState } from 'react';
import { Globe, Newspaper, RefreshCw, TrendingUp, Zap, Bookmark, Sparkles } from 'lucide-react';
import { useRecentNews } from '@/hooks/useRecentNews';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useBriefing } from '@/hooks/useBriefing';
import TypewriterText from './TypewriterText';
import { openInAppBrowser } from '@/lib/inAppBrowser';

// ─── Helpers ────────────────────────────────────────────────

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffInMinutes = Math.floor(diffMs / 60000);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Generate a consistent gradient for a ticker symbol
function getTickerGradient(symbol: string): string {
  const gradients = [
    'from-blue-500 to-cyan-400',
    'from-violet-500 to-purple-400',
    'from-emerald-500 to-teal-400',
    'from-orange-500 to-amber-400',
    'from-rose-500 to-pink-400',
    'from-indigo-500 to-blue-400',
    'from-fuchsia-500 to-pink-400',
    'from-teal-500 to-emerald-400',
    'from-sky-500 to-cyan-400',
    'from-amber-500 to-yellow-400',
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

// ─── Skeleton Loader ────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex gap-3.5 p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-gray-100/80 dark:border-gray-800/40">
      <div className="shrink-0 w-11 h-11 rounded-[13px] skeleton-shimmer" />
      <div className="flex-1 space-y-2.5 pt-0.5">
        <div className="flex justify-between items-center">
          <div className="h-3 w-14 rounded-full skeleton-shimmer" />
          <div className="h-3 w-16 rounded-full skeleton-shimmer" />
        </div>
        <div className="h-4 w-full rounded-lg skeleton-shimmer" />
        <div className="h-4 w-3/5 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}

// ─── Individual News Card ───────────────────────────────────

interface NewsCardProps {
  article: {
    id: string;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    sentiment?: 'bullish' | 'bearish' | 'neutral';
  };
  company: {
    id: string;
    name: string;
    symbol: string;
  };
  isBookmarked?: boolean;
  onToggleBookmark?: (e: React.MouseEvent) => void;
}

const NewsCard = memo(function NewsCard({ article, company, isBookmarked, onToggleBookmark }: NewsCardProps) {
  const handleClick = useCallback(() => {
    openInAppBrowser(article.url);
  }, [article.url]);

  const gradient = getTickerGradient(article.source);
  const timeAgo = formatTimeAgo(article.publishedAt);
  const isRecent = Date.now() - new Date(article.publishedAt).getTime() < 3600000; // < 1 hour

  return (
    <div
      onClick={handleClick}
      className={`
        group relative block w-full cursor-pointer text-left transition-all duration-150 active:translate-y-[2px] active:scale-[0.985] active:brightness-95 dark:active:brightness-105 active:shadow-none
        p-4 rounded-2xl bg-white dark:bg-white/[0.035] border border-gray-100/80 dark:border-gray-800/50 shadow-[0_1px_3px_rgb(0,0,0,0.02)] dark:shadow-none hover:shadow-[0_4px_16px_rgb(0,0,0,0.06)] hover:border-gray-200 dark:hover:border-gray-700/80
      `}
    >
      <div className="flex items-start gap-3.5">
        {/* Source Avatar with gradient */}
        <div
          className={`shrink-0 w-11 h-11 rounded-[13px] bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}
        >
          <span className="font-bold text-white text-[14px] drop-shadow-sm">
            {article.source.substring(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          {/* Source name + Time */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-extrabold text-[12px] tracking-wide text-gray-900 dark:text-gray-100">
              {article.source}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {isRecent && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
                  <Zap size={8} className="fill-current" />
                  NEW
                </span>
              )}
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium tabular-nums">
                {timeAgo}
              </span>
            </div>
          </div>

          {/* Headline */}
          <h3
            className={`
              font-semibold leading-[1.45] text-gray-800 dark:text-gray-200 
              group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors
              text-[14px] sm:text-[15px] line-clamp-3
            `}
          >
            {article.title}
          </h3>

          {/* Read indicator & Badges */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1 text-[10px] text-gray-300 dark:text-gray-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 transition-colors">
              <Newspaper size={10} />
              <span className="font-medium">Read</span>
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
              {onToggleBookmark && (
                <button
                  onClick={onToggleBookmark}
                  className={`p-1.5 -mr-1.5 rounded-full transition-all duration-300 active:scale-75 ${
                    isBookmarked
                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : 'text-gray-300 dark:text-gray-600 hover:text-amber-500'
                  }`}
                >
                  <Bookmark size={14} className={isBookmarked ? 'fill-current' : ''} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Main Component ─────────────────────────────────────────

interface RecentNewsFeedProps {
  allCompanies: { id: string; name: string; symbol: string }[];
  watchlistIds: Set<string>;
  visitedCounts: Record<string, number>;
}

export default function RecentNewsFeed({ allCompanies, watchlistIds, visitedCounts }: RecentNewsFeedProps) {
  const [viewMode, setViewMode] = useState<'feed' | 'saved'>('feed');
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();

  const { allNews, isLoading, refetch } = useRecentNews(
    allCompanies,
    watchlistIds,
    visitedCounts,
  );
  
  const { briefing, isLoading: isBriefingLoading } = useBriefing(allNews);

  const hasData = allNews.length > 0;
  const isEmpty = !isLoading && !hasData;

  return (
    <div className="flex-1 w-full relative min-h-0 h-full">
      <div 
        className="absolute inset-0 overflow-y-auto overscroll-contain pt-1 pb-16"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex flex-col min-h-full">
          {/* ─── Header ─── */}
      <div className="flex flex-col px-4 pt-2 pb-3 mb-1 shrink-0 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500 dark:text-blue-400" />
            <h1 className="text-[17px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
              Market News
            </h1>
          </div>
          <button
            onClick={refetch}
            disabled={isLoading && viewMode === 'feed'}
            className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-40"
            aria-label="Refresh news"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-gray-100/80 dark:bg-gray-800/50 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('feed')}
            className={`flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-all ${
              viewMode === 'feed'
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 opacity-80'
            }`}
          >
            Live Feed
          </button>
          <button
            onClick={() => setViewMode('saved')}
            className={`flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'saved'
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 opacity-80'
            }`}
          >
            Saved
            {bookmarks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-gray-800 text-amber-600 dark:text-amber-400 text-[10px] leading-tight">
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {viewMode === 'saved' ? (
        <div className="px-3 sm:px-4 flex-1">
          {bookmarks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-5">
                <Bookmark size={28} className="text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
                No saved articles
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
                Articles you bookmark will appear offline here for reading later.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 pb-6">
              {bookmarks.map((item) => (
                <NewsCard
                  key={`b-${item.article.id || item.article.url}`}
                  article={item.article}
                  company={item.company}
                  isBookmarked={true}
                  onToggleBookmark={(e) => {
                    e.stopPropagation();
                    toggleBookmark(item);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* ─── AI Morning Briefing ─── */}
      {!isLoading && allNews.length > 0 && (
        <div className="px-3 sm:px-4 mb-6">
          <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-blue-500/30 shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
            <div className="relative bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl p-4 sm:p-5 rounded-[15px]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight">
                  Morning Briefing
                </h3>
              </div>
              {isBriefingLoading && !briefing ? (
                <div className="space-y-1.5 animate-pulse mt-3">
                  <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full" />
                  <div className="h-2.5 w-5/6 bg-gray-200 dark:bg-gray-800 rounded-full" />
                </div>
              ) : (
                <p className="text-[13px] sm:text-[14px] leading-relaxed font-medium text-gray-700 dark:text-gray-300">
                  <TypewriterText
                    text={briefing || "The AI is analyzing the latest market data. Check back shortly for your personalized summary."}
                    speed={20}
                    startDelay={400}
                  />
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Loading State (only when no cached data) ─── */}
      {isLoading && allNews.length === 0 && (
        <div className="space-y-2.5 px-3 sm:px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={`sk-${i}`} />
          ))}
        </div>
      )}

      {/* ─── Empty State ─── */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 flex items-center justify-center mb-5">
            <Newspaper size={28} className="text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
            No news available right now
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed max-w-[280px]">
            News will appear here once your companies have recent articles. Try refreshing later.
          </p>
        </div>
      )}

      {/* ─── Chronological News Feed ─── */}
      {hasData && (
        <section className="px-3 sm:px-4 mb-4">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
              <Globe size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  Latest Headlines
                </h2>
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tabular-nums">
                  {allNews.length}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                Indian share market · newest first
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            {allNews.map((item) => (
              <NewsCard
                key={`n-${item.article.id || item.article.url}-${item.company.id}`}
                article={item.article}
                company={item.company}
                isBookmarked={isBookmarked(item.article.url)}
                onToggleBookmark={(e) => {
                  e.stopPropagation();
                  toggleBookmark(item);
                }}
              />
            ))}
          </div>
        </section>
      )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}
