'use client';

import { useState, useMemo, useDeferredValue, useCallback, useTransition, useEffect, useRef } from 'react';
import { Search, BarChart3, Heart, Star, Trash2, WifiOff } from 'lucide-react';
import StockGrid from '@/components/StockGrid';
import CompanyModal from '@/components/CompanyModal';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useCompanies } from '@/hooks/useCompanies';
import { useNewsNotifications } from '@/hooks/useNewsNotifications';
import { SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { isOnline } from '@/lib/offlineCache';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

type ViewTab = 'all' | 'watchlist';

// ★ Pre-build exchange indexes for instant O(1) filtering
function buildExchangeIndexes(companies: Company[]) {
  const nse: Company[] = [];
  const bse: Company[] = [];
  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    if (c.exchange === 'NSE') nse.push(c);
    else if (c.exchange === 'BSE') bse.push(c);
  }
  return { NSE: nse, BSE: bse };
}

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [exchange, setExchange] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [isPending, startTransition] = useTransition();
  const [networkStatus, setNetworkStatus] = useState(true);

  // Monitor network status
  useEffect(() => {
    setNetworkStatus(isOnline());
    const handleOnline = () => setNetworkStatus(true);
    const handleOffline = () => setNetworkStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ★ Wrap ALL filter changes in startTransition so UI stays responsive
  const handleTabChange = useCallback((tab: ViewTab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  }, []);

  const handleExchangeChange = useCallback((value: string) => {
    startTransition(() => {
      setExchange(value);
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

  // Initialize push notifications
  useNewsNotifications((companyId: string) => {
    // We defer finding the company inside the callback. Note that `allCompanies` is updated globally.
    // If the notification returns, find the company in our list or create a base dummy if not loaded yet.
    startTransition(() => {
      const targetCompany = allCompanies.find(c => c.id === companyId);
      if (targetCompany) {
        setSelectedCompany(targetCompany);
      } else {
        // Fallback stub if it hasn't finished loading all companies yet
        setSelectedCompany({ id: companyId, name: 'Loading...', symbol: '', exchange: '' });
      }
    });
  });

  const { isSignedIn } = useUser();

  // ★ OFFLINE-FIRST: Companies load with brief animation
  const { companies: allCompanies, total, isLoading: companiesLoading } = useCompanies();

  // ★ Pre-build exchange indexes — only recalculated when data changes, NOT on filter tap
  const exchangeIndexes = useMemo(() => buildExchangeIndexes(allCompanies), [allCompanies]);

  // ★ Optimized filtering — uses pre-built indexes for exchange, avoids re-scanning 2681 items
  const displayedCompanies = useMemo(() => {
    // 1. Start with the right base list based on exchange filter
    let list: Company[];
    if (exchange && exchangeIndexes[exchange as 'NSE' | 'BSE']) {
      list = exchangeIndexes[exchange as 'NSE' | 'BSE'];
    } else {
      list = allCompanies;
    }

    // 2. Watchlist filter
    if (activeTab === 'watchlist') {
      list = list.filter((c) => watchlistIds.has(c.id));
    }

    // 3. Search filter
    if (deferredSearchTerm) {
      const lowerSearch = deferredSearchTerm.toLowerCase();
      list = list.filter(
        c => c.name.toLowerCase().includes(lowerSearch) || c.symbol.toLowerCase().includes(lowerSearch)
      );
    }

    return list;
  }, [activeTab, allCompanies, exchangeIndexes, watchlistIds, exchange, deferredSearchTerm]);

  const statsText = useMemo(() => {
    if (activeTab === 'watchlist') {
      return `${displayedCompanies.length} in watchlist`;
    }
    return `${displayedCompanies.length} of ${total}`;
  }, [activeTab, displayedCompanies.length, total]);

  const handleSelectCompany = useCallback((c: Company) => setSelectedCompany(c), []);
  const handleCloseModal = useCallback(() => setSelectedCompany(null), []);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ====== OFFLINE BANNER ====== */}
      {!networkStatus && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff size={13} className="text-amber-500" />
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Offline mode — showing saved data
          </span>
        </div>
      )}

      {/* ====== HEADER — NO backdrop-blur (kills perf on budget phones) ====== */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200/80 dark:border-gray-800/80 px-4 pt-3 pb-2 sm:px-6 md:px-8 sm:py-4">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Top row: Logo + Auth */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
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
                  <button className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl">
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

          {/* Exchange filter chips + stats — ★ wrapped in startTransition */}
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
                    onClick={() => handleExchangeChange(item.value)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold ${
                      exchange === item.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <span className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums">
                {statsText}
              </span>
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
                  className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 dark:text-red-400"
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
          {/* ★ LOADING SKELETON: Shown during initial ~400ms load */}
          {companiesLoading ? (
            <div className="flex flex-col gap-2.5 py-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-shimmer rounded-xl border border-gray-100 dark:border-gray-800/50 h-[120px] flex items-center px-4"
                >
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-28 rounded-full bg-gray-200/60 dark:bg-gray-700/40" />
                    <div className="h-4.5 w-52 rounded-full bg-gray-200/80 dark:bg-gray-700/60" />
                    <div className="h-3 w-20 rounded-full bg-gray-200/50 dark:bg-gray-700/30" />
                  </div>
                  <div className="h-11 w-11 rounded-full bg-gray-200/50 dark:bg-gray-700/30" />
                </div>
              ))}
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
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl"
                  >
                    Browse Companies
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 font-medium text-sm">
                  No companies match your search.
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
        </div>
      </main>

      {/* ====== BOTTOM NAVIGATION BAR — NO backdrop-blur ====== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200/80 dark:border-gray-800/80 safe-area-bottom">
        <div className="max-w-7xl mx-auto flex">
          <button
            onClick={() => handleTabChange('all')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 ${
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
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 ${
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
