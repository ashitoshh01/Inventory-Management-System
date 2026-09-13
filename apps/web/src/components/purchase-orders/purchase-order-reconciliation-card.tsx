'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { usePurchaseOrderReconciliation } from '../../hooks/use-purchase-orders';

interface PurchaseOrderReconciliationCardProps {
  purchaseOrderId: string;
}

export function PurchaseOrderReconciliationCard({
  purchaseOrderId,
}: PurchaseOrderReconciliationCardProps) {
  const {
    data: recRes,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = usePurchaseOrderReconciliation(purchaseOrderId);
  const rec = recRes?.data;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !rec) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Reconciliation Unavailable
          </CardTitle>
          <CardDescription>
            Could not verify inventory reconciliation for this purchase order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={rec.isReconciled ? 'border-emerald-500/30' : 'border-destructive/40'}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Inventory Reconciliation Status
            </CardTitle>
            <Badge
              variant={rec.isReconciled ? 'outline' : 'destructive'}
              className={
                rec.isReconciled
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10 font-semibold'
                  : 'font-semibold'
              }
            >
              {rec.isReconciled ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> RECONCILED (0 DISCREPANCIES)
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> DISCREPANCY DETECTED
                </span>
              )}
            </Badge>
          </div>
          <CardDescription className="mt-1">
            Mathematical cross-verification: PO Lines ↔ GoodsReceipt ↔ StockLedger ↔ Physical Stock.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Verify Now
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quantity Reconciliation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-muted/30 rounded-lg border">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-medium">
              Total Ordered
            </span>
            <div className="text-lg font-bold font-mono mt-0.5">{rec.totalOrderedQuantity}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-medium">
              Total Received
            </span>
            <div className="text-lg font-bold font-mono mt-0.5 text-blue-600">
              {rec.totalReceivedQuantity}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-medium">Remaining</span>
            <div className="text-lg font-bold font-mono mt-0.5 text-amber-600">
              {rec.totalRemainingQuantity}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-medium">
              Goods Receipts Sum
            </span>
            <div className="text-lg font-bold font-mono mt-0.5 text-purple-600">
              {rec.totalGoodsReceiptQuantity}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-medium">
              Stock Ledger Delta
            </span>
            <div className="text-lg font-bold font-mono mt-0.5 text-emerald-600">
              {rec.totalReceiptLedgerDelta}
            </div>
          </div>
        </div>

        {/* Discrepancies Alert if Any */}
        {rec.discrepancies.length > 0 && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm space-y-1">
            <h4 className="font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Discrepancies Found:
            </h4>
            <ul className="list-disc pl-5 text-destructive/90 space-y-0.5">
              {rec.discrepancies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Line Items Detail Breakdown */}
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Product / SKU</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Goods Receipts</TableHead>
                <TableHead className="text-right">Stock Ledger Delta</TableHead>
                <TableHead className="text-center">Line Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rec.lines.map((line) => (
                <TableRow key={line.purchaseOrderLineId}>
                  <TableCell>
                    <div className="font-medium text-sm">{line.productName}</div>
                    <div className="text-xs font-mono text-muted-foreground">{line.productSku}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {line.orderedQuantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-blue-600">
                    {line.receivedQuantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-amber-600">
                    {line.remainingQuantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-purple-600">
                    {line.goodsReceiptQuantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600">
                    {line.ledgerDeltaQuantity}
                  </TableCell>
                  <TableCell className="text-center">
                    {line.isLineReconciled ? (
                      <Badge
                        variant="outline"
                        className="text-xs border-emerald-500 text-emerald-600 bg-emerald-500/10"
                      >
                        MATCH
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        MISMATCH
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
