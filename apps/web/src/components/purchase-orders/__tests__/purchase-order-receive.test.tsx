import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { PurchaseOrderReceiveDialog } from '../purchase-order-receive-dialog';
import { PurchaseOrderDetailCard } from '../purchase-order-detail-card';
import { purchaseOrdersApi } from '../../../lib/api/purchase-orders';
import { warehousesApi } from '../../../lib/api/warehouses';
import { productsApi } from '../../../lib/api/products';
import type { PurchaseOrderDto, WarehouseDto, ProductDto, GoodsReceiptDto } from '@repo/types';

const mockWarehouse: WarehouseDto = {
  id: 'wh-1',
  organizationId: 'org-1',
  name: 'Central Warehouse',
  code: 'WH-CENTRAL',
  description: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  status: 'ACTIVE',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockProduct: ProductDto = {
  id: 'prod-1',
  organizationId: 'org-1',
  categoryId: 'cat-1',
  name: 'Industrial Valve',
  sku: 'VALVE-99',
  description: null,
  unitOfMeasure: 'UNIT',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockApprovedOrder: PurchaseOrderDto = {
  id: 'po-1',
  organizationId: 'org-1',
  purchaseOrderNumber: 'PO-2026-100',
  supplierName: 'Valve Tech Inc',
  supplierEmail: 'sales@valvetech.com',
  status: 'APPROVED',
  orderDate: '2026-10-15T00:00:00.000Z',
  expectedDate: '2026-10-25T00:00:00.000Z',
  warehouseId: 'wh-1',
  currency: 'USD',
  subtotal: '500.0000',
  taxTotal: '0.0000',
  grandTotal: '500.0000',
  notes: 'Fragile delivery',
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
  lines: [
    {
      id: 'line-1',
      organizationId: 'org-1',
      purchaseOrderId: 'po-1',
      productId: 'prod-1',
      quantity: '10.0000',
      unitPrice: '50.0000',
      lineTotal: '500.0000',
      receivedQuantity: '2.0000',
      notes: null,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  ],
};

const mockReceipt: GoodsReceiptDto = {
  id: 'gr-1',
  organizationId: 'org-1',
  purchaseOrderId: 'po-1',
  warehouseId: 'wh-1',
  receiptNumber: 'GR-PO-2026-100-1',
  idempotencyKey: 'idem-key-1',
  notes: 'Dock delivery verified',
  receivedById: 'user-rec-1',
  receivedAt: '2026-10-16T14:00:00.000Z',
  createdAt: '2026-10-16T14:00:00.000Z',
  updatedAt: '2026-10-16T14:00:00.000Z',
  lines: [
    {
      id: 'grl-1',
      organizationId: 'org-1',
      goodsReceiptId: 'gr-1',
      purchaseOrderLineId: 'line-1',
      productId: 'prod-1',
      quantityReceived: '2.0000',
      createdAt: '2026-10-16T14:00:00.000Z',
    },
  ],
};

describe('Purchase Order Receiving Frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(warehousesApi, 'getById').mockResolvedValue({
      data: mockWarehouse,
      meta: { requestId: 'r1' },
    });
    vi.spyOn(productsApi, 'list').mockResolvedValue({
      data: [mockProduct],
      meta: {
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'r2',
      },
    });
    vi.spyOn(purchaseOrdersApi, 'getReceipts').mockResolvedValue({
      data: [mockReceipt],
      meta: { requestId: 'r3' },
    });
  });

  it('1. renders receive dialog with PO metadata, lines, ordered and remaining quantities', async () => {
    renderWithClient(
      <PurchaseOrderReceiveDialog open={true} onOpenChange={vi.fn()} order={mockApprovedOrder} />,
    );

    expect(screen.getByText('Receive Goods Against PO')).toBeInTheDocument();
    expect(screen.getByText('PO-2026-100')).toBeInTheDocument();
    expect(await screen.findByText('Central Warehouse (WH-CENTRAL)')).toBeInTheDocument();

    // Line items table
    expect(await screen.findByText('Industrial Valve')).toBeInTheDocument();
    expect(screen.getByText('10.0000')).toBeInTheDocument(); // Ordered
    expect(screen.getByText('2.0000')).toBeInTheDocument(); // Received
    expect(screen.getByText('8.0000')).toBeInTheDocument(); // Remaining (10 - 2)
  });

  it('2. quick action "Receive All Remaining" autofills inputs with remaining quantity', async () => {
    renderWithClient(
      <PurchaseOrderReceiveDialog open={true} onOpenChange={vi.fn()} order={mockApprovedOrder} />,
    );

    const input = screen.getByPlaceholderText('0.0000') as HTMLInputElement;
    expect(input.value).toBe('');

    const receiveAllBtn = screen.getByRole('button', { name: /Receive All Remaining/i });
    fireEvent.click(receiveAllBtn);

    expect(input.value).toBe('8.0000');
  });

  it('3. per-line "Max" button autofills line input with remaining quantity', async () => {
    renderWithClient(
      <PurchaseOrderReceiveDialog open={true} onOpenChange={vi.fn()} order={mockApprovedOrder} />,
    );

    const input = screen.getByPlaceholderText('0.0000') as HTMLInputElement;
    expect(input.value).toBe('');

    const maxBtn = screen.getByRole('button', { name: /^Max$/i });
    fireEvent.click(maxBtn);

    expect(input.value).toBe('8.0000');
  });

  it('4. client validation prevents submission with zero or empty quantities', async () => {
    renderWithClient(
      <PurchaseOrderReceiveDialog open={true} onOpenChange={vi.fn()} order={mockApprovedOrder} />,
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirm Goods Receipt/i });
    fireEvent.click(confirmBtn);

    expect(
      await screen.findByText(
        /Please enter a receiving quantity \(> 0\) for at least one line item/i,
      ),
    ).toBeInTheDocument();
  });

  it('5. client validation prevents over-receiving beyond remaining quantity', async () => {
    renderWithClient(
      <PurchaseOrderReceiveDialog open={true} onOpenChange={vi.fn()} order={mockApprovedOrder} />,
    );

    const input = screen.getByPlaceholderText('0.0000') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8.0001' } });

    const confirmBtn = screen.getByRole('button', { name: /Confirm Goods Receipt/i });
    fireEvent.click(confirmBtn);

    expect(
      await screen.findByText(/Cannot receive 8.0001.*Maximum remaining quantity is 8.0000/i),
    ).toBeInTheDocument();
  });

  it('6. successfully calls purchaseOrdersApi.receive and closes dialog on valid submission', async () => {
    const handleOpenChange = vi.fn();
    const receiveSpy = vi.spyOn(purchaseOrdersApi, 'receive').mockResolvedValue({
      data: {
        order: { ...mockApprovedOrder, status: 'PARTIALLY_RECEIVED' },
        receipt: mockReceipt,
        isIdempotentReplay: false,
      },
      meta: { requestId: 'r4' },
    });

    renderWithClient(
      <PurchaseOrderReceiveDialog
        open={true}
        onOpenChange={handleOpenChange}
        order={mockApprovedOrder}
      />,
    );

    const input = screen.getByPlaceholderText('0.0000') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5.0000' } });

    const notesInput = screen.getByPlaceholderText(/DHL tracking/i);
    fireEvent.change(notesInput, { target: { value: 'Received batch 1' } });

    const confirmBtn = screen.getByRole('button', { name: /Confirm Goods Receipt/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(receiveSpy).toHaveBeenCalledWith(
        'po-1',
        {
          lines: [{ purchaseOrderLineId: 'line-1', quantity: '5.0000' }],
          notes: 'Received batch 1',
        },
        expect.any(String),
      );
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('7. renders Goods Receipt History section on PurchaseOrderDetailCard', async () => {
    renderWithClient(<PurchaseOrderDetailCard order={mockApprovedOrder} onAction={vi.fn()} />);

    expect(await screen.findByText(/Goods Receipt History \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('GR-PO-2026-100-1')).toBeInTheDocument();
    expect(screen.getByText('"Dock delivery verified"')).toBeInTheDocument();
    expect(screen.getByText('+2.0000')).toBeInTheDocument();
  });
});
