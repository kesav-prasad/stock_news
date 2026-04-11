'use client';

import { memo } from 'react';
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
  return (
    <div
      onClick={() => onSelect(company)}
      className={`group relative bg-white dark:bg-gray-900/80 border overflow-hidden rounded-xl cursor-pointer shadow-sm hover:shadow-lg active:scale-[0.98] transition-[box-shadow,transform] duration-150 ${
        isWatchlisted
          ? 'border-amber-300 dark:border-amber-600/50 ring-1 ring-amber-200/50 dark:ring-amber-700/30'
          : 'border-gray-200 dark:border-gray-800'
      }`}
      style={{ height: '96px' }}
    >
      {/* Card inner layout — fixed height, no flex-grow */}
      <div className="p-3.5 h-full flex flex-col">
        {/* Top section: Company name + symbol + heart */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[13px] leading-snug dark:text-gray-100 truncate">{company.name}</h3>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">{company.symbol}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchlist(company.id);
            }}
            className="shrink-0 p-1 rounded-full transition-colors duration-150 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-90 -mt-0.5 -mr-0.5"
            aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Heart
              size={16}
              className={`transition-colors duration-150 ${
                isWatchlisted
                  ? 'fill-amber-500 text-amber-500'
                  : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500'
              }`}
            />
          </button>
        </div>

        {/* Bottom row: exchange badge + news — pushed to bottom */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-gray-800/50">
          <span className="text-[10px] font-semibold px-1.5 py-[2px] rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            {company.exchange}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 group-hover:text-blue-500 transition-colors">
            <Newspaper size={11} />
            <span>News</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StockCard;
