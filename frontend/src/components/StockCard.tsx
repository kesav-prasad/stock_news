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
      className={`group relative bg-white dark:bg-gray-900/80 border overflow-hidden rounded-xl p-4 cursor-pointer shadow-sm hover:shadow-lg active:scale-[0.98] transition-[box-shadow,transform] duration-150 flex flex-col justify-between h-full ${
        isWatchlisted
          ? 'border-amber-300 dark:border-amber-600/50 ring-1 ring-amber-200/50 dark:ring-amber-700/30'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      {/* Watchlist heart button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatchlist(company.id);
        }}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-full transition-colors duration-150 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-90"
        aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        <Heart
          size={18}
          className={`transition-colors duration-150 ${
            isWatchlisted
              ? 'fill-amber-500 text-amber-500'
              : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500'
          }`}
        />
      </button>

      {/* Company info */}
      <div className="pr-8">
        <h3 className="font-bold text-sm leading-tight dark:text-gray-100 line-clamp-2">{company.name}</h3>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{company.symbol}</p>
      </div>

      {/* Bottom row: exchange badge + news link */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/60">
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          {company.exchange}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-gray-400 group-hover:text-blue-500 transition-colors">
          <Newspaper size={13} />
          <span>News</span>
        </div>
      </div>
    </div>
  );
});

export default StockCard;
