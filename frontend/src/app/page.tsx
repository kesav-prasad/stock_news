'use client';

import { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Search, BarChart3, SlidersHorizontal, Heart, Star, Trash2 } from 'lucide-react';
import StockGrid from '@/components/StockGrid';
import CompanyModal from '@/components/CompanyModal';
import { useWatchlist } from '@/hooks/useWatchlist';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

type ViewTab = 'all' | 'watchlist';

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [exchange, setExchange] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');

  const {
    watchlistIds,
    toggleWatchlist,
    isInWatchlist,
    watchlistCount,
    clearWatchlist,
    hydrated,
  } = useWatchlist();

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/companies?limit=5000`);
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    staleTime: Infinity,
  });

  const allCompanies: Company[] = data?.companies || [];
  const total = data?.total || 0;

  const displayedCompanies = useMemo(() => {
    let list = allCompanies;

    if (activeTab === 'watchlist') {
      list = list.filter((c) => watchlistIds.has(c.id));
    }

    if (exchange) {
      list = list.filter(c => c.exchange === exchange);
    }

    if (deferredSearchTerm) {
      const lowerSearch = deferredSearchTerm.toLowerCase();
      list = list.filter(
        c => c.name.toLowerCase().includes(lowerSearch) || c.symbol.toLowerCase().includes(lowerSearch)
      );
    }

    return list;
  }, [activeTab, allCompanies, watchlistIds, exchange, deferredSearchTerm]);

  const statsText = useMemo(() => {
    if (activeTab === 'watchlist') {
      const shown = displayedCompanies.length;
      return `${shown} company${shown !== 1 ? 'ies' : ''} in your watchlist`;
    }
    return `Showing ${displayedCompanies.length} of ${total} companies`;
  }, [activeTab, displayedCompanies.length, total]);

  // Stable callbacks so StockGrid never re-renders from new function refs
  const handleSelectCompany = useCallback((c: Company) => setSelectedCompany(c), []);
  const handleCloseModal = useCallback(() => setSelectedCompany(null), []);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 px-3 sm:px-4 md:px-8 py-3 md:py-4">
        <div className="max-w-7xl mx-auto">
          {/* Top row: Logo + Search + Theme */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent leading-tight">
                  StockNews
                </h1>
                <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium">
                  NSE & BSE • AI-Deduplicated News
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'watchlist' ? 'Search watchlist...' : 'Search company or symbol...'}
                className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter toggle (mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400"
            >
              <SlidersHorizontal size={18} />
            </button>

            {/* Exchange filter (desktop) */}
            <select
              className="hidden sm:block py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
            >
              <option value="">All</option>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>

            <ThemeToggle />
          </div>

          {/* Tab bar + mobile filters */}
          <div className="mt-3 flex items-center gap-2">
            {/* View tabs — pure CSS, no framer */}
            <div className="flex bg-gray-100 dark:bg-gray-800/80 p-0.5 sm:p-1 rounded-lg sm:rounded-xl">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <BarChart3 size={14} className="sm:w-4 sm:h-4" />
                <span>All</span>
              </button>

              <button
                onClick={() => setActiveTab('watchlist')}
                className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
                  activeTab === 'watchlist'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Heart
                  size={14}
                  className={`sm:w-4 sm:h-4 ${
                    activeTab === 'watchlist' ? 'fill-amber-500 text-amber-500' : ''
                  }`}
                />
                <span>Watchlist</span>
                {hydrated && watchlistCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 min-w-[18px] text-center leading-none">
                    {watchlistCount}
                  </span>
                )}
              </button>
            </div>

            {/* Clear watchlist button */}
            {activeTab === 'watchlist' && watchlistCount > 0 && (
              <button
                onClick={clearWatchlist}
                className="ml-auto flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={13} className="sm:w-[14px] sm:h-[14px]" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}

            {/* Mobile exchange filters */}
            {showFilters && (
              <div className="sm:hidden flex gap-1.5 ml-auto">
                {['', 'NSE', 'BSE'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setExchange(val)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      exchange === val
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {val || 'All'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-8 py-3 md:py-4 flex flex-col">
        {/* Stats bar */}
        {!isLoading && !error && (
          <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {statsText}
          </div>
        )}

        <main className="flex-1 rounded-xl sm:rounded-2xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200 dark:border-gray-800 p-1.5 sm:p-2 md:p-4 shadow-sm overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-red-500 font-medium py-20 text-sm px-4 text-center">
              Failed to load data. Ensure the backend is running on port 4000.
            </div>
          ) : displayedCompanies.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 sm:py-20 px-4">
              {activeTab === 'watchlist' ? (
                <div className="flex flex-col items-center text-center max-w-sm">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-4 sm:mb-5">
                    <Star size={28} className="sm:w-9 sm:h-9 text-amber-500" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-1.5 sm:mb-2">
                    Your watchlist is empty
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4 sm:mb-6">
                    Tap the <Heart size={12} className="inline text-amber-500 fill-amber-500 mx-0.5 -mt-0.5" /> icon on any company card to add it to your watchlist for quick access.
                  </p>
                  <button
                    onClick={() => setActiveTab('all')}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Browse Companies
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 font-medium text-sm">
                  No companies found.
                </div>
              )}
            </div>
          ) : (
            <StockGrid
              companies={displayedCompanies}
              onSelectCompany={handleSelectCompany}
              isInWatchlist={isInWatchlist}
              onToggleWatchlist={toggleWatchlist}
            />
          )}
        </main>
      </div>

      {/* Modal */}
      <CompanyModal
        company={selectedCompany}
        onClose={handleCloseModal}
        isWatchlisted={selectedCompany ? isInWatchlist(selectedCompany.id) : false}
        onToggleWatchlist={toggleWatchlist}
      />
    </div>
  );
}
