'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  FilePlus,
} from 'lucide-react';
import type { PurchaseOrderDto, SortOrder } from '@repo/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Skeleton,
  EmptyState,
  Card,
  CardContent,
  Badge,
} from '@repo/ui';
import { PurchaseOrderStatusBadge } from './purchase-order-status-badge';
import { useWarehouses } from '../../hooks/use-warehouses';
import { usePermissions } from '../../hooks/use-permissions';
import type { PurchaseOrderActionType } from './purchase-order-action-dialog';

interface PurchaseOrderTableProps {
  orders?: PurchaseOrderDto[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
  onSort?: ((field: string) => void) | undefined;
  onAction?: ((order: PurchaseOrderDto, action: PurchaseOrderActionType) => void) | undefined;
  onAddNew?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  hasFilters?: boolean | undefined;
  onResetFilters?: (() => void) | undefined;
}

export function PurchaseOrderTable({
  orders = [],
  isLoading,
  isError,
  error,
  sortBy,
  sortOrder,
  onSort,
  onAction,
  onAddNew,
  onRetry,
  hasFilters = false,
  onResetFilters,
}: PurchaseOrderTableProps) {
  const router = useRouter();
  const {
    canUpdatePurchaseOrder,
    canDeletePurchaseOrder,
    canSubmitPurchaseOrder,
    canApprovePurchaseOrder,
    canCancelPurchaseOrder,
  } = usePermissions();

  const { data: warehouseRes } = useWarehouses();
  const warehouses = warehouseRes?.data || [];
  const warehouseMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) {
      map.set(w.id, w.name);
    }
    return map;
  }, [warehouses]);

  const renderSortIndicator = (field: string) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? (
        <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      ) : (
        <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      );
    }
    return (
      <ArrowUpDown
        className="ml-1.5 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0"
        aria-hidden="true"
      />
    );
  };

  const getAriaSort = (field: string): 'ascending' | 'descending' | 'none' => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? 'ascending' : 'descending';
    }
    return 'none';
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (onSort && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSort(field);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">PO Number</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Grand Total</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead className="w-[70px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-5 w-20 ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border rounded-md border-destructive/20 bg-destructive/5 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <h3 className="text-base font-semibold text-foreground">Failed to load purchase orders</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {error?.message || 'An error occurred while fetching purchase orders. Please try again.'}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (orders.length === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          title="No purchase orders match your filters"
          description="Try clearing or adjusting your search, status, or warehouse filters."
          action={
            onResetFilters ? (
              <Button variant="outline" size="sm" onClick={onResetFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <EmptyState
        title="No purchase orders yet"
        description="Get started by creating your first purchase order to request goods from suppliers."
        action={
          onAddNew ? (
            <Button size="sm" onClick={onAddNew}>
              <FilePlus className="mr-2 h-4 w-4" />
              Create Purchase Order
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card View (< 768px) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {orders.map((po) => {
          const isDraft = po.status === 'DRAFT';
          const isSubmitted = po.status === 'SUBMITTED';
          const isOverdue = Boolean(
            po.expectedDate &&
            new Date(po.expectedDate) < new Date() &&
            (po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED'),
          );

          return (
            <Card key={po.id} className="border border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="font-mono text-sm font-bold text-foreground hover:underline"
                    >
                      {po.purchaseOrderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{po.supplierName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <PurchaseOrderStatusBadge status={po.status} />
                      {isOverdue && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0 font-bold uppercase"
                        >
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                  <div>
                    <span className="text-muted-foreground block">Warehouse:</span>
                    <span className="font-medium text-foreground">
                      {warehouseMap.get(po.warehouseId) || po.warehouseId}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block">Grand Total:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {po.currency} {po.grandTotal}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Order Date:</span>
                    <span>{formatDate(po.orderDate)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => router.push(`/purchase-orders/${po.id}`)}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    View
                  </Button>
                  {isDraft && canUpdatePurchaseOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => router.push(`/purchase-orders/${po.id}/edit`)}
                    >
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}
                  {isDraft && canSubmitPurchaseOrder && onAction && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => onAction(po, 'submit')}
                    >
                      <Send className="mr-1 h-3.5 w-3.5" />
                      Submit
                    </Button>
                  )}
                  {isSubmitted && canApprovePurchaseOrder && onAction && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => onAction(po, 'approve')}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {/* PO Number */}
              <TableHead
                aria-sort={getAriaSort('purchaseOrderNumber')}
                className="cursor-pointer select-none group w-[160px]"
                onClick={() => onSort?.('purchaseOrderNumber')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'purchaseOrderNumber')}
                tabIndex={0}
                role="columnheader"
              >
                <div className="flex items-center">
                  <span>PO Number</span>
                  {renderSortIndicator('purchaseOrderNumber')}
                </div>
              </TableHead>

              {/* Warehouse */}
              <TableHead>Warehouse</TableHead>

              {/* Supplier */}
              <TableHead
                aria-sort={getAriaSort('supplierName')}
                className="cursor-pointer select-none group"
                onClick={() => onSort?.('supplierName')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'supplierName')}
                tabIndex={0}
                role="columnheader"
              >
                <div className="flex items-center">
                  <span>Supplier</span>
                  {renderSortIndicator('supplierName')}
                </div>
              </TableHead>

              {/* Status */}
              <TableHead
                aria-sort={getAriaSort('status')}
                className="cursor-pointer select-none group"
                onClick={() => onSort?.('status')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'status')}
                tabIndex={0}
                role="columnheader"
              >
                <div className="flex items-center">
                  <span>Status</span>
                  {renderSortIndicator('status')}
                </div>
              </TableHead>

              {/* Grand Total */}
              <TableHead
                aria-sort={getAriaSort('grandTotal')}
                className="cursor-pointer select-none group text-right"
                onClick={() => onSort?.('grandTotal')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'grandTotal')}
                tabIndex={0}
                role="columnheader"
              >
                <div className="flex items-center justify-end">
                  <span>Grand Total</span>
                  {renderSortIndicator('grandTotal')}
                </div>
              </TableHead>

              {/* Order Date */}
              <TableHead
                aria-sort={getAriaSort('orderDate')}
                className="cursor-pointer select-none group"
                onClick={() => onSort?.('orderDate')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'orderDate')}
                tabIndex={0}
                role="columnheader"
              >
                <div className="flex items-center">
                  <span>Order Date</span>
                  {renderSortIndicator('orderDate')}
                </div>
              </TableHead>

              {/* Actions */}
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {orders.map((po) => {
              const isDraft = po.status === 'DRAFT';
              const isSubmitted = po.status === 'SUBMITTED';
              const isApproved = po.status === 'APPROVED';

              return (
                <TableRow key={po.id}>
                  {/* PO Number */}
                  <TableCell className="font-mono text-xs font-semibold">
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="text-primary hover:underline"
                    >
                      {po.purchaseOrderNumber}
                    </Link>
                  </TableCell>

                  {/* Warehouse */}
                  <TableCell className="text-xs text-foreground">
                    {warehouseMap.get(po.warehouseId) || po.warehouseId}
                  </TableCell>

                  {/* Supplier */}
                  <TableCell className="text-xs font-medium text-foreground">
                    {po.supplierName}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {(() => {
                      const isOverdue = Boolean(
                        po.expectedDate &&
                        new Date(po.expectedDate) < new Date() &&
                        (po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED'),
                      );
                      const totalQty = po.lines?.reduce((s, l) => s + Number(l.quantity), 0) ?? 0;
                      const receivedQty =
                        po.lines?.reduce((s, l) => s + Number(l.receivedQuantity), 0) ?? 0;

                      return (
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PurchaseOrderStatusBadge status={po.status} />
                            {isOverdue && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0 font-bold uppercase tracking-wider"
                              >
                                Overdue
                              </Badge>
                            )}
                          </div>
                          {totalQty > 0 &&
                            (po.status === 'PARTIALLY_RECEIVED' ||
                              po.status === 'RECEIVED' ||
                              po.status === 'APPROVED') && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {receivedQty.toFixed(0)} / {totalQty.toFixed(0)} received
                              </span>
                            )}
                        </div>
                      );
                    })()}
                  </TableCell>

                  {/* Grand Total */}
                  <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                    {po.currency} {po.grandTotal}
                  </TableCell>

                  {/* Order Date */}
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(po.orderDate)}
                  </TableCell>

                  {/* Actions Dropdown */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          aria-label={`Actions for purchase order ${po.purchaseOrderNumber}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/purchase-orders/${po.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>

                        {isDraft && canUpdatePurchaseOrder && (
                          <DropdownMenuItem
                            onClick={() => router.push(`/purchase-orders/${po.id}/edit`)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Order
                          </DropdownMenuItem>
                        )}

                        {isDraft && canSubmitPurchaseOrder && onAction && (
                          <DropdownMenuItem onClick={() => onAction(po, 'submit')}>
                            <Send className="mr-2 h-4 w-4 text-blue-600" />
                            Submit Order
                          </DropdownMenuItem>
                        )}

                        {isSubmitted && canApprovePurchaseOrder && onAction && (
                          <DropdownMenuItem onClick={() => onAction(po, 'approve')}>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                            Approve Order
                          </DropdownMenuItem>
                        )}

                        {(isDraft || isSubmitted || isApproved) &&
                          canCancelPurchaseOrder &&
                          onAction && (
                            <DropdownMenuItem
                              onClick={() => onAction(po, 'cancel')}
                              className="text-destructive focus:text-destructive"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel Order
                            </DropdownMenuItem>
                          )}

                        {isDraft && canDeletePurchaseOrder && onAction && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onAction(po, 'delete')}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Order
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
