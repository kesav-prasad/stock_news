'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const APP_VERSION = '1.2.0';
const VERSION_KEY = 'sn_last_seen_version';
const DISMISSED_KEY = 'sn_update_dismissed';

const CHANGELOG: Record<string, { title: string; features: string[] }> = {
  '1.2.0': {
    title: 'Fresh News Engine & Bug Fixes',
    features: [
      '🗞️ Live market news feed — fetches real-time news from 8+ sources',
      '🔔 Fixed notifications for newly watchlisted companies',
      '⬅️ Android back button now works properly (browser → modal → home)',
      '⚡ Faster portfolio loading with cached Angel One sessions',
      '🔄 Auto-refresh: news updates every 3 minutes',
      '🚫 Smarter duplicate removal — no repeated headlines',
    ],
  },
  '1.1.0': {
    title: 'Market News Overhaul',
    features: [
      '📰 Unified chronological news feed (no more priority sections)',
      '🏢 Full company names displayed on cards',
      '📊 30+ Indian market companies tracked',
    ],
  },
};

export default function UpdatePopup() {
  const [show, setShow] = useState(false);
  const [version] = useState(APP_VERSION);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(VERSION_KEY);
      const dismissed = localStorage.getItem(DISMISSED_KEY);

      if (lastSeen !== APP_VERSION && dismissed !== APP_VERSION) {
        // Show popup after a short delay so the app feels loaded first
        const timer = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    localStorage.setItem(DISMISSED_KEY, APP_VERSION);
  };

  if (!show) return null;

  const changelog = CHANGELOG[version];
  if (!changelog) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 px-6 py-5">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 text-white/80 hover:bg-white/30 transition-colors"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-amber-300" />
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">What's New</span>
          </div>
          <h2 className="text-xl font-extrabold text-white leading-tight">{changelog.title}</h2>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold">
            v{version}
          </span>
        </div>

        {/* Feature list */}
        <div className="px-6 py-4 space-y-2.5 max-h-[40vh] overflow-y-auto">
          {changelog.features.map((feature, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-5 pt-2">
          <button
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg"
          >
            Got it
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
