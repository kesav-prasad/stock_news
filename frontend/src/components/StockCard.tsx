'use client';

import { memo, useCallback } from 'react';
import { Newspaper, Heart } from 'lucide-react';

interface StockCardProps {
  company: {
    id: string;
    name: string;
    symbol: string;
    exchange: string;
    sector?: string;
  };
  onSelect: (company: StockCardProps['company']) => void;
  isWatchlisted: boolean;
  onToggleWatchlist: (companyId: string) => void;
}

const StockCard = memo(function StockCard({ company, onSelect, isWatchlisted, onToggleWatchlist }: StockCardProps) {
  // Stable callbacks to avoid re-renders
  const handleSelect = useCallback(() => onSelect(company), [onSelect, company]);
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWatchlist(company.id);
  }, [onToggleWatchlist, company.id]);

  return (
    <div
      onClick={handleSelect}
      className={`group relative bg-white dark:bg-gray-900/80 border overflow-hidden rounded-xl cursor-pointer will-change-auto ${
        isWatchlisted
          ? 'border-amber-300 dark:border-amber-600/50'
          : 'border-gray-200 dark:border-gray-800'
      }`}
      style={{ height: '100%' }}
    >
      {/* Card inner layout — bigger, roomier */}
      <div className="p-4 h-full flex flex-col">
        {/* Top section: Company name + symbol + heart */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[15px] leading-snug dark:text-gray-100 line-clamp-2 break-words pr-2">{company.name}</h3>
            <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mt-1">{company.symbol}</p>
          </div>
          {/* ★ BIGGER heart button — 44px tap target minimum */}
          <button
            onClick={handleToggle}
            className={`shrink-0 flex items-center justify-center w-11 h-11 -mt-1 -mr-1 rounded-full ${
              isWatchlisted
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'active:bg-gray-100 dark:active:bg-gray-800'
            }`}
            aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Heart
              size={20}
              className={
                isWatchlisted
                  ? 'fill-amber-500 text-amber-500'
                  : 'text-gray-300 dark:text-gray-600'
              }
            />
          </button>
        </div>

        {/* Bottom row: exchange badge + news — pushed to bottom */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-gray-800/50">
          <span className="text-[11px] font-semibold px-2 py-[3px] rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            {company.exchange}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Newspaper size={12} />
            <span>News</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StockCard;
