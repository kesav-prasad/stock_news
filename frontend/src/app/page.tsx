'use client';

import { useState, useMemo, useDeferredValue, useCallback, useTransition, useEffect } from 'react';
import { Search, BarChart3, Heart, Star, Trash2, WifiOff, X, Clock, User, Moon, Sun, Briefcase } from 'lucide-react';
import StockGrid from '@/components/StockGrid';
import CompanyModal from '@/components/CompanyModal';
import RecentNewsFeed from '@/components/RecentNewsFeed';
import PortfolioView from '@/components/PortfolioView';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useCompanies } from '@/hooks/useCompanies';
import { useNewsNotifications } from '@/hooks/useNewsNotifications';
import { useRecentCompanies } from '@/hooks/useRecentCompanies';
import { useTheme } from 'next-themes';
import { isOnline } from '@/lib/offlineCache';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

type ViewTab = 'all' | 'watchlist' | 'recent' | 'portfolio';

// ★ All 50 Nifty 50 NSE symbols
const NIFTY_50_SYMBOLS = ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','ICICIBANK.NS','BHARTIARTL.NS','INFY.NS','ITC.NS','SBIN.NS','HINDUNILVR.NS','HCLTECH.NS','BAJFINANCE.NS','LT.NS','KOTAKBANK.NS','MARUTI.NS','TATAMOTORS.NS','AXISBANK.NS','SUNPHARMA.NS','ADANIENT.NS','NTPC.NS','TITAN.NS','TATASTEEL.NS','ONGC.NS','POWERGRID.NS','BAJAJFINSV.NS','ASIANPAINT.NS','M&M.NS','ULTRACEMCO.NS','JSWSTEEL.NS','COALINDIA.NS','WIPRO.NS','NESTLEIND.NS','CIPLA.NS','DRREDDY.NS','ADANIPORTS.NS','HINDALCO.NS','TECHM.NS','APOLLOHOSP.NS','EICHERMOT.NS','GRASIM.NS','INDUSINDBK.NS','HEROMOTOCO.NS','BAJAJ-AUTO.NS','HDFCLIFE.NS','BRITANNIA.NS','TRENT.NS','BPCL.NS','TATACONSUM.NS','SHRIRAMFIN.NS','SBILIFE.NS','ETERNAL.NS'];

const NIFTY_50_BSE_MAP: Record<string, string> = {'RELIANCE.NS':'500325.BO','TCS.NS':'532540.BO','HDFCBANK.NS':'532646.BO','ICICIBANK.NS':'532174.BO','BHARTIARTL.NS':'532838.BO','INFY.NS':'532684.BO','ITC.NS':'532694.BO','SBIN.NS':'500112.BO','HINDUNILVR.NS':'532654.BO','HCLTECH.NS':'532281.BO','BAJFINANCE.NS':'532466.BO','KOTAKBANK.NS':'532612.BO','TATAMOTORS.NS':'532800.BO','AXISBANK.NS':'532215.BO','SUNPHARMA.NS':'532710.BO','ADANIENT.NS':'532410.BO','TITAN.NS':'532820.BO','TATASTEEL.NS':'532810.BO','BAJAJFINSV.NS':'532468.BO','ASIANPAINT.NS':'532444.BO','ULTRACEMCO.NS':'532840.BO','JSWSTEEL.NS':'532702.BO','COALINDIA.NS':'532546.BO','CIPLA.NS':'532542.BO','DRREDDY.NS':'532584.BO','ADANIPORTS.NS':'532414.BO','HINDALCO.NS':'500106.BO','APOLLOHOSP.NS':'532434.BO','EICHERMOT.NS':'532588.BO','INDUSINDBK.NS':'532680.BO','HEROMOTOCO.NS':'532650.BO','BAJAJ-AUTO.NS':'532462.BO','HDFCLIFE.NS':'532648.BO','BRITANNIA.NS':'532510.BO','BPCL.NS':'532492.BO','SBILIFE.NS':'532850.BO'};

// ★ Pre-build exchange indexes for instant O(1) filtering
function buildExchangeIndexes(companies: Company[]) {
  const nse: Company[] = [];
  const bse: Company[] = [];
  const nifty50: Company[] = [];
  const nifty50Set = new Set<string>(NIFTY_50_SYMBOLS);

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    if (c.exchange === 'NSE') nse.push(c);
    else if (c.exchange === 'BSE') bse.push(c);
    if (nifty50Set.has(c.symbol)) {
      nifty50.push(c);
    }
  }
  return { NSE: nse, BSE: bse, NIFTY50: nifty50 };
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-[34px] h-[34px]" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="relative w-[34px] h-[34px] p-[2px] rounded-full bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-blue-500 shadow-md group active:scale-95 transition-transform duration-200"
      aria-label="Toggle theme"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-blue-500 rounded-full blur-[6px] opacity-40 group-hover:opacity-75 transition-opacity duration-300 pointer-events-none"></div>
      <div className="w-full h-full rounded-full bg-gradient-to-b from-white to-gray-50 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center relative overflow-hidden shadow-inner">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mix-blend-overlay"></div>
        {theme === 'dark' ? (
          <Moon size={15} className="text-gray-800 dark:text-gray-100 z-10 stroke-[2.5px] drop-shadow-sm" />
        ) : (
          <Sun size={15} className="text-gray-800 dark:text-gray-100 z-10 stroke-[2.5px] drop-shadow-sm" />
        )}
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [exchange, setExchange] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const deferredTab = useDeferredValue(activeTab);
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

  // ★ Navbar tabs should update instantly for immediate visual feedback
  const handleTabChange = useCallback((tab: ViewTab) => {
    setActiveTab(tab);
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
    hydrated: watchlistHydrated,
  } = useWatchlist();

  const { visitedCounts, recordVisit } = useRecentCompanies();

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


  // ★ OFFLINE-FIRST: Companies load with brief animation
  const { companies: allCompanies, total, isLoading: companiesLoading } = useCompanies();

  // ★ Pre-build exchange indexes — only recalculated when data changes, NOT on filter tap
  const exchangeIndexes = useMemo(() => buildExchangeIndexes(allCompanies), [allCompanies]);

  // ★ Optimized filtering — uses pre-built indexes for exchange, avoids re-scanning 2681 items
  const displayedCompanies = useMemo(() => {
    // 1. Start with the right base list based on exchange filter
    let list: Company[];
    if (exchange && exchangeIndexes[exchange as 'NSE' | 'BSE' | 'NIFTY50']) {
      list = exchangeIndexes[exchange as 'NSE' | 'BSE' | 'NIFTY50'];
    } else {
      list = allCompanies;
    }

    // 2. Watchlist filter (Recent tab handles its own data via useRecentNews)
    if (deferredTab === 'watchlist') {
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
  }, [deferredTab, allCompanies, exchangeIndexes, watchlistIds, exchange, deferredSearchTerm]);

  const statsText = useMemo(() => {
    if (deferredTab === 'watchlist') {
      return `${displayedCompanies.length} in watchlist`;
    }
    if (deferredTab === 'recent') {
      return `${displayedCompanies.length} recently viewed`;
    }
    return `${displayedCompanies.length} of ${total}`;
  }, [deferredTab, displayedCompanies.length, total]);

  const handleSelectCompany = useCallback((c: Company) => {
    recordVisit(c.id);
    setSelectedCompany(c);
  }, [recordVisit]);
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

            <ThemeToggle />
          </div>

          {/* Search bar — full width */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search company or symbol..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Exchange filter chips + stats — ★ wrapped in startTransition */}
          {deferredTab === 'all' && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mb-1 max-w-full">
                {[
                  { label: 'All', value: '' },
                  { label: 'Nifty 50', value: 'NIFTY50' },
                  { label: 'NSE', value: 'NSE' },
                  { label: 'BSE', value: 'BSE' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => handleExchangeChange(item.value)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors duration-150 ${
                      exchange === item.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Stats text hidden as requested */}
            </div>
          )}

          {/* Watchlist header */}
          {deferredTab === 'watchlist' && (
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
      <main className="flex-1 overflow-hidden flex flex-col pb-16 min-h-0">
        <div className={`flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-8 py-2 sm:py-3 flex flex-col overflow-hidden min-h-0 transition-opacity duration-150 ${activeTab !== deferredTab ? 'opacity-60' : 'opacity-100'}`}>
          {/* Portfolio tab */}
          {deferredTab === 'portfolio' ? (
            <PortfolioView />
          ) : deferredTab === 'recent' ? (
            <RecentNewsFeed
              allCompanies={allCompanies}
              watchlistIds={watchlistIds}
              visitedCounts={visitedCounts}
            />
          ) : companiesLoading ? (
            /* ★ LOADING SKELETON: Shown during initial ~400ms load */
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
              {deferredSearchTerm ? (
                <div className="text-gray-500 font-medium text-sm">
                  No companies match your search.
                </div>
              ) : deferredTab === 'watchlist' ? (
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
              ) : null}
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
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 transition-colors ${
              activeTab === 'all'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <BarChart3 size={22} className={activeTab === 'all' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-semibold">Dashboard</span>
          </button>
          
          <button
            onClick={() => handleTabChange('recent')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 transition-colors ${
              activeTab === 'recent'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <Clock size={22} className={activeTab === 'recent' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-semibold">Recent</span>
          </button>

          <button
            onClick={() => handleTabChange('portfolio')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 transition-colors ${
              activeTab === 'portfolio'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <Briefcase size={22} className={activeTab === 'portfolio' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-semibold">Portfolio</span>
          </button>

          <button
            onClick={() => handleTabChange('watchlist')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pt-3 transition-colors ${
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
