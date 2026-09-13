'use client';

import * as React from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Card,
  CardContent,
} from '@repo/ui';
import { useProducts } from '../../hooks/use-products';
import type { CreatePurchaseOrderLineInput } from '@repo/types';

interface PurchaseOrderLineEditorProps {
  lines: CreatePurchaseOrderLineInput[];
  onChange: (lines: CreatePurchaseOrderLineInput[]) => void;
  disabled?: boolean;
}

export function PurchaseOrderLineEditor({
  lines,
  onChange,
  disabled = false,
}: PurchaseOrderLineEditorProps) {
  const { data: productResponse } = useProducts({ limit: 100 });
  const products = (productResponse?.data || []).filter((p) => p.status === 'ACTIVE');

  const handleAddLine = () => {
    onChange([
      ...lines,
      {
        productId: '',
        quantity: '1.0000',
        unitPrice: '0.0000',
        notes: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    const nextLines = lines.filter((_, i) => i !== index);
    onChange(nextLines);
  };

  const handleLineChange = (
    index: number,
    field: keyof CreatePurchaseOrderLineInput,
    value: string,
  ) => {
    const nextLines = lines.map((line, i) => {
      if (i !== index) return line;
      return { ...line, [field]: value };
    });
    onChange(nextLines);
  };

  // Preview subtotal calculation (Display only — server is authoritative)
  const estimatedSubtotal = React.useMemo(() => {
    let sum = 0;
    for (const line of lines) {
      const q = parseFloat(line.quantity) || 0;
      const p = parseFloat(line.unitPrice) || 0;
      sum += q * p;
    }
    return sum.toFixed(4);
  }, [lines]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Purchase Order Lines</h3>
          <p className="text-xs text-muted-foreground">
            Add at least one product line item. Quantities and unit prices accept up to 4 decimal
            places.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddLine}
          disabled={disabled}
          className="h-8"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Line
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((line, idx) => {
          const qty = parseFloat(line.quantity) || 0;
          const price = parseFloat(line.unitPrice) || 0;
          const lineEst = (qty * price).toFixed(4);

          return (
            <Card key={idx} className="border border-border/70 shadow-none bg-card">
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Line #{idx + 1}
                  </span>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={disabled}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove line ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                  {/* Product Selector */}
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-xs font-medium text-foreground">Product *</label>
                    <Select
                      value={line.productId || 'NONE'}
                      onValueChange={(val) =>
                        handleLineChange(idx, 'productId', val === 'NONE' ? '' : val)
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger
                        className="h-9 text-xs"
                        aria-label={`Select product for line ${idx + 1}`}
                      >
                        <SelectValue placeholder="Select a product..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE" disabled>
                          Select a product...
                        </SelectItem>
                        {products.map((prod) => (
                          <SelectItem key={prod.id} value={prod.id}>
                            {prod.name} ({prod.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity Input */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-foreground">Quantity *</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                      placeholder="1.0000"
                      disabled={disabled}
                      className="h-9 text-xs font-mono"
                      aria-label={`Quantity for line ${idx + 1}`}
                    />
                  </div>

                  {/* Unit Price Input */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-foreground">Unit Price *</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => handleLineChange(idx, 'unitPrice', e.target.value)}
                      placeholder="0.0000"
                      disabled={disabled}
                      className="h-9 text-xs font-mono"
                      aria-label={`Unit price for line ${idx + 1}`}
                    />
                  </div>

                  {/* Estimated Line Total Preview */}
                  <div className="sm:col-span-3 space-y-1 sm:text-right">
                    <span className="text-xs font-medium text-muted-foreground block">
                      Estimated Total
                    </span>
                    <div className="h-9 flex items-center sm:justify-end text-xs font-semibold font-mono text-foreground px-2 rounded-md bg-muted/40">
                      ${lineEst}
                    </div>
                  </div>
                </div>

                {/* Line Notes */}
                <div className="pt-1">
                  <Input
                    type="text"
                    value={line.notes ?? ''}
                    onChange={(e) => handleLineChange(idx, 'notes', e.target.value)}
                    placeholder="Line notes (optional)"
                    disabled={disabled}
                    className="h-8 text-xs text-muted-foreground"
                    aria-label={`Notes for line ${idx + 1}`}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Subtotal preview banner */}
      <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary flex-shrink-0" />
          <span>
            <strong>Display Estimate Only:</strong> Final subtotal, tax ($0.0000), and grand total
            are calculated authoritatively by the server.
          </span>
        </div>
        <div className="text-right sm:pl-4">
          <span>Estimated Subtotal: </span>
          <span className="font-semibold text-foreground font-mono text-sm">
            ${estimatedSubtotal}
          </span>
        </div>
      </div>
    </div>
  );
}
