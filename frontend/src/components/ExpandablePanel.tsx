'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface PanelProps {
  company: {
    id: string;
    symbol: string;
    exchange: string;
  };
}

export default function ExpandablePanel({ company }: PanelProps) {
  const [period, setPeriod] = useState<'1M' | '6M' | '1Y' | '5Y'>('1M');

  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['historical', company.id, period],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/companies/${company.id}/historical?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch chart data');
      return res.json();
    }
  });

  const { data: newsItems, isLoading: isNewsLoading } = useQuery({
    queryKey: ['news', company.id],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/companies/${company.id}/news`);
      if (!res.ok) throw new Error('Failed to fetch news');
      return res.json();
    }
  });

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Chart Section */}
      <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold dark:text-gray-100">Price History</h3>
          <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {['1M', '6M', '1Y', '5Y'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p as any)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                  period === p 
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-[300px] md:h-[400px]">
          {isChartLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(unixTime) => {
                    const date = new Date(unixTime * 1000);
                    return period === '1M' || period === '6M' 
                      ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) 
                      : date.toLocaleDateString([], { month: 'short', year: '2-digit' });
                  }}
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip 
                  labelFormatter={(unixTime) => new Date((unixTime as number) * 1000).toLocaleString()}
                  formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Price']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No chart data available.
            </div>
          )}
        </div>
      </div>

      {/* News Section */}
      <div className="w-full md:w-[400px] flex flex-col bg-gray-50 dark:bg-gray-900/50">
        <div className="p-6 pb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2 dark:text-gray-100">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
            AI News Intelligence
          </h3>
          <p className="text-xs text-gray-500 mt-1">Semantically filtered & deduplicated</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
          {isNewsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          ) : newsItems && newsItems.length > 0 ? (
            newsItems.map((news: any) => (
              <a 
                key={news.id} 
                href={news.url} 
                target="_blank" 
                rel="noreferrer"
                className="block p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                    {news.source}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(news.publishedAt).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="font-bold text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {news.title}
                </h4>
                {news.summary && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-300">AI Summary: </span>
                    {news.summary}
                  </p>
                )}
              </a>
            ))
          ) : (
            <div className="text-center text-gray-500 text-sm mt-10">
              No recent news articles found for this company.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
