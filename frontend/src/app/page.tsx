'use client';

import { useState, useMemo, useDeferredValue, useCallback, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, BarChart3, Heart, Star, Trash2, Newspaper } from 'lucide-react';
import StockGrid from '@/components/StockGrid';
import CompanyModal from '@/components/CompanyModal';
import { useWatchlist } from '@/hooks/useWatchlist';
import { SignInButton, UserButton, useUser } from '@clerk/clerk-react';

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
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [isPending, startTransition] = useTransition();

  const handleTabChange = useCallback((tab: ViewTab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  }, []);

  const {
    watchlistIds,
    toggleWatchlist,
    isInWatchlist,
    watchlistCount,
    clearWatchlist,
    hydrated,
  } = useWatchlist();

  const { isSignedIn } = useUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';
      const res = await fetch(`${baseUrl}/api/companies?limit=5000`);
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 30000),
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
      return `${shown} in watchlist`;
    }
    return `${displayedCompanies.length} of ${total}`;
  }, [activeTab, displayedCompanies.length, total]);

  // Stable callbacks so StockGrid never re-renders from new function refs
  const handleSelectCompany = useCallback((c: Company) => setSelectedCompany(c), []);
  const handleCloseModal = useCallback(() => setSelectedCompany(null), []);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ====== HEADER ====== */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-800/80 px-4 pt-3 pb-2 sm:px-6 md:px-8 sm:py-4">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Top row: Logo + Auth */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent leading-tight">
                StockNews
              </h1>
            </div>

            {/* Auth */}
            <div className="flex items-center">
              {!isSignedIn ? (
                <SignInButton mode="modal">
                  <button className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all">
                    Sign In
                  </button>
                </SignInButton>
              ) : (
                <div className="flex items-center justify-center p-0.5 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-950">
                  <UserButton />
                </div>
              )}
            </div>
          </div>

          {/* Search bar — full width */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search company or symbol..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Exchange filter chips + stats */}
          {activeTab === 'all' && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {[
                  { label: 'All', value: '' },
                  { label: 'NSE', value: 'NSE' },
                  { label: 'BSE', value: 'BSE' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setExchange(item.value)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                      exchange === item.value
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {!isLoading && !error && (
                <span className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums">
                  {statsText}
                </span>
              )}
            </div>
          )}

          {/* Watchlist header */}
          {activeTab === 'watchlist' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Your Watchlist
              </span>
              {watchlistCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                  {watchlistCount}
                </span>
              )}
              {watchlistCount > 0 && (
                <button
                  onClick={clearWatchlist}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ====== MAIN CONTENT ====== */}
      <main className="flex-1 overflow-hidden flex flex-col pb-16">
        <div className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-8 py-2 sm:py-3 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
              <span className="text-xs text-gray-400 animate-pulse">Loading companies...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-red-500 font-medium py-20 text-sm px-4 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <Newspaper size={24} className="text-red-400" />
              </div>
              <span>Failed to load data. Please check your internet connection and try again.</span>
            </div>
          ) : displayedCompanies.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4">
              {activeTab === 'watchlist' ? (
                <div className="flex flex-col items-center text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-4">
                    <Star size={28} className="text-amber-500" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1.5">
                    Your watchlist is empty
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
                    Tap the <Heart size={12} className="inline text-amber-500 fill-amber-500 mx-0.5 -mt-0.5" /> icon on any company card to add it here.
                  </p>
                  <button
                    onClick={() => handleTabChange('all')}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
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
              isPending={isPending}
            />
          )}
        </div>
      </main>

      {/* ====== BOTTOM NAVIGATION BAR ====== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-200/80 dark:border-gray-800/80 safe-area-bottom">
        <div className="max-w-7xl mx-auto flex">
          <button
            onClick={() => handleTabChange('all')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 transition-colors duration-150 ${
              activeTab === 'all'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <BarChart3 size={22} className={activeTab === 'all' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-semibold">Dashboard</span>
          </button>
          <button
            onClick={() => handleTabChange('watchlist')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 transition-colors duration-150 ${
              activeTab === 'watchlist'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <Heart
              size={22}
              className={activeTab === 'watchlist' ? 'fill-current stroke-[2.5px]' : ''}
            />
            <span className="text-[10px] font-semibold">Watchlist</span>
          </button>
        </div>
      </nav>

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
