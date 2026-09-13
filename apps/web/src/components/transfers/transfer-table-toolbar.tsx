'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import {
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@repo/ui';
import { useWarehouses } from '../../hooks/use-warehouses';
import { STOCK_TRANSFER_STATUS_VALUES, type StockTransferStatus } from '@repo/types';

interface TransferTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StockTransferStatus | undefined;
  onStatusChange: (status: StockTransferStatus | undefined) => void;
  sourceWarehouseId: string | undefined;
  onSourceWarehouseChange: (id: string | undefined) => void;
  destinationWarehouseId: string | undefined;
  onDestinationWarehouseChange: (id: string | undefined) => void;
  onReset: () => void;
}

export function TransferTableToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sourceWarehouseId,
  onSourceWarehouseChange,
  destinationWarehouseId,
  onDestinationWarehouseChange,
  onReset,
}: TransferTableToolbarProps) {
  const { data: warehouseResponse } = useWarehouses();
  const warehouses = warehouseResponse?.data || [];

  const isFiltered = Boolean(search || status || sourceWarehouseId || destinationWarehouseId);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap gap-3 items-center">
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transfer # or notes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search stock transfers"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-40">
          <Select
            value={status || 'ALL'}
            onValueChange={(val) =>
              onStatusChange(val === 'ALL' ? undefined : (val as StockTransferStatus))
            }
          >
            <SelectTrigger className="h-9" aria-label="Filter by status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {STOCK_TRANSFER_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Source Warehouse Filter */}
        <div className="w-full sm:w-44">
          <Select
            value={sourceWarehouseId || 'ALL'}
            onValueChange={(val) => onSourceWarehouseChange(val === 'ALL' ? undefined : val)}
          >
            <SelectTrigger className="h-9" aria-label="Filter by source warehouse">
              <SelectValue placeholder="Source: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Source: All</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Destination Warehouse Filter */}
        <div className="w-full sm:w-44">
          <Select
            value={destinationWarehouseId || 'ALL'}
            onValueChange={(val) => onDestinationWarehouseChange(val === 'ALL' ? undefined : val)}
          >
            <SelectTrigger className="h-9" aria-label="Filter by destination warehouse">
              <SelectValue placeholder="Dest: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Dest: All</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset Filter Button */}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-9 px-2 lg:px-3 text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
