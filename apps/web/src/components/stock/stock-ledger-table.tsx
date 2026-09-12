'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  RotateCcw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Badge,
  Skeleton,
  EmptyState,
} from '@repo/ui';
import type {
  StockLedgerEntryDto,
  SortOrder,
  AllowedStockLedgerSortField,
  StockLedgerEntryType,
} from '@repo/types';
import { useProducts } from '../../hooks/use-products';
import { useWarehouses } from '../../hooks/use-warehouses';

export interface StockLedgerTableProps {
  entries: StockLedgerEntryDto[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
  onSort: (field: AllowedStockLedgerSortField) => void;
  onRetry?: (() => void) | undefined;
  hasFilters?: boolean | undefined;
  onResetFilters?: (() => void) | undefined;
}

function formatQuantityDelta(delta: string): {
  text: string;
  isPositive: boolean;
  isNegative: boolean;
  isZero: boolean;
} {
  if (delta.startsWith('-')) {
    return { text: delta, isPositive: false, isNegative: true, isZero: false };
  }
  if (delta.startsWith('+')) {
    return { text: delta, isPositive: true, isNegative: false, isZero: false };
  }
  const isZero = delta === '0' || delta === '0.0000' || /^0(\.0+)?$/.test(delta);
  if (isZero) {
    return { text: delta, isPositive: false, isNegative: false, isZero: true };
  }
  return { text: `+${delta}`, isPositive: true, isNegative: false, isZero: false };
}

function renderTypeBadge(type: StockLedgerEntryType) {
  switch (type) {
    case 'RECEIPT':
      return (
        <Badge
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-600/90 text-white font-medium text-[11px]"
        >
          RECEIPT
        </Badge>
      );
    case 'ISSUE':
      return (
        <Badge
          variant="destructive"
          className="bg-amber-600 hover:bg-amber-600/90 text-white font-medium text-[11px]"
        >
          ISSUE
        </Badge>
      );
    case 'ADJUSTMENT':
      return (
        <Badge
          variant="secondary"
          className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium text-[11px]"
        >
          ADJUSTMENT
        </Badge>
      );
    case 'OPENING':
    default:
      return (
        <Badge
          variant="outline"
          className="bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800 font-medium text-[11px]"
        >
          OPENING
        </Badge>
      );
  }
}

export function StockLedgerTable({
  entries,
  isLoading,
  isError,
  error,
  sortBy,
  sortOrder,
  onSort,
  onRetry,
  hasFilters,
  onResetFilters,
}: StockLedgerTableProps) {
  const { data: productsResponse } = useProducts({ limit: 100 });
  const { data: warehousesResponse } = useWarehouses({ limit: 100 });

  const productsMap = React.useMemo(() => {
    const map = new Map<string, { name: string; sku: string; unitOfMeasure: string }>();
    if (productsResponse?.data) {
      for (const p of productsResponse.data) {
        map.set(p.id, { name: p.name, sku: p.sku, unitOfMeasure: p.unitOfMeasure });
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

  const renderSortIcon = (field: AllowedStockLedgerSortField) => {
    if (sortBy !== field) {
      return (
        <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
      );
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
    );
  };

  const getAriaSort = (field: AllowedStockLedgerSortField): 'ascending' | 'descending' | 'none' => {
    if (sortBy !== field) return 'none';
    return sortOrder === 'asc' ? 'ascending' : 'descending';
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[16%]">Timestamp</TableHead>
              <TableHead className="w-[12%]">Type</TableHead>
              <TableHead className="w-[20%]">Product</TableHead>
              <TableHead className="w-[16%]">Warehouse</TableHead>
              <TableHead className="w-[12%] text-right">Delta</TableHead>
              <TableHead className="w-[14%] text-right">Balance</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`ledger-skeleton-${index}`}>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-16 ml-auto" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-24 ml-auto" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-14 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to load stock ledger history. Please check your connection and try again.';

    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6">
        <EmptyState
          icon={AlertCircle}
          title="Error Loading Stock Ledger"
          description={errorMessage}
          action={
            onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (entries.length === 0) {
    if (hasFilters) {
      return (
        <div className="rounded-md border border-border bg-card p-6">
          <EmptyState
            icon={History}
            title="No matching ledger entries"
            description="No immutable ledger mutations match the selected product, warehouse, or transaction type filters."
            action={
              onResetFilters ? (
                <Button variant="outline" size="sm" onClick={onResetFilters} className="mt-2">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              ) : undefined
            }
          />
        </div>
      );
    }

    return (
      <div className="rounded-md border border-border bg-card p-6">
        <EmptyState
          icon={History}
          title="No stock ledger entries found"
          description="Your organization has not recorded any immutable stock mutations yet."
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {/* Timestamp */}
            <TableHead className="w-[16%]" aria-sort={getAriaSort('createdAt')}>
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none"
                onClick={() => onSort('createdAt')}
              >
                Timestamp
                {renderSortIcon('createdAt')}
              </button>
            </TableHead>

            {/* Type */}
            <TableHead className="w-[12%]" aria-sort={getAriaSort('type')}>
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none"
                onClick={() => onSort('type')}
              >
                Type
                {renderSortIcon('type')}
              </button>
            </TableHead>

            {/* Product */}
            <TableHead className="w-[20%]">Product</TableHead>

            {/* Warehouse */}
            <TableHead className="w-[16%]">Warehouse</TableHead>

            {/* Delta */}
            <TableHead className="w-[12%] text-right" aria-sort={getAriaSort('quantityDelta')}>
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none ml-auto"
                onClick={() => onSort('quantityDelta')}
              >
                Delta
                {renderSortIcon('quantityDelta')}
              </button>
            </TableHead>

            {/* Balance Before -> After */}
            <TableHead className="w-[14%] text-right" aria-sort={getAriaSort('quantityAfter')}>
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none ml-auto"
                onClick={() => onSort('quantityAfter')}
              >
                Balance (Before → After)
                {renderSortIcon('quantityAfter')}
              </button>
            </TableHead>

            {/* Reference */}
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const product = productsMap.get(entry.productId);
            const warehouse = warehousesMap.get(entry.warehouseId);
            const delta = formatQuantityDelta(entry.quantityDelta);

            return (
              <TableRow key={entry.id} className="hover:bg-muted/50 transition-colors">
                {/* Timestamp */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">
                      {new Date(entry.createdAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {entry.id.slice(0, 8)}...
                    </span>
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell>{renderTypeBadge(entry.type)}</TableCell>

                {/* Product */}
                <TableCell>
                  <div className="flex flex-col">
                    <Link
                      href={`/stock/product/${entry.productId}`}
                      className="font-medium text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1 text-xs"
                    >
                      {product?.name || `Product: ${entry.productId.slice(0, 8)}...`}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                    <span className="text-[11px] text-muted-foreground">
                      SKU: {product?.sku || '—'}
                      {product?.unitOfMeasure ? ` • ${product.unitOfMeasure}` : ''}
                    </span>
                  </div>
                </TableCell>

                {/* Warehouse */}
                <TableCell>
                  <div className="flex flex-col">
                    <Link
                      href={`/stock/warehouse/${entry.warehouseId}`}
                      className="font-medium text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1 text-xs"
                    >
                      {warehouse?.name || `Warehouse: ${entry.warehouseId.slice(0, 8)}...`}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                    {warehouse?.code && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {warehouse.code}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Delta */}
                <TableCell className="text-right">
                  <span
                    className={`font-mono text-xs font-semibold ${
                      delta.isPositive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : delta.isNegative
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {delta.text}
                  </span>
                </TableCell>

                {/* Balance (Before -> After) */}
                <TableCell className="text-right">
                  <div className="flex flex-col items-end text-xs font-mono">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>{entry.quantityBefore}</span>
                      <span>→</span>
                      <span className="font-semibold text-foreground">{entry.quantityAfter}</span>
                    </div>
                    {entry.referenceId && (
                      <span className="text-[10px] text-muted-foreground/80 truncate max-w-[140px] font-sans">
                        Ref: {entry.referenceId}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                    <Link
                      href={`/stock/ledger/${entry.id}`}
                      aria-label={`View ledger entry details for ${entry.id}`}
                    >
                      Details
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
