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
  isPending?: boolean;
}

const StockGrid = memo(function StockGrid({ companies, onSelectCompany, isInWatchlist, onToggleWatchlist, isPending }: StockGridProps) {
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
    estimateSize: () => (columnCount === 1 ? 110 : 140),
    overscan: 8,
  });

  if (companies.length === 0) {
    return null;
  }

  return (
    <div 
      ref={parentRef} 
      className={`flex-1 overflow-auto w-full transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`} 
      style={{ height: '100%' }}
    >
      <div className="w-full relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems = companies.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.index}
              className="absolute top-0 left-0 w-full flex gap-2 sm:gap-3 md:gap-4"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                padding: '2px 0',
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
