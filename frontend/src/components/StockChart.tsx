'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
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

// ── Custom Tooltip ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const price = payload[0]?.value;
  const date = new Date((label as number) * 1000);
  const isPositive = payload[0]?.payload?.value >= (payload[0]?.payload?.firstValue ?? price);

  return (
    <div className="relative pointer-events-none">
      <div
        className="px-3 py-2 rounded-xl border shadow-xl backdrop-blur-xl"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          borderColor: isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          boxShadow: isPositive
            ? '0 8px 32px -4px rgba(16, 185, 129, 0.15)'
            : '0 8px 32px -4px rgba(239, 68, 68, 0.15)',
        }}
      >
        <p
          className="text-[15px] font-bold tabular-nums"
          style={{ color: isPositive ? '#34d399' : '#f87171' }}
        >
          ₹{Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

// ── Custom Active Dot (pulsing glow) ──
function GlowDot({ cx, cy, fill }: any) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      {/* Outer glow ring */}
      <circle cx={cx} cy={cy} r={10} fill={fill} opacity={0.15}>
        <animate attributeName="r" values="8;12;8" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0.05;0.15" dur="1.5s" repeatCount="indefinite" />
      </circle>
      {/* Middle ring */}
      <circle cx={cx} cy={cy} r={5} fill={fill} opacity={0.3} />
      {/* Inner dot */}
      <circle cx={cx} cy={cy} r={3} fill={fill} stroke="rgba(15,23,42,0.8)" strokeWidth={1.5} />
    </g>
  );
}

// ── Custom Crosshair Cursor ──
function CustomCursor({ points, height, accentColor }: any) {
  if (!points || points.length === 0) return null;
  const { x } = points[0];
  return (
    <line
      x1={x}
      y1={0}
      x2={x}
      y2={height}
      stroke={accentColor}
      strokeWidth={1}
      strokeOpacity={0.3}
      strokeDasharray="4 3"
    />
  );
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

  // Enrich chart data with first value for tooltip color logic
  const enrichedData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const firstValue = chartData[0].value;
    return chartData.map(d => ({ ...d, firstValue }));
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
      <div className="w-full h-[180px] sm:h-[220px] -mx-2 outline-none border-none" style={{ WebkitTapHighlightColor: 'transparent' }}>
        {isChartLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="animate-spin w-5 h-5 text-blue-500" />
          </div>
        ) : enrichedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={enrichedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.30} />
                  <stop offset="50%" stopColor="#10b981" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="chartGradDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.30} />
                  <stop offset="50%" stopColor="#ef4444" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
                {/* Glow filter for the line */}
                <filter id="chartGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(t) => {
                  const d = new Date(t * 1000);
                  return period === '1M' || period === '6M'
                    ? d.toLocaleDateString([], { day: 'numeric', month: 'short' })
                    : d.toLocaleDateString([], { month: 'short', year: '2-digit' });
                }}
                stroke="transparent"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tick={{ fill: 'rgba(156, 163, 175, 0.6)' }}
              />
              <YAxis
                domain={yDomain as [any, any]}
                stroke="transparent"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatPrice}
                width={52}
                tick={{ fill: 'rgba(156, 163, 175, 0.6)' }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={<CustomCursor accentColor={accentColor} />}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={isPositive ? 'url(#chartGradUp)' : 'url(#chartGradDown)'}
                dot={false}
                activeDot={<GlowDot fill={accentColor} />}
                filter="url(#chartGlow)"
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
