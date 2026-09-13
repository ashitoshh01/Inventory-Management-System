'use client';

import * as React from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useWarehouses } from '../../hooks/use-warehouses';
import { cn } from '@repo/ui';

interface WarehouseSelectorProps {
  value?: string | undefined;
  onChange: (warehouseId?: string | undefined) => void;
  allowAll?: boolean | undefined;
  className?: string | undefined;
}

export function WarehouseSelector({
  value,
  onChange,
  allowAll = true,
  className,
}: WarehouseSelectorProps) {
  const { data: warehousesResponse, isLoading } = useWarehouses();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const warehouses = warehousesResponse?.data || [];

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedWarehouse = warehouses.find((w) => w.id === value);
  const label = selectedWarehouse
    ? selectedWarehouse.name
    : allowAll
      ? 'All Warehouses'
      : 'Select Warehouse';

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
      >
        <Building2 className="h-4 w-4 text-slate-500" />
        <span className="truncate max-w-[130px]">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-56 origin-top-right rounded-xl border border-slate-100 bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
          {allowAll && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between px-3.5 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className={cn(!value && 'font-bold text-blue-600')}>All Warehouses</span>
              {!value && <Check className="h-3.5 w-3.5 text-blue-600" />}
            </button>
          )}

          {warehouses.map((wh) => {
            const isSelected = wh.id === value;
            return (
              <button
                key={wh.id}
                type="button"
                onClick={() => {
                  onChange(wh.id);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between px-3.5 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="truncate pr-2">
                  <p className={cn(isSelected && 'font-bold text-blue-600')}>{wh.name}</p>
                  <p className="text-[10px] text-slate-400">{wh.code}</p>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
