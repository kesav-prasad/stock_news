import { memo } from 'react';

interface SparklineProps {
  data: number[];
  isPositive: boolean;
  width?: number;
  height?: number;
}

const Sparkline = memo(function Sparkline({ data, isPositive, width = 60, height = 24 }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Convert closing prices to SVG path coordinates
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  
  // Fill gradient coordinates for under the line
  const fillPoints = `${points.join(' L ')} L ${width},${height} L 0,${height}`;
  
  const strokeColor = isPositive 
    ? 'text-emerald-500 dark:text-emerald-400' 
    : 'text-rose-500 dark:text-rose-400';

  return (
    <svg width={width} height={height} className="overflow-visible opacity-80" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`gradient-${isPositive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} className={strokeColor} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.0} className={strokeColor} />
        </linearGradient>
      </defs>
      
      {/* Fill Area */}
      <polygon points={`0,${height} ${fillPoints}`} fill={`url(#gradient-${isPositive ? 'up' : 'down'})`} />
      
      {/* Line Graph */}
      <path 
        d={pathD} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round" 
        className={strokeColor}
      />
    </svg>
  );
});

export default Sparkline;
