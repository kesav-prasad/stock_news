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
      className={`group relative bg-white dark:bg-gray-900 border overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 cursor-pointer shadow-sm hover:shadow-lg active:scale-[0.98] transition-[box-shadow,transform] duration-150 flex flex-col justify-between h-full ${
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
        className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 p-1.5 rounded-full transition-colors duration-150 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-90"
        aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        <Heart
          size={16}
          className={`sm:w-[18px] sm:h-[18px] transition-colors duration-150 ${
            isWatchlisted
              ? 'fill-amber-500 text-amber-500'
              : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500'
          }`}
        />
      </button>

      <div className="flex justify-between items-start mb-2 sm:mb-3 pr-7 sm:pr-8">
        <div className="truncate pr-2 min-w-0">
          <h3 className="font-bold text-sm sm:text-base leading-tight dark:text-gray-100 truncate">{company.name}</h3>
          <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">{company.symbol}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
          <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
            {company.exchange}
          </span>
          {company.sector && (
            <span className="text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 truncate">
              {company.sector}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 group-hover:text-blue-500 transition-colors shrink-0 ml-2">
          <Newspaper size={12} className="sm:w-[14px] sm:h-[14px]" />
          <span className="hidden sm:inline">News</span>
        </div>
      </div>
    </div>
  );
});

export default StockCard;
