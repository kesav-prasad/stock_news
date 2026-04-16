'use client';

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

interface ChartPoint {
  time: number;
  value: number;
}

interface StockQuote {
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  symbol: string;
  name: string;
}

type Period = '1M' | '6M' | '1Y' | '5Y';

interface StockChartProps {
  quote: StockQuote | null;
  chartData: ChartPoint[];
  period: Period;
  onPeriodChange: (p: Period) => void;
  isQuoteLoading: boolean;
  isChartLoading: boolean;
}

const PERIODS: Period[] = ['1M', '6M', '1Y', '5Y'];

function formatPrice(val: number): string {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toFixed(2)}`;
}

const StockChart = memo(function StockChart({
  quote,
  chartData,
  period,
  onPeriodChange,
  isQuoteLoading,
  isChartLoading,
}: StockChartProps) {
  const isPositive = quote ? quote.change >= 0 : true;
  const accentColor = isPositive ? '#10b981' : '#ef4444';
  const accentBg = isPositive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20';
  const accentText = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

  // Compute Y domain with padding
  const yDomain = useMemo(() => {
    if (!chartData || chartData.length === 0) return ['auto', 'auto'] as const;
    const values = chartData.map(d => d.value).filter(v => v > 0);
    if (values.length === 0) return ['auto', 'auto'] as const;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || max * 0.05;
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData]);

  return (
    <div className="px-4 sm:px-6 pt-3 pb-2">
      {/* ── LIVE PRICE HEADER ── */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          {isQuoteLoading && !quote ? (
            <div className="flex items-center gap-2">
              <div className="h-7 w-28 rounded-lg bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
            </div>
          ) : quote && quote.price > 0 ? (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight dark:text-white tabular-nums">
                  ₹{quote.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${accentBg}`}>
                  {isPositive ? (
                    <TrendingUp size={13} className={accentText} />
                  ) : quote.change < 0 ? (
                    <TrendingDown size={13} className={accentText} />
                  ) : (
                    <Minus size={13} className="text-gray-400" />
                  )}
                  <span className={`text-xs font-bold tabular-nums ${accentText}`}>
                    {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Live price · Yahoo Finance
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">Price data unavailable</p>
          )}
        </div>
      </div>

      {/* ── PERIOD SELECTOR ── */}
      <div className="flex gap-1.5 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-150 ${
              period === p
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 active:bg-gray-200 dark:active:bg-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── CHART ── */}
      <div className="w-full h-[180px] sm:h-[220px] -mx-2">
        {isChartLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="animate-spin w-5 h-5 text-blue-500" />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(t) => {
                  const d = new Date(t * 1000);
                  return period === '1M' || period === '6M'
                    ? d.toLocaleDateString([], { day: 'numeric', month: 'short' })
                    : d.toLocaleDateString([], { month: 'short', year: '2-digit' });
                }}
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis
                domain={yDomain as [any, any]}
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatPrice}
                width={52}
                tick={{ fill: '#9ca3af' }}
              />
              <Tooltip
                labelFormatter={(t) => new Date((t as number) * 1000).toLocaleString('en-IN')}
                formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Price']}
                contentStyle={{
                  borderRadius: '10px',
                  border: 'none',
                  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.15)',
                  fontSize: '12px',
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(8px)',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#chartGrad)"
                dot={false}
                activeDot={{ r: 4, fill: accentColor, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <TrendingUp size={18} className="text-gray-400" />
            </div>
            <span className="text-[11px] text-gray-400">No chart data available</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default StockChart;
