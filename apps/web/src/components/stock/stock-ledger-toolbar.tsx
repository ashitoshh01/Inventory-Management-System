'use client';

import * as React from 'react';
import { X, RotateCcw } from 'lucide-react';
import {
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import type { StockLedgerEntryType } from '@repo/types';
import { useProducts } from '../../hooks/use-products';
import { useWarehouses } from '../../hooks/use-warehouses';

export interface StockLedgerToolbarProps {
  productId?: string | undefined;
  onProductChange: (productId?: string) => void;
  warehouseId?: string | undefined;
  onWarehouseChange: (warehouseId?: string) => void;
  type?: StockLedgerEntryType | undefined;
  onTypeChange: (type?: StockLedgerEntryType) => void;
  onReset: () => void;
}

const LEDGER_TYPES: { label: string; value: StockLedgerEntryType }[] = [
  { label: 'Opening Balance', value: 'OPENING' },
  { label: 'Stock Receipt', value: 'RECEIPT' },
  { label: 'Stock Issue', value: 'ISSUE' },
  { label: 'Stock Adjustment', value: 'ADJUSTMENT' },
];

export function StockLedgerToolbar({
  productId,
  onProductChange,
  warehouseId,
  onWarehouseChange,
  type,
  onTypeChange,
  onReset,
}: StockLedgerToolbarProps) {
  const { data: productsResponse } = useProducts({ limit: 100 });
  const { data: warehousesResponse } = useWarehouses({ limit: 100 });

  const products = productsResponse?.data ?? [];
  const warehouses = warehousesResponse?.data ?? [];

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const selectedTypeLabel = LEDGER_TYPES.find((t) => t.value === type)?.label;

  const hasFilters = Boolean(productId || warehouseId || type);
  const activeFilterCount = (productId ? 1 : 0) + (warehouseId ? 1 : 0) + (type ? 1 : 0);

  return (
    <div className="space-y-2 py-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Product Filter */}
          <div className="w-full sm:w-[220px]">
            <Select
              value={productId || 'ALL'}
              onValueChange={(val) => onProductChange(val === 'ALL' ? undefined : val)}
            >
              <SelectTrigger
                aria-label="Filter by product"
                className={`h-9 text-sm ${productId ? 'border-primary text-foreground font-medium' : ''}`}
              >
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warehouse Filter */}
          <div className="w-full sm:w-[220px]">
            <Select
              value={warehouseId || 'ALL'}
              onValueChange={(val) => onWarehouseChange(val === 'ALL' ? undefined : val)}
            >
              <SelectTrigger
                aria-label="Filter by warehouse"
                className={`h-9 text-sm ${warehouseId ? 'border-primary text-foreground font-medium' : ''}`}
              >
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="w-full sm:w-[190px]">
            <Select
              value={type || 'ALL'}
              onValueChange={(val) =>
                onTypeChange(val === 'ALL' ? undefined : (val as StockLedgerEntryType))
              }
            >
              <SelectTrigger
                aria-label="Filter by mutation type"
                className={`h-9 text-sm ${type ? 'border-primary text-foreground font-medium' : ''}`}
              >
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {LEDGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset button */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              aria-label="Reset all stock ledger filters"
              className="h-9 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <span className="font-medium">Active filters:</span>

          {productId && (
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-normal bg-muted text-foreground border border-border"
            >
              <span>Product: {selectedProduct?.name || productId}</span>
              <button
                type="button"
                aria-label="Remove product filter"
                onClick={() => onProductChange(undefined)}
                className="hover:text-destructive focus-visible:outline-none rounded-sm ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {warehouseId && (
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-normal bg-muted text-foreground border border-border"
            >
              <span>Warehouse: {selectedWarehouse?.name || warehouseId}</span>
              <button
                type="button"
                aria-label="Remove warehouse filter"
                onClick={() => onWarehouseChange(undefined)}
                className="hover:text-destructive focus-visible:outline-none rounded-sm ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {type && (
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-normal bg-muted text-foreground border border-border"
            >
              <span>Type: {selectedTypeLabel || type}</span>
              <button
                type="button"
                aria-label="Remove type filter"
                onClick={() => onTypeChange(undefined)}
                className="hover:text-destructive focus-visible:outline-none rounded-sm ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
