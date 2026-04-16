'use client';

import { useRef, useState, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import StockCard from './StockCard';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

interface StockGridProps {
  companies: Company[];
  onSelectCompany: (company: Company) => void;
  isInWatchlist: (companyId: string) => boolean;
  onToggleWatchlist: (companyId: string) => void;
}

// ★ Updated: Card height (120px) + gap (10px) = 130px per row
const CARD_HEIGHT = 120;
const ROW_GAP = 10;
const ROW_SIZE = CARD_HEIGHT + ROW_GAP;

const StockGrid = memo(function StockGrid({ companies, onSelectCompany, isInWatchlist, onToggleWatchlist }: StockGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    function updateColumns() {
      const w = window.innerWidth;
      if (w < 768) setColumnCount(1);
      else if (w < 1024) setColumnCount(2);
      else setColumnCount(3);
    }
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const rowCount = Math.ceil(companies.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_SIZE,
    overscan: 5, // Reduced from 8 — less off-screen rendering
  });

  if (companies.length === 0) {
    return null;
  }

  return (
    <div 
      ref={parentRef} 
      className="flex-1 overflow-auto w-full" 
      style={{ 
        height: '100%',
        // ★ GPU-accelerated scroll container
        WebkitOverflowScrolling: 'touch',
        contain: 'strict',
      }}
    >
      <div 
        className="w-full relative" 
        style={{ 
          height: `${rowVirtualizer.getTotalSize()}px`,
          contain: 'layout size',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems = companies.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.index}
              className="absolute top-0 left-0 w-full flex gap-2.5"
              style={{
                height: `${CARD_HEIGHT}px`,
                transform: `translateY(${virtualRow.start}px)`,
                contain: 'layout style',
              }}
            >
              {rowItems.map((company) => (
                <div key={company.id} className="flex-1 min-w-0">
                  <StockCard
                    company={company}
                    onSelect={onSelectCompany}
                    isWatchlisted={isInWatchlist(company.id)}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                </div>
              ))}
              {Array.from({ length: columnCount - rowItems.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex-1 invisible" />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default StockGrid;
