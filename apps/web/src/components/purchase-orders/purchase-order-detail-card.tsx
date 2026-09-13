'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Edit,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  User,
  Clock,
  Package,
  Truck,
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
import { PurchaseOrderStatusBadge } from './purchase-order-status-badge';
import { useWarehouse } from '../../hooks/use-warehouses';
import { useProducts } from '../../hooks/use-products';
import { usePermissions } from '../../hooks/use-permissions';
import { usePurchaseOrderReceipts } from '../../hooks/use-purchase-orders';
import { PurchaseOrderReceiveDialog } from './purchase-order-receive-dialog';
import { PurchaseOrderReconciliationCard } from './purchase-order-reconciliation-card';
import { PurchaseOrderAuditTrailCard } from './purchase-order-audit-trail-card';
import type { PurchaseOrderDto } from '@repo/types';
import type { PurchaseOrderActionType } from './purchase-order-action-dialog';

interface PurchaseOrderDetailCardProps {
  order: PurchaseOrderDto;
  onAction: (action: PurchaseOrderActionType) => void;
}

export function PurchaseOrderDetailCard({ order, onAction }: PurchaseOrderDetailCardProps) {
  const {
    canUpdatePurchaseOrder,
    canDeletePurchaseOrder,
    canSubmitPurchaseOrder,
    canApprovePurchaseOrder,
    canCancelPurchaseOrder,
    canReceivePurchaseOrder,
  } = usePermissions();

  const [isReceiveOpen, setIsReceiveOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<
    'lines' | 'receipts' | 'reconciliation' | 'audit'
  >('lines');

  const { data: warehouseRes } = useWarehouse(order.warehouseId);
  const warehouse = warehouseRes?.data;

  const { data: receiptsRes, isLoading: isLoadingReceipts } = usePurchaseOrderReceipts(order.id);
  const receipts = receiptsRes?.data || [];

  const { data: productsRes } = useProducts({ limit: 100 });
  const products = productsRes?.data || [];
  const productMap = React.useMemo(() => {
    const map = new Map<string, { name: string; sku: string }>();
    for (const p of products) {
      map.set(p.id, { name: p.name, sku: p.sku });
    }
    return map;
  }, [products]);

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

  const isDraft = order.status === 'DRAFT';
  const isSubmitted = order.status === 'SUBMITTED';
  const isApproved = order.status === 'APPROVED';
  const isPartiallyReceived = order.status === 'PARTIALLY_RECEIVED';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border border-border">
        <CardHeader className="border-b border-border pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl font-bold tracking-tight font-mono">
                  {order.purchaseOrderNumber}
                </CardTitle>
                <PurchaseOrderStatusBadge status={order.status} />
              </div>
              <CardDescription className="text-sm">
                Supplier:{' '}
                <span className="font-semibold text-foreground">{order.supplierName}</span>
                {order.supplierEmail && ` (${order.supplierEmail})`}
              </CardDescription>
            </div>

            {/* Lifecycle Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {isDraft && (
                <>
                  {canUpdatePurchaseOrder && (
                    <Link href={`/purchase-orders/${order.id}/edit`}>
                      <Button variant="outline" size="sm" className="h-9">
                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                        Edit Order
                      </Button>
                    </Link>
                  )}
                  {canSubmitPurchaseOrder && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onAction('submit')}
                      className="h-9"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Submit
                    </Button>
                  )}
                  {canCancelPurchaseOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction('cancel')}
                      className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                  {canDeletePurchaseOrder && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAction('delete')}
                      className="h-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </>
              )}

              {isSubmitted && (
                <>
                  {canApprovePurchaseOrder && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onAction('approve')}
                      className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Approve Order
                    </Button>
                  )}
                  {canCancelPurchaseOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction('cancel')}
                      className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                </>
              )}

              {isApproved && (
                <>
                  {canReceivePurchaseOrder && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsReceiveOpen(true)}
                      className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Truck className="mr-1.5 h-3.5 w-3.5" />
                      Receive Goods
                    </Button>
                  )}
                  {canCancelPurchaseOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction('cancel')}
                      className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Cancel Order
                    </Button>
                  )}
                </>
              )}

              {isPartiallyReceived && (
                <>
                  {canReceivePurchaseOrder && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsReceiveOpen(true)}
                      className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Truck className="mr-1.5 h-3.5 w-3.5" />
                      Receive Goods
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Target Warehouse</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {warehouse ? `${warehouse.name} (${warehouse.code})` : order.warehouseId}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Order Date</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {formatDate(order.orderDate)}
                </p>
                {order.expectedDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Expected: {formatDate(order.expectedDate)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Created / Updated</p>
                <p className="text-xs text-foreground mt-0.5">
                  Created: {formatDate(order.createdAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Updated: {formatDate(order.updatedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Approval Info</p>
                <p className="text-xs text-foreground mt-0.5">
                  {order.approvedAt
                    ? `Approved ${formatDate(order.approvedAt)}`
                    : 'Not yet approved'}
                </p>
                {order.approvedById && (
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                    By: {order.approvedById}
                  </p>
                )}
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="mt-6 rounded-lg bg-muted/30 p-3 text-xs border border-border/60">
              <span className="font-semibold text-foreground">Order Notes: </span>
              <span className="text-muted-foreground">{order.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Authoritative Financial Totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Subtotal</p>
              <p className="text-2xl font-bold font-mono text-foreground mt-1">
                {order.currency} {order.subtotal}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tax Total (Server Auth)</p>
              <p className="text-2xl font-bold font-mono text-foreground mt-1">
                {order.currency} {order.taxTotal}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-primary/40 bg-primary/5">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-primary font-semibold">Grand Total</p>
              <p className="text-2xl font-bold font-mono text-primary mt-1">
                {order.currency} {order.grandTotal}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/80 overflow-x-auto pb-1">
        <Button
          variant={activeTab === 'lines' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('lines')}
          className="h-9 gap-1.5 font-medium text-xs"
        >
          <Package className="h-4 w-4" />
          Line Items ({order.lines?.length || 0})
        </Button>
        <Button
          variant={activeTab === 'receipts' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('receipts')}
          className="h-9 gap-1.5 font-medium text-xs"
        >
          <Truck className="h-4 w-4" />
          Goods Receipts ({receipts.length})
        </Button>
        <Button
          variant={activeTab === 'reconciliation' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('reconciliation')}
          className="h-9 gap-1.5 font-medium text-xs text-primary"
        >
          <CheckCircle2 className="h-4 w-4" />
          Reconciliation
        </Button>
        <Button
          variant={activeTab === 'audit' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('audit')}
          className="h-9 gap-1.5 font-medium text-xs"
        >
          <Clock className="h-4 w-4" />
          Audit History
        </Button>
      </div>

      {/* Tab 1: Order Lines Table */}
      {activeTab === 'lines' && (
        <Card className="border border-border">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Line Items ({order.lines?.length || 0})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity Ordered</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    <TableHead className="text-right">Received Qty</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines && order.lines.length > 0 ? (
                    order.lines.map((line, idx) => {
                      const prodInfo = productMap.get(line.productId);
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            {prodInfo ? (
                              <div>
                                <p className="text-xs font-semibold text-foreground">
                                  {prodInfo.name}
                                </p>
                                <p className="text-[11px] font-mono text-muted-foreground">
                                  {prodInfo.sku}
                                </p>
                              </div>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground">
                                {line.productId}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {line.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {order.currency} {line.unitPrice}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                            {order.currency} {line.lineTotal}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-blue-600 font-semibold">
                            {line.receivedQuantity}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {line.notes || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-xs text-muted-foreground"
                      >
                        No line items recorded for this purchase order.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Goods Receipts History */}
      {(activeTab === 'lines' || activeTab === 'receipts') && (
        <Card className="border border-border">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-base font-semibold">
                  Goods Receipt History ({receipts.length})
                </CardTitle>
              </div>
              {(isApproved || isPartiallyReceived) && canReceivePurchaseOrder && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                  onClick={() => setIsReceiveOpen(true)}
                >
                  <Truck className="h-3.5 w-3.5" />
                  Receive Goods
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {isLoadingReceipts ? (
              <div className="space-y-3">
                <div className="h-16 rounded-md bg-muted/40 animate-pulse" />
                <div className="h-16 rounded-md bg-muted/40 animate-pulse" />
              </div>
            ) : receipts.length > 0 ? (
              <div className="space-y-4">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="rounded-lg border border-border/80 bg-card p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {receipt.receiptNumber}
                        </span>
                        {receipt.notes && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            &quot;{receipt.notes}&quot;
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Received: {new Date(receipt.receivedAt).toLocaleString()}</span>
                        {receipt.receivedById && (
                          <span>By User: {receipt.receivedById.slice(0, 8)}</span>
                        )}
                      </div>
                    </div>

                    {receipt.lines && receipt.lines.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-[11px]">
                              <TableHead className="py-1.5">Product</TableHead>
                              <TableHead className="py-1.5 text-right">Quantity Received</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {receipt.lines.map((rl) => {
                              const prod = productMap.get(rl.productId);
                              return (
                                <TableRow key={rl.id} className="text-xs">
                                  <TableCell className="py-1.5">
                                    <span className="font-medium text-foreground">
                                      {prod ? prod.name : rl.productId}
                                    </span>
                                    {prod && (
                                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                                        ({prod.sku})
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right font-mono font-semibold text-emerald-600">
                                    +{rl.quantityReceived}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No goods have been received against this purchase order yet.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Live Inventory Reconciliation */}
      {activeTab === 'reconciliation' && (
        <PurchaseOrderReconciliationCard purchaseOrderId={order.id} />
      )}

      {/* Tab 4: Audit History Timeline */}
      {activeTab === 'audit' && <PurchaseOrderAuditTrailCard purchaseOrderId={order.id} />}

      {/* Receive Inventory Modal */}
      <PurchaseOrderReceiveDialog
        open={isReceiveOpen}
        onOpenChange={setIsReceiveOpen}
        order={order}
      />
    </div>
  );
}
