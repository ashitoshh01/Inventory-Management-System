'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Package,
  Warehouse,
  FileText,
  KeyRound,
  User,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@repo/ui';
import type { StockLedgerEntryDto, StockLedgerEntryType } from '@repo/types';
import { useProducts } from '../../hooks/use-products';
import { useWarehouses } from '../../hooks/use-warehouses';

export interface StockLedgerDetailCardProps {
  entry: StockLedgerEntryDto;
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
          className="bg-emerald-600 hover:bg-emerald-600/90 text-white font-medium text-xs px-2.5 py-0.5"
        >
          RECEIPT
        </Badge>
      );
    case 'ISSUE':
      return (
        <Badge
          variant="destructive"
          className="bg-amber-600 hover:bg-amber-600/90 text-white font-medium text-xs px-2.5 py-0.5"
        >
          ISSUE
        </Badge>
      );
    case 'ADJUSTMENT':
      return (
        <Badge
          variant="secondary"
          className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium text-xs px-2.5 py-0.5"
        >
          ADJUSTMENT
        </Badge>
      );
    case 'OPENING':
    default:
      return (
        <Badge
          variant="outline"
          className="bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800 font-medium text-xs px-2.5 py-0.5"
        >
          OPENING
        </Badge>
      );
  }
}

export function StockLedgerDetailCard({ entry }: StockLedgerDetailCardProps) {
  const { data: productsResponse } = useProducts({ limit: 100 });
  const { data: warehousesResponse } = useWarehouses({ limit: 100 });

  const product = productsResponse?.data?.find((p) => p.id === entry.productId);
  const warehouse = warehousesResponse?.data?.find((w) => w.id === entry.warehouseId);

  const delta = formatQuantityDelta(entry.quantityDelta);

  const formattedDate = new Date(entry.createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Top back navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/stock/ledger"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Stock Ledger History
        </Link>
      </div>

      {/* Immutability Banner */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-3 text-sm">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">Immutable Audit Record</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            This entry is an immutable record of a stock mutation recorded in the ledger. Ledger
            entries cannot be altered, replaced, or deleted to maintain audit integrity.
          </p>
        </div>
      </div>

      {/* Main Ledger Detail Card */}
      <Card>
        <CardHeader className="border-b border-border pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-xl font-bold tracking-tight">
                  Stock Ledger Entry
                </CardTitle>
                {renderTypeBadge(entry.type)}
              </div>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                ID: {entry.id}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Balance Math Breakdown */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Inventory Balance Arithmetic
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border border-border">
              {/* Balance Before */}
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-xs text-muted-foreground">Balance Before</span>
                <p className="font-mono text-lg font-bold text-foreground">
                  {entry.quantityBefore}
                </p>
              </div>

              {/* Quantity Delta */}
              <div className="space-y-1 text-center">
                <span className="text-xs text-muted-foreground">Quantity Delta</span>
                <p
                  className={`font-mono text-lg font-bold ${
                    delta.isPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : delta.isNegative
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {delta.text}
                </p>
              </div>

              {/* Balance After */}
              <div className="space-y-1 text-center sm:text-right">
                <span className="text-xs text-muted-foreground">Balance After</span>
                <p className="font-mono text-lg font-bold text-foreground">{entry.quantityAfter}</p>
              </div>
            </div>
          </div>

          {/* Product & Warehouse Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Product */}
            <div className="space-y-2 rounded-md border border-border p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Package className="h-4 w-4 text-primary" />
                <span>Product</span>
              </div>
              <div>
                <Link
                  href={`/stock/product/${entry.productId}`}
                  className="font-medium text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1.5 text-sm"
                >
                  {product?.name || entry.productId}
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </Link>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <p>
                    SKU:{' '}
                    <span className="font-mono font-medium text-foreground">
                      {product?.sku || '—'}
                    </span>
                  </p>
                  {product?.unitOfMeasure && (
                    <p>
                      Unit of Measure:{' '}
                      <span className="font-medium text-foreground">{product.unitOfMeasure}</span>
                    </p>
                  )}
                  <p className="font-mono text-[11px] text-muted-foreground/70">
                    ID: {entry.productId}
                  </p>
                </div>
              </div>
            </div>

            {/* Warehouse */}
            <div className="space-y-2 rounded-md border border-border p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Warehouse className="h-4 w-4 text-primary" />
                <span>Warehouse</span>
              </div>
              <div>
                <Link
                  href={`/stock/warehouse/${entry.warehouseId}`}
                  className="font-medium text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1.5 text-sm"
                >
                  {warehouse?.name || entry.warehouseId}
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </Link>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {warehouse?.code && (
                    <p>
                      Code:{' '}
                      <span className="font-mono font-medium text-foreground">
                        {warehouse.code}
                      </span>
                    </p>
                  )}
                  <p className="font-mono text-[11px] text-muted-foreground/70">
                    ID: {entry.warehouseId}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Metadata & Reference */}
          <div className="border-t border-border pt-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Audit & Reference Details
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-md bg-muted/20 p-3 border border-border/50">
                <dt className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  Reference
                </dt>
                <dd className="font-medium text-foreground break-all">
                  {entry.referenceId
                    ? `${entry.referenceType ? `${entry.referenceType}: ` : ''}${entry.referenceId}`
                    : '—'}
                </dd>
              </div>

              <div className="rounded-md bg-muted/20 p-3 border border-border/50">
                <dt className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  Idempotency Key
                </dt>
                <dd className="font-mono text-xs text-foreground break-all">
                  {entry.idempotencyKey || '—'}
                </dd>
              </div>

              <div className="rounded-md bg-muted/20 p-3 border border-border/50">
                <dt className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <User className="h-3.5 w-3.5" />
                  Recorded By
                </dt>
                <dd className="font-mono text-xs text-foreground break-all">
                  {entry.createdById ? `User (${entry.createdById})` : 'System (Automated)'}
                </dd>
              </div>

              <div className="rounded-md bg-muted/20 p-3 border border-border/50">
                <dt className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  Metadata / Notes
                </dt>
                <dd className="text-xs text-foreground whitespace-pre-wrap font-mono">
                  {(entry.metadata?.notes as string | undefined) ||
                    (entry.metadata?.reason as string | undefined) ||
                    (entry.metadata ? JSON.stringify(entry.metadata) : '—')}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
