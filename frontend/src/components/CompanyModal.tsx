'use client';

import { useEffect } from 'react';
import { X, Heart } from 'lucide-react';
import NewsPanel from './NewsPanel';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

interface CompanyModalProps {
  company: Company | null;
  onClose: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: (companyId: string) => void;
}

export default function CompanyModal({ company, onClose, isWatchlisted, onToggleWatchlist }: CompanyModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (company) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [company]);

  if (!company) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex justify-between items-start p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="min-w-0 pr-3 flex-1">
            <h2 className="text-lg sm:text-xl font-bold truncate">{company.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs sm:text-sm text-gray-500 font-medium">{company.symbol}</span>
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                {company.exchange}
              </span>
              {company.sector && (
                <span className="text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {company.sector}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onToggleWatchlist(company.id)}
              className={`p-1.5 sm:p-2 rounded-full transition-colors duration-150 ${
                isWatchlisted
                  ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <Heart
                size={18}
                className={`sm:w-5 sm:h-5 transition-colors duration-150 ${
                  isWatchlisted
                    ? 'fill-amber-500 text-amber-500'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* News Panel */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <NewsPanel companyId={company.id} />
        </div>
      </div>
    </div>
  );
}
