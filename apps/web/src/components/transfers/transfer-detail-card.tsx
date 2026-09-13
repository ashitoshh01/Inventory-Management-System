'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Edit,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Trash2,
  Building2,
  Boxes,
  FileText,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@repo/ui';
import { TransferStatusBadge } from './transfer-status-badge';
import { TransferAuditTrailCard } from './transfer-audit-trail-card';
import { usePermissions } from '../../hooks/use-permissions';
import type { StockTransferDto } from '@repo/types';
import type { TransferActionType } from './transfer-action-dialog';

interface TransferDetailCardProps {
  transfer: StockTransferDto;
  onAction: (action: TransferActionType) => void;
}

export function TransferDetailCard({ transfer, onAction }: TransferDetailCardProps) {
  const router = useRouter();
  const {
    canUpdateTransfer,
    canDeleteTransfer,
    canApproveTransfer,
    canShipTransfer,
    canReceiveTransfer,
    canCancelTransfer,
  } = usePermissions();

  const formatDate = (dateStr?: string | Date | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Contextual Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-mono text-foreground">
              {transfer.transferNumber}
            </h1>
            <TransferStatusBadge status={transfer.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created on {formatDate(transfer.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {transfer.status === 'DRAFT' && canUpdateTransfer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/transfers/${transfer.id}/edit`)}
              className="gap-1.5"
            >
              <Edit className="h-4 w-4" />
              Edit Transfer
            </Button>
          )}

          {transfer.status === 'DRAFT' && canApproveTransfer && (
            <Button
              size="sm"
              onClick={() => onAction('approve')}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Transfer
            </Button>
          )}

          {transfer.status === 'APPROVED' && canShipTransfer && (
            <Button
              size="sm"
              onClick={() => onAction('ship')}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Truck className="h-4 w-4" />
              Dispatch Stock
            </Button>
          )}

          {transfer.status === 'IN_TRANSIT' && canReceiveTransfer && (
            <Button
              size="sm"
              onClick={() => onAction('receive')}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PackageCheck className="h-4 w-4" />
              Receive Stock
            </Button>
          )}

          {(transfer.status === 'DRAFT' || transfer.status === 'APPROVED') && canCancelTransfer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('cancel')}
              className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50"
            >
              <XCircle className="h-4 w-4" />
              Cancel Transfer
            </Button>
          )}

          {transfer.status === 'DRAFT' && canDeleteTransfer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('delete')}
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete Draft
            </Button>
          )}
        </div>
      </div>

      {/* Warehouse Route Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Warehouse */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-blue-500" />
              Source Hub (Dispatch Origin)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-lg font-bold text-foreground">
              {transfer.sourceWarehouse?.name || 'Unknown Warehouse'}
            </div>
            {transfer.sourceWarehouse?.code && (
              <p className="text-xs font-mono text-muted-foreground">
                Code: {transfer.sourceWarehouse.code}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Destination Warehouse */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-emerald-500" />
              Destination Hub (Receipt Target)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-lg font-bold text-foreground">
              {transfer.destinationWarehouse?.name || 'Unknown Warehouse'}
            </div>
            {transfer.destinationWarehouse?.code && (
              <p className="text-xs font-mono text-muted-foreground">
                Code: {transfer.destinationWarehouse.code}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lifecycle Milestones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Transfer Lifecycle & Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Created</span>
              <p className="font-medium text-foreground mt-0.5">{formatDate(transfer.createdAt)}</p>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Approved</span>
              <p className="font-medium text-foreground mt-0.5">
                {transfer.approvedAt ? formatDate(transfer.approvedAt) : 'Pending'}
              </p>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Dispatched</span>
              <p className="font-medium text-foreground mt-0.5">
                {transfer.shippedAt ? formatDate(transfer.shippedAt) : 'Pending'}
              </p>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Received</span>
              <p className="font-medium text-foreground mt-0.5">
                {transfer.receivedAt ? formatDate(transfer.receivedAt) : 'Pending'}
              </p>
            </div>
          </div>

          {transfer.status === 'CANCELLED' && (
            <div className="mt-4 p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs">
              <span className="font-semibold text-rose-700 dark:text-rose-300 block">
                Cancelled on {formatDate(transfer.cancelledAt)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Notes */}
      {transfer.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Transfer Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">{transfer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Line Items Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Line Items ({transfer.lines?.length || 0})
          </CardTitle>
          <CardDescription>Products allocated for inter-warehouse transfer</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead className="w-[180px]">SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right w-[140px]">Quantity</TableHead>
                <TableHead className="w-[200px]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.lines && transfer.lines.length > 0 ? (
                transfer.lines.map((line, idx) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-mono font-medium text-sm">
                      {line.product?.sku || line.productId}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-foreground">
                      {line.product?.name || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-sm">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {line.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                    No line items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Trail Timeline */}
      <TransferAuditTrailCard transferId={transfer.id} />
    </div>
  );
}
