'use client';

import * as React from 'react';
import { Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Card,
  CardContent,
} from '@repo/ui';
import { useWarehouses } from '../../hooks/use-warehouses';
import { useProducts } from '../../hooks/use-products';
import type {
  StockTransferDto,
  CreateStockTransferInput,
  CreateStockTransferLineInput,
  UpdateStockTransferInput,
} from '@repo/types';

interface TransferFormProps {
  mode: 'create' | 'edit';
  initialTransfer?: StockTransferDto | undefined;
  onSubmit: (data: CreateStockTransferInput | UpdateStockTransferInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TransferForm({
  mode,
  initialTransfer,
  onSubmit,
  onCancel,
  isLoading = false,
}: TransferFormProps) {
  const { data: warehouseResponse } = useWarehouses();
  const warehouses = warehouseResponse?.data || [];

  const { data: productResponse } = useProducts({ limit: 100 });
  const products = (productResponse?.data || []).filter((p) => p.status === 'ACTIVE');

  // Form states
  const [transferNumber, setTransferNumber] = React.useState(initialTransfer?.transferNumber || '');
  const [sourceWarehouseId, setSourceWarehouseId] = React.useState(
    initialTransfer?.sourceWarehouseId || '',
  );
  const [destinationWarehouseId, setDestinationWarehouseId] = React.useState(
    initialTransfer?.destinationWarehouseId || '',
  );
  const [notes, setNotes] = React.useState(initialTransfer?.notes || '');
  const [lines, setLines] = React.useState<CreateStockTransferLineInput[]>(() => {
    if (initialTransfer?.lines && initialTransfer.lines.length > 0) {
      return initialTransfer.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        notes: l.notes || '',
      }));
    }
    return [
      {
        productId: '',
        quantity: '1.0000',
        notes: '',
      },
    ];
  });

  const [formError, setFormError] = React.useState<string | null>(null);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        productId: '',
        quantity: '1.0000',
        notes: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (
    index: number,
    field: keyof CreateStockTransferLineInput,
    value: string,
  ) => {
    setLines(
      lines.map((line, i) => {
        if (i !== index) return line;
        return { ...line, [field]: value };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (mode === 'create' && !transferNumber.trim()) {
      setFormError('Transfer number is required.');
      return;
    }
    if (!sourceWarehouseId) {
      setFormError('Please select a source warehouse.');
      return;
    }
    if (!destinationWarehouseId) {
      setFormError('Please select a destination warehouse.');
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      setFormError('Source and destination warehouses cannot be the same.');
      return;
    }

    if (!lines || lines.length === 0) {
      setFormError('A transfer must contain at least one line item.');
      return;
    }

    const seenProducts = new Set<string>();
    for (const [i, line] of lines.entries()) {
      if (!line.productId) {
        setFormError(`Line #${i + 1}: Please select a product.`);
        return;
      }
      if (seenProducts.has(line.productId)) {
        setFormError(
          `Duplicate product found on line #${i + 1}. Each product can only appear once.`,
        );
        return;
      }
      seenProducts.add(line.productId);

      const qty = parseFloat(line.quantity);
      if (isNaN(qty) || qty <= 0) {
        setFormError(`Line #${i + 1}: Quantity must be greater than zero.`);
        return;
      }
    }

    try {
      if (mode === 'create') {
        const payload: CreateStockTransferInput = {
          transferNumber: transferNumber.trim(),
          sourceWarehouseId,
          destinationWarehouseId,
          notes: notes.trim() || undefined,
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: parseFloat(l.quantity).toFixed(4),
            notes: l.notes?.trim() || undefined,
          })),
        };
        await onSubmit(payload);
      } else {
        const payload: UpdateStockTransferInput = {
          sourceWarehouseId,
          destinationWarehouseId,
          notes: notes.trim() || undefined,
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: parseFloat(l.quantity).toFixed(4),
            notes: l.notes?.trim() || undefined,
          })),
        };
        await onSubmit(payload);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save stock transfer.';
      setFormError(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium">Validation Error</h4>
            <p className="mt-1 text-xs opacity-90">{formError}</p>
          </div>
        </div>
      )}

      {/* Primary Details Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Transfer Number */}
            <div className="space-y-1.5">
              <label
                htmlFor="transferNumber"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Transfer Number <span className="text-destructive">*</span>
              </label>
              <Input
                id="transferNumber"
                placeholder="e.g. TR-2026-001"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                disabled={mode === 'edit' || isLoading}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {mode === 'create'
                  ? 'Unique identifier for tracking this inter-hub transfer'
                  : 'Cannot be altered after creation'}
              </p>
            </div>

            {/* Source Warehouse */}
            <div className="space-y-1.5">
              <label
                htmlFor="sourceWarehouse"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Source Warehouse <span className="text-destructive">*</span>
              </label>
              <Select
                value={sourceWarehouseId}
                onValueChange={(val) => setSourceWarehouseId(val)}
                disabled={isLoading}
              >
                <SelectTrigger id="sourceWarehouse">
                  <SelectValue placeholder="Select source hub" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} disabled={w.id === destinationWarehouseId}>
                      {w.name} {w.code ? `(${w.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Origin warehouse where stock will be deducted
              </p>
            </div>

            {/* Destination Warehouse */}
            <div className="space-y-1.5">
              <label
                htmlFor="destWarehouse"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Destination Warehouse <span className="text-destructive">*</span>
              </label>
              <Select
                value={destinationWarehouseId}
                onValueChange={(val) => setDestinationWarehouseId(val)}
                disabled={isLoading}
              >
                <SelectTrigger id="destWarehouse">
                  <SelectValue placeholder="Select destination hub" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} disabled={w.id === sourceWarehouseId}>
                      {w.name} {w.code ? `(${w.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Receiving warehouse where stock will be credited
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label
              htmlFor="notes"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Transfer Notes / Routing Instructions
            </label>
            <Textarea
              id="notes"
              placeholder="e.g. Urgent stock rebalance for regional store launch, carrier details..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Transfer Lines Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Transfer Items</h3>
              <p className="text-xs text-muted-foreground">
                Select active products and transfer quantities. Quantities support up to 4 decimal
                places.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              disabled={isLoading}
              className="h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-3 rounded-lg border border-border p-3.5 sm:flex-row sm:items-center bg-muted/20"
              >
                <div className="text-xs font-mono font-medium text-muted-foreground w-6 shrink-0">
                  #{idx + 1}
                </div>

                {/* Product Select */}
                <div className="flex-1 sm:max-w-md">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                    Product
                  </label>
                  <Select
                    value={line.productId}
                    onValueChange={(val) => handleLineChange(idx, 'productId', val)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="w-full sm:w-36">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    placeholder="1.0000"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                    disabled={isLoading}
                    className="h-9 font-mono text-sm"
                  />
                </div>

                {/* Line Notes */}
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                    Item Notes
                  </label>
                  <Input
                    placeholder="Batch/lot or special handling notes"
                    value={line.notes || ''}
                    onChange={(e) => handleLineChange(idx, 'notes', e.target.value)}
                    disabled={isLoading}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Remove button */}
                <div className="sm:pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLine(idx)}
                    disabled={lines.length <= 1 || isLoading}
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove item #${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit / Actions Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Transfer' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
