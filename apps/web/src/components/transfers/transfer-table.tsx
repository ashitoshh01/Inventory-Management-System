'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Trash2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  FilePlus,
  ArrowRight,
} from 'lucide-react';
import type { StockTransferDto, SortOrder, AllowedStockTransferSortField } from '@repo/types';
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
} from '@repo/ui';
import { TransferStatusBadge } from './transfer-status-badge';
import { usePermissions } from '../../hooks/use-permissions';
import type { TransferActionType } from './transfer-action-dialog';

interface TransferTableProps {
  transfers?: StockTransferDto[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  sortBy?: AllowedStockTransferSortField | undefined;
  sortOrder?: SortOrder | undefined;
  onSort?: ((field: AllowedStockTransferSortField) => void) | undefined;
  onAction?: ((transfer: StockTransferDto, action: TransferActionType) => void) | undefined;
  onAddNew?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  hasFilters?: boolean | undefined;
  onResetFilters?: (() => void) | undefined;
}

export function TransferTable({
  transfers = [],
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
}: TransferTableProps) {
  const router = useRouter();
  const {
    canUpdateTransfer,
    canDeleteTransfer,
    canApproveTransfer,
    canShipTransfer,
    canReceiveTransfer,
    canCancelTransfer,
  } = usePermissions();

  const renderSortIndicator = (field: AllowedStockTransferSortField) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? (
        <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      ) : (
        <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      );
    }
    return (
      <ArrowUpDown
        className="ml-1.5 h-3.5 w-3.5 text-muted-foreground/40 shrink-0"
        aria-hidden="true"
      />
    );
  };

  const handleSort = (field: AllowedStockTransferSortField) => {
    if (onSort) {
      onSort(field);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Transfer #</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[180px]">Source Hub</TableHead>
              <TableHead className="w-[180px]">Destination Hub</TableHead>
              <TableHead className="w-[80px] text-right">Items</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-8 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-8 rounded ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 my-4">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Failed to load stock transfers
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            {error?.message || 'An unexpected error occurred while fetching the transfer records.'}
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!transfers || transfers.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-10">
        <EmptyState
          title={hasFilters ? 'No stock transfers match your filters' : 'No stock transfers yet'}
          description={
            hasFilters
              ? 'Try broadening your search criteria or resetting filters to view all transfers.'
              : 'Create your first inter-warehouse transfer to dispatch and receive inventory between hubs.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={onResetFilters} className="mt-2">
                Reset Filters
              </Button>
            ) : onAddNew ? (
              <Button size="sm" onClick={onAddNew} className="mt-2 gap-2">
                <FilePlus className="h-4 w-4" />
                Create Stock Transfer
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
          <TableRow>
            <TableHead className="w-[150px]">
              <button
                type="button"
                className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort('transferNumber')}
              >
                Transfer #{renderSortIndicator('transferNumber')}
              </button>
            </TableHead>
            <TableHead className="w-[120px]">
              <button
                type="button"
                className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort('status')}
              >
                Status
                {renderSortIndicator('status')}
              </button>
            </TableHead>
            <TableHead className="w-[190px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Source Hub
              </span>
            </TableHead>
            <TableHead className="w-[190px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Destination Hub
              </span>
            </TableHead>
            <TableHead className="w-[90px] text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Items
              </span>
            </TableHead>
            <TableHead className="w-[140px]">
              <button
                type="button"
                className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => handleSort('createdAt')}
              >
                Created
                {renderSortIndicator('createdAt')}
              </button>
            </TableHead>
            <TableHead className="w-[60px] text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((transfer) => {
            const itemCount = transfer.lines?.length || 0;
            const createdFormatted = new Date(transfer.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <TableRow
                key={transfer.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => router.push(`/transfers/${transfer.id}`)}
              >
                {/* Transfer # */}
                <TableCell className="font-medium font-mono text-sm text-primary">
                  <Link
                    href={`/transfers/${transfer.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {transfer.transferNumber}
                  </Link>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <TransferStatusBadge status={transfer.status} />
                </TableCell>

                {/* Source Warehouse */}
                <TableCell className="text-sm font-medium">
                  {transfer.sourceWarehouse?.name || '—'}
                </TableCell>

                {/* Destination Warehouse */}
                <TableCell className="text-sm font-medium">
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{transfer.destinationWarehouse?.name || '—'}</span>
                  </div>
                </TableCell>

                {/* Items */}
                <TableCell className="text-right text-sm font-mono">{itemCount}</TableCell>

                {/* Created Date */}
                <TableCell className="text-xs text-muted-foreground">{createdFormatted}</TableCell>

                {/* Actions Dropdown */}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={`Actions for transfer ${transfer.transferNumber}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => router.push(`/transfers/${transfer.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>

                      {transfer.status === 'DRAFT' && canUpdateTransfer && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/transfers/${transfer.id}/edit`)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Transfer
                        </DropdownMenuItem>
                      )}

                      {transfer.status === 'DRAFT' && canApproveTransfer && (
                        <DropdownMenuItem
                          onClick={() => onAction && onAction(transfer, 'approve')}
                          className="text-blue-600 focus:text-blue-600"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve Transfer
                        </DropdownMenuItem>
                      )}

                      {transfer.status === 'APPROVED' && canShipTransfer && (
                        <DropdownMenuItem
                          onClick={() => onAction && onAction(transfer, 'ship')}
                          className="text-amber-600 focus:text-amber-600"
                        >
                          <Truck className="mr-2 h-4 w-4" />
                          Dispatch Stock
                        </DropdownMenuItem>
                      )}

                      {transfer.status === 'IN_TRANSIT' && canReceiveTransfer && (
                        <DropdownMenuItem
                          onClick={() => onAction && onAction(transfer, 'receive')}
                          className="text-emerald-600 focus:text-emerald-600"
                        >
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Receive Stock
                        </DropdownMenuItem>
                      )}

                      {(transfer.status === 'DRAFT' || transfer.status === 'APPROVED') &&
                        canCancelTransfer && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onAction && onAction(transfer, 'cancel')}
                              className="text-rose-600 focus:text-rose-600"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel Transfer
                            </DropdownMenuItem>
                          </>
                        )}

                      {transfer.status === 'DRAFT' && canDeleteTransfer && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onAction && onAction(transfer, 'delete')}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Draft
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
  );
}
