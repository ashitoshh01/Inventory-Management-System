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
  SlidersHorizontal,
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
import type { StockBalanceDto, SortOrder, AllowedStockBalanceSortField } from '@repo/types';
import { useProducts } from '../../hooks/use-products';
import { useWarehouses } from '../../hooks/use-warehouses';
import { usePermissions } from '../../hooks/use-permissions';

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
}

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
}: StockBalanceTableProps) {
  const { canMutateStock } = usePermissions();
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

  const renderSortIcon = (field: AllowedStockBalanceSortField) => {
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

  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30%]">Product</TableHead>
              <TableHead className="w-[25%]">Warehouse</TableHead>
              <TableHead className="w-[15%] text-right">Quantity</TableHead>
              <TableHead className="w-[15%]">Last Updated</TableHead>
              <TableHead className="w-[15%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`skeleton-row-${index}`}>
                <TableCell>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-16 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-20 ml-auto" />
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
        : 'Failed to load stock balances. Please check your connection and try again.';

    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6">
        <EmptyState
          icon={AlertCircle}
          title="Error Loading Stock Balances"
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

  if (balances.length === 0) {
    if (hasFilters) {
      return (
        <div className="rounded-md border border-border bg-card p-6">
          <EmptyState
            icon={Boxes}
            title="No matching stock balances"
            description="No inventory records match the selected product or warehouse filters."
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
          icon={Boxes}
          title="No stock balances found"
          description="Your organization has not recorded any stock transactions or initial balances yet."
          action={
            canMutateStock && onAddNewMutation ? (
              <Button size="sm" onClick={onAddNewMutation} className="mt-2">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Record Stock Mutation
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[30%]">
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none"
                onClick={() => onSort('productId')}
              >
                Product
                {renderSortIcon('productId')}
              </button>
            </TableHead>
            <TableHead className="w-[25%]">
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none"
                onClick={() => onSort('warehouseId')}
              >
                Warehouse
                {renderSortIcon('warehouseId')}
              </button>
            </TableHead>
            <TableHead className="w-[15%] text-right">
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none ml-auto"
                onClick={() => onSort('quantity')}
              >
                Quantity
                {renderSortIcon('quantity')}
              </button>
            </TableHead>
            <TableHead className="w-[15%]">
              <button
                type="button"
                className="inline-flex items-center text-xs font-semibold text-foreground uppercase tracking-wider hover:text-primary transition-colors focus-visible:outline-none"
                onClick={() => onSort('updatedAt')}
              >
                Last Updated
                {renderSortIcon('updatedAt')}
              </button>
            </TableHead>
            <TableHead className="w-[15%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {balances.map((b) => {
            const product = productsMap.get(b.productId);
            const warehouse = warehousesMap.get(b.warehouseId);
            const isZero = b.quantity === '0.0000' || b.quantity === '0';

            return (
              <TableRow key={b.id} className="hover:bg-muted/50 transition-colors">
                {/* Product Column */}
                <TableCell>
                  <div className="flex flex-col">
                    <Link
                      href={`/stock/product/${b.productId}`}
                      className="font-medium text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1"
                    >
                      {product?.name || `Product: ${b.productId.slice(0, 8)}...`}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      SKU: {product?.sku || '—'}
                      {product?.unitOfMeasure ? ` • ${product.unitOfMeasure}` : ''}
                    </span>
                  </div>
                </TableCell>

                {/* Warehouse Column */}
                <TableCell>
                  <div className="flex flex-col">
                    <Link
                      href={`/stock/warehouse/${b.warehouseId}`}
                      className="font-medium text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1"
                    >
                      {warehouse?.name || `Warehouse: ${b.warehouseId.slice(0, 8)}...`}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                    {warehouse?.code && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {warehouse.code}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Quantity Column */}
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-mono text-sm font-semibold ${
                        isZero ? 'text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {b.quantity}
                    </span>
                    {isZero && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted">
                        Zero Stock
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Last Updated */}
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {new Date(b.updatedAt).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                      <Link href={`/stock/${b.id}`} aria-label={`View details for balance ${b.id}`}>
                        Details
                      </Link>
                    </Button>
                    {canMutateStock && onMutateStock && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMutateStock(b)}
                        className="h-8 px-2 text-xs"
                        aria-label={`Mutate stock for balance ${b.id}`}
                      >
                        Mutate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
