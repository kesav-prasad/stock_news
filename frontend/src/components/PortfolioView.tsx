'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Briefcase, LogOut, RefreshCw, TrendingUp, TrendingDown, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';

const BROKER_STORAGE_KEY = 'angel_one_credentials';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://stocknews-backend.onrender.com';

interface Holding {
  tradingsymbol: string;
  exchange: string;
  quantity: string;
  averageprice: string;
  ltp: string;
  profitandloss: string;
  pnlpercentage?: string;
  symboltoken?: string;
  isin?: string;
}

interface Credentials {
  apiKey: string;
  clientId: string;
  pin: string;
  totpSecret: string;
}

export default function PortfolioView() {
  const [credentials, setCredentials] = useState<Credentials>({
    apiKey: '',
    clientId: '',
    pin: '',
    totpSecret: '',
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load saved credentials from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BROKER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCredentials(parsed);
        setIsConfigured(true);
        fetchHoldings(parsed);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const fetchHoldings = useCallback(async (creds: Credentials) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/broker/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const data = await res.json();

      if (data.success && data.holdings) {
        setHoldings(data.holdings);
      } else {
        setError(data.message || data.error || 'Failed to fetch holdings');
      }
    } catch (err: any) {
      setError(err.message || 'Network error connecting to broker');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!credentials.apiKey || !credentials.clientId || !credentials.pin || !credentials.totpSecret) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    localStorage.setItem(BROKER_STORAGE_KEY, JSON.stringify(credentials));
    setIsConfigured(true);
    fetchHoldings(credentials);
  }, [credentials, fetchHoldings]);

  const handleDisconnect = useCallback(() => {
    localStorage.removeItem(BROKER_STORAGE_KEY);
    setCredentials({ apiKey: '', clientId: '', pin: '', totpSecret: '' });
    setHoldings([]);
    setIsConfigured(false);
    setError(null);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHoldings(credentials);
  }, [credentials, fetchHoldings]);

  // Calculate totals
  const { totalInvested, totalCurrent, totalPnl, totalPnlPercent } = useMemo(() => {
    let invested = 0;
    let current = 0;
    holdings.forEach((h) => {
      const qty = parseInt(h.quantity) || 0;
      const avg = parseFloat(h.averageprice) || 0;
      const ltp = parseFloat(h.ltp) || 0;
      invested += qty * avg;
      current += qty * ltp;
    });
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return { totalInvested: invested, totalCurrent: current, totalPnl: pnl, totalPnlPercent: pnlPct };
  }, [holdings]);

  // --- CONNECT FORM ---
  if (!isConfigured) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Connect Broker</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
              Securely link your Angel One account to view your live portfolio. Credentials are stored locally on your device only.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 ml-1">SmartAPI Key</label>
              <input
                type="text"
                placeholder="e.g. hqxlKNA5"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                value={credentials.apiKey}
                onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 ml-1">Client ID</label>
              <input
                type="text"
                placeholder="e.g. R273006"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 uppercase"
                value={credentials.clientId}
                onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 ml-1">4-Digit PIN</label>
              <input
                type="password"
                placeholder="Your login PIN"
                inputMode="numeric"
                maxLength={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                value={credentials.pin}
                onChange={(e) => setCredentials({ ...credentials, pin: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 ml-1">TOTP Secret Key</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                placeholder="Google Authenticator setup key"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 uppercase"
                value={credentials.totpSecret}
                onChange={(e) => setCredentials({ ...credentials, totpSecret: e.target.value.toUpperCase() })}
              />
            </div>

            <button
              onClick={() => setShowSecrets(!showSecrets)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 ml-1"
            >
              {showSecrets ? <EyeOff size={12} /> : <Eye size={12} />}
              {showSecrets ? 'Hide fields' : 'Show fields'}
            </button>

            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck size={16} />
                  Connect to Angel One
                </span>
              )}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center leading-relaxed">
            Your credentials never leave this device. They are sent once to our server per request to generate a session token with Angel One, and are never stored on the server.
          </p>
        </div>
      </div>
    );
  }

  // --- PORTFOLIO VIEW ---
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Portfolio</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Angel One · {credentials.clientId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleDisconnect}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && holdings.length > 0 && (
        <div className="px-4 sm:px-6 pb-3 grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Invested</p>
            <p className="text-lg font-extrabold text-gray-900 dark:text-white">
              ₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Current</p>
            <p className="text-lg font-extrabold text-gray-900 dark:text-white">
              ₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="col-span-2 p-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total P&L</p>
                <p className={`text-2xl font-extrabold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}₹{Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
                totalPnl >= 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {totalPnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Holdings List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Connecting to Angel One...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium text-center max-w-sm">
              {error}
            </div>
            <button
              onClick={handleRefresh}
              className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold"
            >
              Retry
            </button>
          </div>
        ) : holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Briefcase size={40} className="text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No holdings found in your DEMAT account.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
              {holdings.length} Holdings
            </p>
            {holdings.map((h, i) => {
              const qty = parseInt(h.quantity) || 0;
              const avg = parseFloat(h.averageprice) || 0;
              const ltp = parseFloat(h.ltp) || 0;
              const pnl = parseFloat(h.profitandloss) || (qty * (ltp - avg));
              const pnlPct = avg > 0 ? ((ltp - avg) / avg) * 100 : 0;
              const isPositive = pnl >= 0;

              return (
                <div
                  key={h.tradingsymbol || i}
                  className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{h.tradingsymbol}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{h.exchange} · {qty} shares · Avg ₹{avg.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">₹{ltp.toFixed(2)}</p>
                      <p className={`text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}₹{pnl.toFixed(2)} ({isPositive ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  {/* Mini P&L bar */}
                  <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.abs(pnlPct), 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
