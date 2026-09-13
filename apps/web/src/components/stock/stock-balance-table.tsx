'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Boxes,
  RotateCcw,
  AlertCircle,
  MoreVertical,
  SlidersHorizontal,
  FileText,
  Eye,
  Package,
} from 'lucide-react';
import type {
  StockBalanceDto,
  SortOrder,
  AllowedStockBalanceSortField,
  ProductDto,
} from '@repo/types';
import { useProducts } from '../../hooks/use-products';
import { useWarehouses } from '../../hooks/use-warehouses';
import { useCategories } from '../../hooks/use-categories';
import { usePermissions } from '../../hooks/use-permissions';
import { cn } from '@repo/ui';

export interface StockBalanceTableProps {
  balances: StockBalanceDto[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
  onSort: (field: AllowedStockBalanceSortField) => void;
  onRetry?: (() => void) | undefined;
  hasFilters?: boolean | undefined;
  onResetFilters?: (() => void) | undefined;
  onMutateStock?: ((balance: StockBalanceDto) => void) | undefined;
  onAddNewMutation?: (() => void) | undefined;
  currencySymbol?: string;
}

const CATEGORY_COLORS: Record<number, string> = {
  0: 'bg-purple-50 text-purple-700 border-purple-200',
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  3: 'bg-amber-50 text-amber-700 border-amber-200',
  4: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  5: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function StockBalanceTable({
  balances,
  isLoading,
  isError,
  error,
  sortBy,
  sortOrder,
  onSort,
  onRetry,
  hasFilters,
  onResetFilters,
  onMutateStock,
  onAddNewMutation,
  currencySymbol = '$',
}: StockBalanceTableProps) {
  const { canMutateStock } = usePermissions();
  const { data: productsResponse } = useProducts({ limit: 100 });
  const { data: warehousesResponse } = useWarehouses({ limit: 100 });
  const { data: categoriesResponse } = useCategories();

  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleClickOutside() {
      setActiveMenuId(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const productsMap = React.useMemo(() => {
    const map = new Map<string, ProductDto>();
    if (productsResponse?.data) {
      for (const p of productsResponse.data) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [productsResponse]);

  const warehousesMap = React.useMemo(() => {
    const map = new Map<string, { name: string; code: string }>();
    if (warehousesResponse?.data) {
      for (const w of warehousesResponse.data) {
        map.set(w.id, { name: w.name, code: w.code });
      }
    }
    return map;
  }, [warehousesResponse]);

  const categoriesMap = React.useMemo(() => {
    const map = new Map<string, { name: string; index: number }>();
    if (categoriesResponse?.data) {
      categoriesResponse.data.forEach((c, idx) => {
        map.set(c.id, { name: c.name, index: idx });
      });
    }
    return map;
  }, [categoriesResponse]);

  const renderSortIcon = (field: AllowedStockBalanceSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-300" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-blue-600" />
    );
  };

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 pl-4 pr-3">Product</th>
              <th className="px-3 py-3.5">SKU / Barcode</th>
              <th className="px-3 py-3.5">Category</th>
              <th className="px-3 py-3.5">Warehouse</th>
              <th className="px-3 py-3.5 text-center">Quantity</th>
              <th className="px-3 py-3.5 text-center">Available</th>
              <th className="px-3 py-3.5 text-center">Reserved</th>
              <th className="px-3 py-3.5">Status</th>
              <th className="px-3 py-3.5 text-right">Unit Cost</th>
              <th className="px-3 py-3.5 text-right">Unit Price</th>
              <th className="px-3 py-3.5 text-right">Value</th>
              <th className="px-3 py-3.5">Last Updated</th>
              <th className="py-3.5 pl-3 pr-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="py-3 pl-4 pr-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-100" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-slate-100" />
                      <div className="h-2.5 w-16 rounded bg-slate-50" />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="h-3.5 w-20 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-5 w-16 rounded-full bg-slate-100" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-3.5 w-24 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="mx-auto h-3.5 w-12 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="mx-auto h-3.5 w-12 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="mx-auto h-3.5 w-8 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-5 w-16 rounded-full bg-slate-100" />
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="ml-auto h-3.5 w-14 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="ml-auto h-3.5 w-14 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="ml-auto h-3.5 w-16 rounded bg-slate-100" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-3.5 w-20 rounded bg-slate-100" />
                </td>
                <td className="py-3 pl-3 pr-4 text-center">
                  <div className="mx-auto h-7 w-7 rounded-lg bg-slate-100" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isError) {
    const msg =
      error instanceof Error ? error.message : 'Failed to load stock balances. Please try again.';

    return (
      <div className="m-6 flex flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50/50 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
        <h4 className="text-sm font-semibold text-slate-800">Error Loading Stock Balances</h4>
        <p className="mt-1 max-w-sm text-xs text-slate-500">{msg}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="m-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
        <Boxes className="h-12 w-12 text-slate-400 mb-3" />
        <h4 className="text-sm font-semibold text-slate-800">
          {hasFilters ? 'No matching stock balances' : 'No stock balances found'}
        </h4>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          {hasFilters
            ? 'Try adjusting your search query, category, or warehouse filters.'
            : 'Your organization has not recorded any stock balances or initial inventory yet.'}
        </p>
        {hasFilters && onResetFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
          </button>
        ) : canMutateStock && onAddNewMutation ? (
          <button
            type="button"
            onClick={onAddNewMutation}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Record Stock Mutation
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-600">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <th className="py-3.5 pl-4 pr-3">
              <button
                type="button"
                onClick={() => onSort('productId')}
                className="inline-flex items-center hover:text-slate-700"
              >
                Product {renderSortIcon('productId')}
              </button>
            </th>
            <th className="px-3 py-3.5">SKU / Barcode</th>
            <th className="px-3 py-3.5">Category</th>
            <th className="px-3 py-3.5">
              <button
                type="button"
                onClick={() => onSort('warehouseId')}
                className="inline-flex items-center hover:text-slate-700"
              >
                Warehouse {renderSortIcon('warehouseId')}
              </button>
            </th>
            <th className="px-3 py-3.5 text-center">
              <button
                type="button"
                onClick={() => onSort('quantity')}
                className="inline-flex items-center hover:text-slate-700"
                aria-label="Quantity"
              >
                Quantity {renderSortIcon('quantity')}
              </button>
            </th>
            <th className="px-3 py-3.5 text-center">Available</th>
            <th className="px-3 py-3.5 text-center">Reserved</th>
            <th className="px-3 py-3.5">Status</th>
            <th className="px-3 py-3.5 text-right">Unit Cost</th>
            <th className="px-3 py-3.5 text-right">Unit Price</th>
            <th className="px-3 py-3.5 text-right">Value</th>
            <th className="px-3 py-3.5">
              <button
                type="button"
                onClick={() => onSort('updatedAt')}
                className="inline-flex items-center hover:text-slate-700"
                aria-label="Last Updated"
              >
                Last Updated {renderSortIcon('updatedAt')}
              </button>
            </th>
            <th className="py-3.5 pl-3 pr-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {balances.map((b) => {
            const product = productsMap.get(b.productId);
            const warehouse = warehousesMap.get(b.warehouseId);
            const categoryInfo = product?.categoryId ? categoriesMap.get(product.categoryId) : null;

            const qtyNum = parseFloat(b.quantity) || 0;
            const isLowStock = qtyNum > 0 && qtyNum <= 10;
            const isInStock = qtyNum > 10;

            const availableQty = qtyNum;
            const reservedQty = 0;

            const unitCost = product?.unitCost ? parseFloat(product.unitCost) : null;
            const unitPrice = product?.unitPrice ? parseFloat(product.unitPrice) : null;
            const totalValue = unitPrice !== null ? qtyNum * unitPrice : null;

            const catBadgeClass =
              categoryInfo !== null && categoryInfo !== undefined
                ? CATEGORY_COLORS[categoryInfo.index % 6]
                : 'bg-slate-100 text-slate-600 border-slate-200';

            const isMenuOpen = activeMenuId === b.id;

            return (
              <tr key={b.id} className="transition-colors hover:bg-slate-50/80">
                {/* 1. Product (Image thumbnail + Title + Description) */}
                <td className="py-3 pl-4 pr-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Package className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/stock/${b.id}`}
                        className="block truncate font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {product?.name || `Product: ${b.productId.slice(0, 8)}`}
                      </Link>
                      <p className="truncate text-[11px] text-slate-400">
                        {product?.description || product?.unitOfMeasure || 'Standard'}
                      </p>
                    </div>
                  </div>
                </td>

                {/* 2. SKU / Barcode */}
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-800">SKU: {product?.sku || '—'}</div>
                  <div className="text-[11px] text-slate-400">
                    {product?.id ? product.id.slice(0, 12) : '—'}
                  </div>
                </td>

                {/* 3. Category */}
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                      catBadgeClass,
                    )}
                  >
                    {categoryInfo?.name || 'General'}
                  </span>
                </td>

                {/* 4. Warehouse */}
                <td className="px-3 py-3">
                  <div className="font-medium text-slate-800">{warehouse?.name || 'Warehouse'}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {warehouse?.code || 'WH-01'}
                  </div>
                </td>

                {/* 5. Stock / Quantity */}
                <td className="px-3 py-3 text-center font-bold text-slate-900">
                  <div>{b.quantity}</div>
                  {(b.quantity === '0.0000' || b.quantity === '0') && (
                    <span className="inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Zero Stock
                    </span>
                  )}
                </td>

                {/* 6. Available */}
                <td
                  className={cn(
                    'px-3 py-3 text-center font-semibold',
                    availableQty > 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {availableQty.toLocaleString()}
                </td>

                {/* 7. Reserved */}
                <td className="px-3 py-3 text-center font-medium text-amber-600">{reservedQty}</td>

                {/* 8. Status */}
                <td className="px-3 py-3">
                  {isInStock ? (
                    <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                      In Stock
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600">
                      Out of Stock
                    </span>
                  )}
                </td>

                {/* 9. Unit Cost */}
                <td className="px-3 py-3 text-right font-medium text-slate-700">
                  {unitCost !== null ? `${currencySymbol}${unitCost.toFixed(2)}` : '—'}
                </td>

                {/* 10. Unit Price */}
                <td className="px-3 py-3 text-right font-medium text-slate-700">
                  {unitPrice !== null ? `${currencySymbol}${unitPrice.toFixed(2)}` : '—'}
                </td>

                {/* 11. Total Value */}
                <td className="px-3 py-3 text-right font-bold text-slate-900">
                  {totalValue !== null
                    ? `${currencySymbol}${totalValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : '—'}
                </td>

                {/* 12. Last Updated */}
                <td className="px-3 py-3 text-xs text-slate-500">
                  {new Date(b.updatedAt).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>

                {/* 13. Actions */}
                <td className="py-3 pl-3 pr-4 text-center relative">
                  <div className="flex items-center justify-center gap-1">
                    {canMutateStock && onMutateStock && (
                      <button
                        type="button"
                        onClick={() => onMutateStock(b)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                        aria-label="Mutate"
                        title="Mutate"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : b.id);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      aria-label="Actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {isMenuOpen && (
                    <div
                      className="absolute right-4 top-10 z-50 w-44 origin-top-right rounded-xl border border-slate-100 bg-white py-1 shadow-lg ring-1 ring-black/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/stock/${b.id}`}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-400" /> View Details
                      </Link>
                      {canMutateStock && onMutateStock && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onMutateStock(b);
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                          Record Mutation
                        </button>
                      )}
                      <Link
                        href={`/stock/ledger?productId=${b.productId}`}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
                      >
                        <FileText className="h-3.5 w-3.5 text-slate-400" /> View Ledger History
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
