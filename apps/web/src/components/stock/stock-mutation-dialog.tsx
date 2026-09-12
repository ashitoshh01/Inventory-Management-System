'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import type {
  StockLedgerEntryType,
  CreateStockMutationInput,
  StockMutationResultDto,
} from '@repo/types';
import { useStockMutation } from '../../hooks/use-stock';
import { useProducts } from '../../hooks/use-products';
import { useWarehouses } from '../../hooks/use-warehouses';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export interface StockMutationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProductId?: string | undefined;
  initialWarehouseId?: string | undefined;
  onSuccess?: ((result: StockMutationResultDto) => void) | undefined;
}

const DECIMAL_REGEX = /^\d+(\.\d{1,4})?$/;

export function StockMutationDialog({
  open,
  onOpenChange,
  initialProductId,
  initialWarehouseId,
  onSuccess,
}: StockMutationDialogProps) {
  const { data: productsResponse } = useProducts({ limit: 100 });
  const { data: warehousesResponse } = useWarehouses({ limit: 100 });

  const products = productsResponse?.data ?? [];
  const warehouses = warehousesResponse?.data ?? [];

  // Form states
  const [type, setType] = React.useState<StockLedgerEntryType>('RECEIPT');
  const [productId, setProductId] = React.useState<string>(initialProductId ?? '');
  const [warehouseId, setWarehouseId] = React.useState<string>(initialWarehouseId ?? '');
  const [rawQuantity, setRawQuantity] = React.useState<string>('');
  const [adjustmentDirection, setAdjustmentDirection] = React.useState<'INCREASE' | 'DECREASE'>(
    'INCREASE',
  );
  const [referenceType, setReferenceType] = React.useState<string>('');
  const [referenceId, setReferenceId] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');

  // UI Flow: 'form' -> 'confirm'
  const [step, setStep] = React.useState<'form' | 'confirm'>('form');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = React.useState<StockMutationResultDto | null>(null);

  // Idempotency key generated per dialog session
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>('');

  // Reset form when opening or closing
  React.useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
      setStep('form');
      setValidationError(null);
      setApiError(null);
      setMutationSuccess(null);
      setRawQuantity('');
      setReferenceType('');
      setReferenceId('');
      setNotes('');
      setType('RECEIPT');
      setAdjustmentDirection('INCREASE');
      if (initialProductId) setProductId(initialProductId);
      else setProductId('');
      if (initialWarehouseId) setWarehouseId(initialWarehouseId);
      else setWarehouseId('');
    }
  }, [open, initialProductId, initialWarehouseId]);

  const { mutate: executeMutation, isPending } = useStockMutation();

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  // Format exact decimal string ensuring 4 decimal places
  const formatExactDecimal = (val: string): string => {
    const parts = val.trim().split('.');
    const integerPart = parts[0] || '0';
    let fractionPart = parts[1] || '';
    while (fractionPart.length < 4) {
      fractionPart += '0';
    }
    return `${integerPart}.${fractionPart}`;
  };

  // Compute quantity delta with appropriate sign
  const computeQuantityDelta = (): string => {
    const formatted = formatExactDecimal(rawQuantity);
    if (type === 'ISSUE') {
      return `-${formatted}`;
    }
    if (type === 'ADJUSTMENT' && adjustmentDirection === 'DECREASE') {
      return `-${formatted}`;
    }
    return formatted;
  };

  // Validate form step
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    if (!productId) {
      setValidationError('Please select a product.');
      return;
    }
    if (!warehouseId) {
      setValidationError('Please select a warehouse.');
      return;
    }
    const trimmedQty = rawQuantity.trim();
    if (!trimmedQty || !DECIMAL_REGEX.test(trimmedQty)) {
      setValidationError(
        'Quantity must be a positive number with up to 4 decimal places (e.g. 10 or 10.5000).',
      );
      return;
    }
    const numericVal = Number(trimmedQty);
    if (numericVal <= 0) {
      setValidationError('Quantity must be greater than zero.');
      return;
    }

    setStep('confirm');
  };

  // Final submission
  const handleConfirmSubmit = () => {
    setApiError(null);

    const quantityDelta = computeQuantityDelta();
    const payload: CreateStockMutationInput = {
      productId,
      warehouseId,
      type,
      quantityDelta,
      idempotencyKey,
      ...(referenceType.trim() ? { referenceType: referenceType.trim() } : {}),
      ...(referenceId.trim() ? { referenceId: referenceId.trim() } : {}),
      ...(notes.trim() ? { metadata: { notes: notes.trim() } } : {}),
    };

    executeMutation(payload, {
      onSuccess: (result) => {
        setMutationSuccess(result.data);
        if (onSuccess) {
          onSuccess(result.data);
        }
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Stock mutation failed. Please check the inputs and try again.';
        setApiError(message);
      },
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mutationSuccess
              ? 'Mutation Successful'
              : step === 'confirm'
                ? 'Confirm Stock Mutation'
                : 'Record Stock Mutation'}
          </DialogTitle>
          <DialogDescription>
            {mutationSuccess
              ? 'The inventory mutation has been recorded to the authoritative stock ledger.'
              : step === 'confirm'
                ? 'Please review the transaction details carefully before committing.'
                : 'Create an authoritative stock ledger transaction with exact decimal precision.'}
          </DialogDescription>
        </DialogHeader>

        {/* Success View */}
        {mutationSuccess && (
          <div className="space-y-4 py-3">
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-semibold text-foreground">
                {mutationSuccess.isIdempotentReplay
                  ? 'Transaction Processed (Idempotent Replay)'
                  : 'Stock Mutation Applied'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {mutationSuccess.isIdempotentReplay
                  ? 'This exact mutation was previously processed. Returned cached result.'
                  : 'Inventory balance has been successfully updated in real-time.'}
              </p>
            </div>

            <div className="rounded-md border border-border p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Balance:</span>
                <span className="font-mono font-bold">{mutationSuccess.balance.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity Delta:</span>
                <span className="font-mono font-medium">
                  {mutationSuccess.ledgerEntry.quantityDelta}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ledger ID:</span>
                <span className="font-mono text-muted-foreground">
                  {mutationSuccess.ledgerEntry.id}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Confirmation Review View */}
        {!mutationSuccess && step === 'confirm' && (
          <div className="space-y-4 py-2">
            {apiError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
            )}

            <div className="rounded-md border border-border bg-muted/40 p-4 space-y-2.5 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Operation:</span>
                <span className="font-semibold text-foreground">{type}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Product:</span>
                <span className="font-medium text-foreground text-right">
                  {selectedProduct?.name || productId}
                  {selectedProduct?.sku ? ` (${selectedProduct.sku})` : ''}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Warehouse:</span>
                <span className="font-medium text-foreground text-right">
                  {selectedWarehouse?.name || warehouseId}
                  {selectedWarehouse?.code ? ` (${selectedWarehouse.code})` : ''}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Quantity Delta:</span>
                <span className="font-mono font-bold text-foreground">
                  {computeQuantityDelta()}
                </span>
              </div>
              {referenceType && (
                <div className="flex justify-between border-b border-border pb-2 text-xs">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="text-foreground">
                    {referenceType} {referenceId ? `(${referenceId})` : ''}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs pt-1">
                <span className="text-muted-foreground">Idempotency Key:</span>
                <span className="font-mono text-muted-foreground">
                  {idempotencyKey.slice(0, 13)}...
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('form')}
                disabled={isPending}
              >
                Back to Edit
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isPending}
                aria-label="Confirm and submit mutation"
              >
                {isPending ? 'Applying Mutation...' : 'Confirm & Submit'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Input Form View */}
        {!mutationSuccess && step === 'form' && (
          <form onSubmit={handleProceedToConfirm} className="space-y-4 py-2">
            {validationError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Mutation Type */}
            <div className="space-y-1.5">
              <Label htmlFor="mutation-type">Mutation Type</Label>
              <Select value={type} onValueChange={(val) => setType(val as StockLedgerEntryType)}>
                <SelectTrigger id="mutation-type" className="h-9">
                  <SelectValue placeholder="Select mutation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIPT">RECEIPT (Add inbound stock)</SelectItem>
                  <SelectItem value="ISSUE">ISSUE (Dispatch / consume stock)</SelectItem>
                  <SelectItem value="ADJUSTMENT">ADJUSTMENT (Audit / correction)</SelectItem>
                  <SelectItem value="OPENING">OPENING (Initial balance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="mutation-product">Product</Label>
              <Select
                value={productId}
                onValueChange={setProductId}
                disabled={Boolean(initialProductId)}
              >
                <SelectTrigger id="mutation-product" className="h-9">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="mutation-warehouse">Warehouse</Label>
              <Select
                value={warehouseId}
                onValueChange={setWarehouseId}
                disabled={Boolean(initialWarehouseId)}
              >
                <SelectTrigger id="mutation-warehouse" className="h-9">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity and Direction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mutation-qty">Quantity</Label>
                <Input
                  id="mutation-qty"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 10.0000"
                  value={rawQuantity}
                  onChange={(e) => setRawQuantity(e.target.value)}
                  className="h-9 font-mono"
                />
              </div>

              {type === 'ADJUSTMENT' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="adjustment-direction">Adjustment Direction</Label>
                  <Select
                    value={adjustmentDirection}
                    onValueChange={(val) => setAdjustmentDirection(val as 'INCREASE' | 'DECREASE')}
                  >
                    <SelectTrigger id="adjustment-direction" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCREASE">Increase (+)</SelectItem>
                      <SelectItem value="DECREASE">Decrease (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Effect on Stock</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                    {type === 'ISSUE' ? 'Subtracts (-) from inventory' : 'Adds (+) to inventory'}
                  </div>
                </div>
              )}
            </div>

            {/* Reference Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ref-type">Reference Type (optional)</Label>
                <Input
                  id="ref-type"
                  placeholder="e.g. PO, SO, AUDIT"
                  value={referenceType}
                  onChange={(e) => setReferenceType(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-id">Reference ID (optional)</Label>
                <Input
                  id="ref-id"
                  placeholder="e.g. PO-1002"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="mutation-notes">Notes / Reason (optional)</Label>
              <Textarea
                id="mutation-notes"
                placeholder="Add any audit notes or explanation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" aria-label="Review mutation details">
                Review Details
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
