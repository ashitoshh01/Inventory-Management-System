'use client';

import * as React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@repo/ui';
import { useWarehouses } from '../../hooks/use-warehouses';
import { PurchaseOrderLineEditor } from './purchase-order-line-editor';
import type {
  PurchaseOrderDto,
  CreatePurchaseOrderInput,
  CreatePurchaseOrderLineInput,
  UpdatePurchaseOrderInput,
} from '@repo/types';

interface PurchaseOrderFormProps {
  mode: 'create' | 'edit';
  initialOrder?: PurchaseOrderDto | undefined;
  onSubmit: (data: CreatePurchaseOrderInput | UpdatePurchaseOrderInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PurchaseOrderForm({
  mode,
  initialOrder,
  onSubmit,
  onCancel,
  isLoading = false,
}: PurchaseOrderFormProps) {
  const { data: warehouseResponse } = useWarehouses();
  const warehouses = warehouseResponse?.data || [];

  // Form states
  const [purchaseOrderNumber, setPurchaseOrderNumber] = React.useState(
    initialOrder?.purchaseOrderNumber || '',
  );
  const [warehouseId, setWarehouseId] = React.useState(initialOrder?.warehouseId || '');
  const [supplierName, setSupplierName] = React.useState(initialOrder?.supplierName || '');
  const [supplierEmail, setSupplierEmail] = React.useState(initialOrder?.supplierEmail || '');
  const [orderDate, setOrderDate] = React.useState(
    initialOrder?.orderDate
      ? new Date(initialOrder.orderDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  );
  const [expectedDate, setExpectedDate] = React.useState(
    initialOrder?.expectedDate
      ? new Date(initialOrder.expectedDate).toISOString().split('T')[0]
      : '',
  );
  const [currency, setCurrency] = React.useState(initialOrder?.currency || 'USD');
  const [notes, setNotes] = React.useState(initialOrder?.notes || '');
  const [lines, setLines] = React.useState<CreatePurchaseOrderLineInput[]>(() => {
    if (initialOrder?.lines && initialOrder.lines.length > 0) {
      return initialOrder.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        notes: l.notes || '',
      }));
    }
    return [
      {
        productId: '',
        quantity: '1.0000',
        unitPrice: '0.0000',
        notes: '',
      },
    ];
  });

  const [formError, setFormError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (mode === 'create' && !purchaseOrderNumber.trim()) {
      setFormError('Purchase Order number is required.');
      return;
    }
    if (!warehouseId) {
      setFormError('Please select a target warehouse.');
      return;
    }
    if (!supplierName.trim()) {
      setFormError('Supplier name is required.');
      return;
    }
    if (supplierEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierEmail.trim())) {
      setFormError('Please provide a valid supplier email address.');
      return;
    }
    if (orderDate && expectedDate && expectedDate < orderDate) {
      setFormError('Expected delivery date cannot be earlier than order date.');
      return;
    }
    if (lines.length === 0) {
      setFormError('At least one line item is required.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.productId) {
        setFormError(`Line #${i + 1} must have a product selected.`);
        return;
      }
      const q = parseFloat(line.quantity);
      if (isNaN(q) || q <= 0) {
        setFormError(`Line #${i + 1} quantity must be a positive number.`);
        return;
      }
      const p = parseFloat(line.unitPrice);
      if (isNaN(p) || p < 0) {
        setFormError(`Line #${i + 1} unit price cannot be negative.`);
        return;
      }
    }

    if (mode === 'create') {
      const payload: CreatePurchaseOrderInput = {
        purchaseOrderNumber: purchaseOrderNumber.trim().toUpperCase(),
        warehouseId,
        supplierName: supplierName.trim(),
        supplierEmail: supplierEmail.trim() || null,
        orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : null,
        currency: currency.trim().toUpperCase() || 'USD',
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          notes: l.notes?.trim() || null,
        })),
      };
      await onSubmit(payload);
    } else {
      const payload: UpdatePurchaseOrderInput = {
        warehouseId,
        supplierName: supplierName.trim(),
        supplierEmail: supplierEmail.trim() || null,
        orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : null,
        currency: currency.trim().toUpperCase() || 'USD',
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          notes: l.notes?.trim() || null,
        })),
      };
      await onSubmit(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Basic Order Information */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* PO Number */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            PO Number {mode === 'create' && '*'}
          </label>
          <Input
            type="text"
            value={purchaseOrderNumber}
            onChange={(e) => setPurchaseOrderNumber(e.target.value.toUpperCase())}
            placeholder="e.g. PO-2026-001"
            disabled={mode === 'edit' || isLoading}
            className="h-9 font-mono uppercase"
            aria-label="Purchase Order Number"
          />
          {mode === 'edit' && (
            <p className="text-[11px] text-muted-foreground">
              PO Number is immutable once created.
            </p>
          )}
        </div>

        {/* Warehouse Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Destination Warehouse *</label>
          <Select
            value={warehouseId || 'NONE'}
            onValueChange={(val) => setWarehouseId(val === 'NONE' ? '' : val)}
            disabled={isLoading}
          >
            <SelectTrigger className="h-9 text-xs" aria-label="Destination Warehouse">
              <SelectValue placeholder="Select warehouse..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE" disabled>
                Select warehouse...
              </SelectItem>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Currency</label>
          <Input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="USD"
            disabled={isLoading}
            className="h-9 uppercase"
            maxLength={3}
            aria-label="Currency code"
          />
        </div>

        {/* Supplier Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Supplier Name *</label>
          <Input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Acme Industrial Supplies"
            disabled={isLoading}
            className="h-9"
            aria-label="Supplier Name"
            required
          />
        </div>

        {/* Supplier Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Supplier Email</label>
          <Input
            type="email"
            value={supplierEmail}
            onChange={(e) => setSupplierEmail(e.target.value)}
            placeholder="orders@supplier.com"
            disabled={isLoading}
            className="h-9"
            aria-label="Supplier Email"
          />
        </div>

        {/* Order Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Order Date *</label>
          <Input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            disabled={isLoading}
            className="h-9"
            aria-label="Order Date"
            required
          />
        </div>

        {/* Expected Delivery Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Expected Date</label>
          <Input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            disabled={isLoading}
            className="h-9"
            aria-label="Expected Delivery Date"
          />
        </div>

        {/* Order Notes */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-foreground">Order Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Commercial terms, delivery instructions, or reference tags..."
            disabled={isLoading}
            className="h-9 min-h-[38px] text-xs resize-y"
            aria-label="Order Notes"
          />
        </div>
      </div>

      {/* Line Items Section */}
      <div className="border-t border-border pt-4">
        <PurchaseOrderLineEditor lines={lines} onChange={setLines} disabled={isLoading} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="min-w-[130px]">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create Purchase Order'
          ) : (
            'Update Purchase Order'
          )}
        </Button>
      </div>
    </form>
  );
}
