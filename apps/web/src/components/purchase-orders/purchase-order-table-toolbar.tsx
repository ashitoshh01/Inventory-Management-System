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
import { PURCHASE_ORDER_STATUS_VALUES, type PurchaseOrderStatus } from '@repo/types';

interface PurchaseOrderTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: PurchaseOrderStatus | undefined;
  onStatusChange: (status: PurchaseOrderStatus | undefined) => void;
  warehouseId: string | undefined;
  onWarehouseChange: (warehouseId: string | undefined) => void;
  isOverdue?: boolean | undefined;
  onIsOverdueChange?: (val: boolean | undefined) => void;
  receivingState?: 'OUTSTANDING' | 'RECEIVED' | undefined;
  onReceivingStateChange?: (val: 'OUTSTANDING' | 'RECEIVED' | undefined) => void;
  onReset: () => void;
}

export function PurchaseOrderTableToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  warehouseId,
  onWarehouseChange,
  isOverdue,
  onIsOverdueChange,
  receivingState,
  onReceivingStateChange,
  onReset,
}: PurchaseOrderTableToolbarProps) {
  const { data: warehouseResponse } = useWarehouses();
  const warehouses = warehouseResponse?.data || [];

  const isFiltered = Boolean(search || status || warehouseId || isOverdue || receivingState);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap gap-3 items-center">
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search PO or supplier..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search purchase orders"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-40">
          <Select
            value={status || 'ALL'}
            onValueChange={(val) =>
              onStatusChange(val === 'ALL' ? undefined : (val as PurchaseOrderStatus))
            }
          >
            <SelectTrigger className="h-9" aria-label="Filter by status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {PURCHASE_ORDER_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Warehouse Filter */}
        <div className="w-full sm:w-44">
          <Select
            value={warehouseId || 'ALL'}
            onValueChange={(val) => onWarehouseChange(val === 'ALL' ? undefined : val)}
          >
            <SelectTrigger className="h-9" aria-label="Filter by warehouse">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Receiving State Filter */}
        {onReceivingStateChange && (
          <div className="w-full sm:w-40">
            <Select
              value={receivingState || 'ALL'}
              onValueChange={(val) =>
                onReceivingStateChange(
                  val === 'ALL' ? undefined : (val as 'OUTSTANDING' | 'RECEIVED'),
                )
              }
            >
              <SelectTrigger className="h-9" aria-label="Filter by receiving state">
                <SelectValue placeholder="Receiving State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All States</SelectItem>
                <SelectItem value="OUTSTANDING">Ready to Receive</SelectItem>
                <SelectItem value="RECEIVED">Fully Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Overdue Quick Filter Button */}
        {onIsOverdueChange && (
          <Button
            type="button"
            variant={isOverdue ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => onIsOverdueChange(isOverdue ? undefined : true)}
            className="h-9 gap-1.5"
            aria-label="Filter overdue purchase orders"
          >
            Overdue Deliveries
          </Button>
        )}

        {/* Reset Filter Button */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={onReset}
            className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
            aria-label="Reset all filters"
          >
            <X className="mr-1.5 h-4 w-4" />
            Reset Filters
          </Button>
        )}
      </div>
    </div>
  );
}
