'use client';

import * as React from 'react';
import {
  Search,
  Download,
  Upload,
  LayoutList,
  LayoutGrid,
  Settings,
  ChevronDown,
  X,
} from 'lucide-react';
import { useCategories } from '../../hooks/use-categories';
import { UNIT_OF_MEASURE_VALUES } from '@repo/types';
import { cn } from '@repo/ui';

export type StockTab = 'all' | 'low' | 'out' | 'expiring' | 'transit';

export interface StockTableToolbarProps {
  currentTab: StockTab;
  onTabChange: (tab: StockTab) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  categoryId?: string | undefined;
  onCategoryChange: (catId?: string | undefined) => void;
  unit?: string | undefined;
  onUnitChange: (unit?: string | undefined) => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  onExport?: (() => void) | undefined;
  onImport?: (() => void) | undefined;
}

export function StockTableToolbar({
  currentTab,
  onTabChange,
  searchTerm,
  onSearchChange,
  categoryId,
  onCategoryChange,
  unit,
  onUnitChange,
  viewMode,
  onViewModeChange,
  onExport,
  onImport,
}: StockTableToolbarProps) {
  const { data: categoriesResponse } = useCategories();
  const categories = categoriesResponse?.data || [];

  const tabs: { key: StockTab; label: string }[] = [
    { key: 'all', label: 'All Stock' },
    { key: 'low', label: 'Low Stock' },
    { key: 'out', label: 'Out of Stock' },
    { key: 'expiring', label: 'Expiring Soon' },
    { key: 'transit', label: 'In Transit' },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'relative py-3 px-4 text-xs font-semibold transition-colors focus:outline-none',
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Action & Filter Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search input + Dropdowns */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by product name, SKU, barcode..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={categoryId || ''}
              onChange={(e) => onCategoryChange(e.target.value || undefined)}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Unit Dropdown */}
          <div className="relative">
            <select
              value={unit || ''}
              onChange={(e) => onUnitChange(e.target.value || undefined)}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-8 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              <option value="">All Units</option>
              {UNIT_OF_MEASURE_VALUES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Right Toolbar Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Export */}
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          {/* Import */}
          <button
            type="button"
            onClick={onImport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span>Import</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/50 p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={cn(
                'rounded-lg p-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600',
              )}
              aria-label="List view"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={cn(
                'rounded-lg p-1.5 transition-colors',
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600',
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Settings icon */}
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            aria-label="Table settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
