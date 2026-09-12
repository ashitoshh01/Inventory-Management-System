'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Package,
  Warehouse,
  Boxes,
  SlidersHorizontal,
  ExternalLink,
  History,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@repo/ui';
import type { StockBalanceDto } from '@repo/types';
import { useProducts } from '../../hooks/use-products';
import { useWarehouses } from '../../hooks/use-warehouses';
import { usePermissions } from '../../hooks/use-permissions';

export interface StockDetailCardProps {
  balance: StockBalanceDto;
  onMutate?: () => void;
}

export function StockDetailCard({ balance, onMutate }: StockDetailCardProps) {
  const { canMutateStock } = usePermissions();
  const { data: productsResponse } = useProducts({ limit: 100 });
  const { data: warehousesResponse } = useWarehouses({ limit: 100 });

  const product = productsResponse?.data?.find((p) => p.id === balance.productId);
  const warehouse = warehousesResponse?.data?.find((w) => w.id === balance.warehouseId);

  const isZero = balance.quantity === '0.0000' || balance.quantity === '0';

  const formattedCreated = new Date(balance.createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedUpdated = new Date(balance.updatedAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Top back navigation and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/stock"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Stock Balances
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/stock/ledger?productId=${balance.productId}&warehouseId=${balance.warehouseId}`}
            >
              <History className="mr-2 h-4 w-4" />
              View Ledger History
            </Link>
          </Button>
          {canMutateStock && onMutate && (
            <Button onClick={onMutate} size="sm">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Adjust / Mutate Stock
            </Button>
          )}
        </div>
      </div>

      {/* Main Stock Balance Card */}
      <Card>
        <CardHeader className="border-b border-border pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {product?.name || `Product: ${balance.productId}`}
                </CardTitle>
                {isZero ? (
                  <Badge variant="secondary">Zero Stock</Badge>
                ) : (
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
                  >
                    In Stock
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm">
                Warehouse:{' '}
                <span className="font-semibold text-foreground">
                  {warehouse?.name || balance.warehouseId}
                </span>
                {warehouse?.code && ` (${warehouse.code})`}
              </CardDescription>
            </div>
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Current Balance
              </span>
              <span className="text-3xl font-bold font-mono text-foreground">
                {balance.quantity}
              </span>
              {product?.unitOfMeasure && (
                <span className="text-xs text-muted-foreground">Unit: {product.unitOfMeasure}</span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Attributes Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Product link box */}
            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center">
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  Product Details
                </span>
                <Link
                  href={`/products/${balance.productId}`}
                  className="hover:text-primary transition-colors inline-flex items-center gap-0.5"
                >
                  View <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-base font-semibold text-foreground">
                {product?.name || balance.productId}
              </p>
              <p className="text-xs text-muted-foreground">
                SKU: <span className="font-mono">{product?.sku || '—'}</span>
              </p>
            </div>

            {/* Warehouse link box */}
            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center">
                  <Warehouse className="mr-1.5 h-3.5 w-3.5" />
                  Warehouse Details
                </span>
                <Link
                  href={`/warehouses/${balance.warehouseId}`}
                  className="hover:text-primary transition-colors inline-flex items-center gap-0.5"
                >
                  View <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-base font-semibold text-foreground">
                {warehouse?.name || balance.warehouseId}
              </p>
              <p className="text-xs text-muted-foreground">
                Code: <span className="font-mono">{warehouse?.code || '—'}</span>
              </p>
            </div>

            {/* Entity Identification */}
            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Boxes className="mr-1.5 h-3.5 w-3.5" />
                Balance ID
              </div>
              <p
                className="text-xs font-mono font-medium text-foreground truncate"
                title={balance.id}
              >
                {balance.id}
              </p>
              <p
                className="text-[10px] text-muted-foreground font-mono truncate"
                title={balance.organizationId}
              >
                Org: {balance.organizationId}
              </p>
            </div>

            {/* Date Created */}
            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                Date Created
              </div>
              <p className="text-sm font-semibold text-foreground">{formattedCreated}</p>
            </div>

            {/* Last Modified */}
            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Last Modified
              </div>
              <p className="text-sm font-semibold text-foreground">{formattedUpdated}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
