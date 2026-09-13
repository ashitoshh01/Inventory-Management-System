'use client';

import * as React from 'react';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { cn } from '@repo/ui';

interface DateRangeSelectorProps {
  className?: string;
  onRangeChange?: (range: string) => void;
}

const RANGES = ['Today', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'Custom Range'];

export function DateRangeSelector({ className, onRangeChange }: DateRangeSelectorProps) {
  const [selectedRange, setSelectedRange] = React.useState('Last 7 Days');
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateLabel = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    const formatOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const yearOpts: Intl.DateTimeFormatOptions = { year: 'numeric' };

    return `${start.toLocaleDateString('en-US', formatOpts)} - ${end.toLocaleDateString(
      'en-US',
      formatOpts,
    )}, ${end.toLocaleDateString('en-US', yearOpts)}`;
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
      >
        <CalendarIcon className="h-4 w-4 text-slate-500" />
        <span>{formatDateLabel()}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-48 origin-top-right rounded-xl border border-slate-100 bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
          {RANGES.map((range) => {
            const isSelected = selectedRange === range;
            return (
              <button
                key={range}
                type="button"
                onClick={() => {
                  setSelectedRange(range);
                  onRangeChange?.(range);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between px-3.5 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className={cn(isSelected && 'font-bold text-blue-600')}>{range}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
