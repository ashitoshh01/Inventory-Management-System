'use client';

import * as React from 'react';
import { Truck, Loader2, AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Label,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@repo/ui';
import { useReceivePurchaseOrder } from '../../hooks/use-purchase-orders';
import { useProducts } from '../../hooks/use-products';
import { useWarehouse } from '../../hooks/use-warehouses';
import type { PurchaseOrderDto } from '@repo/types';

interface PurchaseOrderReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrderDto | null;
}

export function PurchaseOrderReceiveDialog({
  open,
  onOpenChange,
  order,
}: PurchaseOrderReceiveDialogProps) {
  const receiveMutation = useReceivePurchaseOrder();
  const { data: warehouseRes } = useWarehouse(order?.warehouseId);
  const warehouse = warehouseRes?.data;

  const { data: productsRes } = useProducts({ limit: 100 });
  const products = productsRes?.data || [];
  const productMap = React.useMemo(() => {
    const map = new Map<string, { name: string; sku: string }>();
    for (const p of products) {
      map.set(p.id, { name: p.name, sku: p.sku });
    }
    return map;
  }, [products]);

  // Line quantities state: lineId -> string quantity
  const [quantities, setQuantities] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Initialize or reset quantities when dialog opens or order changes
  React.useEffect(() => {
    if (open && order?.lines) {
      const initial: Record<string, string> = {};
      for (const line of order.lines) {
        initial[line.id] = '';
      }
      setQuantities(initial);
      setNotes('');
      setErrorMessage(null);
    }
  }, [open, order]);

  if (!order) return null;

  // Helper to compute remaining quantity for a line
  const getRemaining = (line: { quantity: string; receivedQuantity: string }): number => {
    const ordered = parseFloat(line.quantity) || 0;
    const received = parseFloat(line.receivedQuantity) || 0;
    return Math.max(0, ordered - received);
  };

  const getRemainingFormatted = (line: { quantity: string; receivedQuantity: string }): string => {
    const rem = getRemaining(line);
    return rem.toFixed(4);
  };

  // Quick action: Set all lines to their remaining quantity
  const handleReceiveAll = () => {
    if (!order.lines) return;
    const allRemaining: Record<string, string> = {};
    for (const line of order.lines) {
      const rem = getRemaining(line);
      if (rem > 0) {
        allRemaining[line.id] = rem.toFixed(4);
      } else {
        allRemaining[line.id] = '';
      }
    }
    setQuantities(allRemaining);
    setErrorMessage(null);
  };

  // Quick action: Clear all inputs
  const handleClearAll = () => {
    if (!order.lines) return;
    const cleared: Record<string, string> = {};
    for (const line of order.lines) {
      cleared[line.id] = '';
    }
    setQuantities(cleared);
    setErrorMessage(null);
  };

  // Set line to remaining
  const handleSetMax = (lineId: string) => {
    const line = order.lines?.find((l) => l.id === lineId);
    if (!line) return;
    const rem = getRemaining(line);
    setQuantities((prev) => ({
      ...prev,
      [lineId]: rem.toFixed(4),
    }));
    setErrorMessage(null);
  };

  const handleQuantityChange = (lineId: string, val: string) => {
    setQuantities((prev) => ({
      ...prev,
      [lineId]: val,
    }));
    setErrorMessage(null);
  };

  // Validation
  const validate = (): {
    isValid: boolean;
    payloadLines: Array<{ purchaseOrderLineId: string; quantity: string }>;
  } => {
    if (!order.lines || order.lines.length === 0) {
      setErrorMessage('Purchase order has no line items.');
      return { isValid: false, payloadLines: [] };
    }

    const payloadLines: Array<{ purchaseOrderLineId: string; quantity: string }> = [];

    for (const line of order.lines) {
      const rawVal = quantities[line.id]?.trim();
      if (!rawVal || rawVal === '' || rawVal === '0') {
        continue; // skip lines where 0 or nothing is received
      }

      const numVal = parseFloat(rawVal);
      if (isNaN(numVal) || numVal <= 0) {
        setErrorMessage(`Quantity for line must be a positive number greater than 0.`);
        return { isValid: false, payloadLines: [] };
      }

      const rem = getRemaining(line);
      if (numVal > rem + 0.00001) {
        const prod = productMap.get(line.productId);
        setErrorMessage(
          `Cannot receive ${rawVal} for "${prod?.name || line.productId}". Maximum remaining quantity is ${rem.toFixed(4)}.`,
        );
        return { isValid: false, payloadLines: [] };
      }

      // Exact decimal format to 4 places
      payloadLines.push({
        purchaseOrderLineId: line.id,
        quantity: numVal.toFixed(4),
      });
    }

    if (payloadLines.length === 0) {
      setErrorMessage('Please enter a receiving quantity (> 0) for at least one line item.');
      return { isValid: false, payloadLines: [] };
    }

    return { isValid: true, payloadLines };
  };

  const handleSubmit = async () => {
    const { isValid, payloadLines } = validate();
    if (!isValid) return;

    try {
      setErrorMessage(null);
      // Generate client-side UUID idempotency key to prevent double submits
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idem-rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await receiveMutation.mutateAsync({
        id: order.id,
        input: {
          lines: payloadLines,
          notes: notes.trim() || undefined,
        },
        idempotencyKey,
      });

      const receipt = res?.data?.receipt;
      const isReplay = res?.data?.isIdempotentReplay;

      if (isReplay) {
        toast.info(
          `Receipt ${receipt?.receiptNumber || ''} was previously recorded (idempotent replay).`,
        );
      } else {
        toast.success(
          `Goods receipt ${receipt?.receiptNumber || ''} created successfully. Physical inventory updated.`,
        );
      }

      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to receive goods against this purchase order.';
      setErrorMessage(msg);
      toast.error('Receipt failed', { description: msg });
    }
  };

  const isPending = receiveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(val) => !isPending && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Receive Goods Against PO</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                PO:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {order.purchaseOrderNumber}
                </span>{' '}
                • Receiving into Warehouse:{' '}
                <span className="font-semibold text-foreground">
                  {warehouse ? `${warehouse.name} (${warehouse.code})` : order.warehouseId}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Quick Batch Actions */}
        <div className="flex items-center justify-between py-1 border-b border-border text-xs">
          <span className="text-muted-foreground">
            Enter quantities received at the warehouse dock. Physical stock will be atomically
            updated.
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReceiveAll}
              disabled={isPending}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Receive All Remaining
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={isPending}
              className="h-7 text-xs text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Receiving Lines Table */}
        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-8 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-right text-xs">Ordered</TableHead>
                <TableHead className="text-right text-xs">Received</TableHead>
                <TableHead className="text-right text-xs">Remaining</TableHead>
                <TableHead className="w-48 text-right text-xs">Qty to Receive</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines?.map((line, idx) => {
                const prod = productMap.get(line.productId);
                const rem = getRemaining(line);
                const isFullyReceived = rem <= 0;

                return (
                  <TableRow
                    key={line.id}
                    className={isFullyReceived ? 'opacity-60 bg-muted/20' : undefined}
                  >
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-semibold text-foreground">
                        {prod ? prod.name : line.productId}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {prod ? prod.sku : ''}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {line.receivedQuantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {getRemainingFormatted(line)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isFullyReceived ? (
                        <span className="inline-block text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                          Complete
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            max={rem}
                            value={quantities[line.id] ?? ''}
                            onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                            placeholder="0.0000"
                            disabled={isPending}
                            className="h-8 w-28 text-right font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetMax(line.id)}
                            disabled={isPending}
                            className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Max
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Receipt Notes */}
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="receipt-notes" className="text-xs font-medium">
            Goods Receipt Notes (Optional)
          </Label>
          <Textarea
            id="receipt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Received via DHL tracking #12345, verified by dock supervisor"
            rows={2}
            disabled={isPending}
            className="text-xs resize-none"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Receipt...
              </>
            ) : (
              <>
                <Truck className="mr-2 h-4 w-4" />
                Confirm Goods Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
