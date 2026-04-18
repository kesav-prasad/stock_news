'use client';

import { memo, useCallback, useMemo } from 'react';
import { Flame, Globe, Newspaper, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { useRecentNews } from '@/hooks/useRecentNews';
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
  };
  company: {
    id: string;
    name: string;
    symbol: string;
  };
  isCompact?: boolean;
}

const NewsCard = memo(function NewsCard({ article, company, isCompact }: NewsCardProps) {
  const handleClick = useCallback(() => {
    openInAppBrowser(article.url);
  }, [article.url]);

  const gradient = getTickerGradient(company.symbol);
  const timeAgo = formatTimeAgo(article.publishedAt);
  const isRecent = Date.now() - new Date(article.publishedAt).getTime() < 3600000; // < 1 hour

  return (
    <button
      onClick={handleClick}
      className={`
        group relative block w-full text-left transition-all duration-200
        ${isCompact
          ? 'p-3.5 rounded-xl bg-white/40 dark:bg-white/[0.02] border border-gray-100/60 dark:border-gray-800/30 hover:bg-white/70 dark:hover:bg-white/[0.04]'
          : 'p-4 rounded-2xl bg-white dark:bg-white/[0.035] border border-gray-100/80 dark:border-gray-800/50 shadow-[0_1px_3px_rgb(0,0,0,0.02)] dark:shadow-none hover:shadow-[0_4px_16px_rgb(0,0,0,0.06)] hover:border-gray-200 dark:hover:border-gray-700/80'
        }
      `}
    >
      <div className="flex items-start gap-3.5">
        {/* Company Avatar with gradient */}
        <div
          className={`shrink-0 ${isCompact ? 'w-10 h-10 rounded-xl' : 'w-11 h-11 rounded-[13px]'} bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}
        >
          <span className={`font-bold text-white ${isCompact ? 'text-[13px]' : 'text-[14px]'} drop-shadow-sm`}>
            {company.symbol.substring(0, 2)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          {/* Metadata: Ticker · Source · Time */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold text-[12px] tracking-wide text-gray-900 dark:text-gray-100 uppercase shrink-0">
                {company.symbol}
              </span>
              <span className="w-[3px] h-[3px] rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium truncate">
                {article.source}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isRecent && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full">
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
              ${isCompact ? 'text-[13px] line-clamp-2' : 'text-[14px] sm:text-[15px] line-clamp-3'}
            `}
          >
            {article.title}
          </h3>

          {/* Read indicator on hover */}
          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-300 dark:text-gray-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 transition-colors">
            <Newspaper size={10} />
            <span className="font-medium">Read article</span>
          </div>
        </div>
      </div>
    </button>
  );
});

// ─── Section Header ─────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  accentColor,
  count,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  title: string;
  subtitle: string;
  accentColor: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <div className={`p-2 rounded-xl ${accentColor}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {title}
          </h2>
          {count !== undefined && count > 0 && (
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tabular-nums">
              {count}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface RecentNewsFeedProps {
  allCompanies: { id: string; name: string; symbol: string }[];
  watchlistIds: Set<string>;
  visitedCounts: Record<string, number>;
}

export default function RecentNewsFeed({ allCompanies, watchlistIds, visitedCounts }: RecentNewsFeedProps) {
  const { priorityNews, otherNews, isLoading, refetch } = useRecentNews(
    allCompanies,
    watchlistIds,
    visitedCounts,
  );

  const hasPriorityData = priorityNews.length > 0;
  const hasOtherData = otherNews.length > 0;
  const isEmpty = !isLoading && !hasPriorityData && !hasOtherData;

  // Memoize priority subtitle
  const prioritySubtitle = useMemo(() => {
    const wlCount = watchlistIds.size;
    const visitCount = Object.keys(visitedCounts).length;
    if (wlCount > 0 && visitCount > 0) return `From ${wlCount} watchlisted & ${visitCount} viewed companies`;
    if (wlCount > 0) return `From ${wlCount} watchlisted companies`;
    if (visitCount > 0) return `From ${visitCount} recently viewed companies`;
    return 'Add companies to watchlist for priority updates';
  }, [watchlistIds.size, Object.keys(visitedCounts).length]);

  return (
    <div className="flex-1 w-full flex flex-col pt-1 pb-6 overflow-y-auto overscroll-contain">
      {/* ─── Pull-to-refresh header ─── */}
      <div className="flex items-center justify-between px-4 py-2 mb-1">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500 dark:text-blue-400" />
          <h1 className="text-[17px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
            Market News
          </h1>
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-40"
          aria-label="Refresh news"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ─── Loading State ─── */}
      {isLoading && priorityNews.length === 0 && otherNews.length === 0 && (
        <div className="space-y-6 px-3 sm:px-4">
          {/* Priority skeleton */}
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 rounded-full skeleton-shimmer" />
                <div className="h-2.5 w-44 rounded-full skeleton-shimmer" />
              </div>
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={`p-${i}`} />
              ))}
            </div>
          </div>
          {/* Other skeleton */}
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 rounded-full skeleton-shimmer" />
                <div className="h-2.5 w-36 rounded-full skeleton-shimmer" />
              </div>
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={`o-${i}`} />
              ))}
            </div>
          </div>
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

      {/* ─── Priority News Section ─── */}
      {hasPriorityData && (
        <section className="px-3 sm:px-4 mb-6">
          <SectionHeader
            icon={Flame}
            title="Your Priority Feed"
            subtitle={prioritySubtitle}
            accentColor="bg-gradient-to-br from-orange-500 to-rose-500"
            count={priorityNews.length}
          />
          <div className="space-y-2.5">
            {priorityNews.map((item) => (
              <NewsCard
                key={`p-${item.article.id}-${item.company.id}`}
                article={item.article}
                company={item.company}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Divider between sections ─── */}
      {hasPriorityData && hasOtherData && (
        <div className="mx-6 mb-5 border-t border-gray-100 dark:border-gray-800/60" />
      )}

      {/* ─── Other Companies News ─── */}
      {hasOtherData && (
        <section className="px-3 sm:px-4 mb-4">
          <SectionHeader
            icon={Globe}
            title="Market Headlines"
            subtitle="Latest from popular companies"
            accentColor="bg-gradient-to-br from-blue-500 to-cyan-500"
            count={otherNews.length}
          />
          <div className="space-y-2">
            {otherNews.map((item) => (
              <NewsCard
                key={`o-${item.article.id}-${item.company.id}`}
                article={item.article}
                company={item.company}
                isCompact
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
