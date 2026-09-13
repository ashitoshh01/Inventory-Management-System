import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { PurchaseOrderDetailCard } from '../purchase-order-detail-card';
import { PurchaseOrderActionDialog } from '../purchase-order-action-dialog';
import { warehousesApi } from '../../../lib/api/warehouses';
import { productsApi } from '../../../lib/api/products';
import type { PurchaseOrderDto, WarehouseDto, ProductDto } from '@repo/types';

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

const mockDraftOrder: PurchaseOrderDto = {
  id: 'po-1',
  organizationId: 'org-1',
  purchaseOrderNumber: 'PO-2026-100',
  supplierName: 'Valve Tech Inc',
  supplierEmail: 'sales@valvetech.com',
  status: 'DRAFT',
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
      quantity: '5.0000',
      unitPrice: '100.0000',
      lineTotal: '500.0000',
      receivedQuantity: '0.0000',
      notes: 'High pressure rating',
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  ],
};

const mockSubmittedOrder: PurchaseOrderDto = {
  ...mockDraftOrder,
  id: 'po-2',
  purchaseOrderNumber: 'PO-2026-200',
  status: 'SUBMITTED',
};

const mockApprovedOrder: PurchaseOrderDto = {
  ...mockDraftOrder,
  id: 'po-3',
  purchaseOrderNumber: 'PO-2026-300',
  status: 'APPROVED',
  approvedAt: '2026-10-16T12:00:00.000Z',
  approvedById: 'approver-1',
};

const mockCancelledOrder: PurchaseOrderDto = {
  ...mockDraftOrder,
  id: 'po-4',
  purchaseOrderNumber: 'PO-2026-400',
  status: 'CANCELLED',
};

describe('PurchaseOrderDetailCard and ActionDialog', () => {
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
  });

  it('1. renders all order details, authoritative financials, and line items', async () => {
    renderWithClient(<PurchaseOrderDetailCard order={mockDraftOrder} onAction={vi.fn()} />);

    expect(screen.getByText('PO-2026-100')).toBeInTheDocument();
    expect(screen.getByText('Valve Tech Inc')).toBeInTheDocument();
    expect(screen.getAllByText('USD 500.0000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('USD 0.0000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Fragile delivery/)).toBeInTheDocument();

    // Line items table
    expect(await screen.findByText('Industrial Valve')).toBeInTheDocument();
    expect(screen.getByText('VALVE-99')).toBeInTheDocument();
    expect(screen.getByText('5.0000')).toBeInTheDocument();
    expect(screen.getByText('USD 100.0000')).toBeInTheDocument();
    expect(screen.getByText('High pressure rating')).toBeInTheDocument();
  });

  it('2. displays DRAFT lifecycle actions: Edit, Submit, Cancel, Delete', () => {
    const handleAction = vi.fn();
    renderWithClient(<PurchaseOrderDetailCard order={mockDraftOrder} onAction={handleAction} />);

    expect(screen.getByRole('button', { name: /Edit Order/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
    expect(handleAction).toHaveBeenCalledWith('submit');
  });

  it('3. displays SUBMITTED lifecycle actions: Approve and Cancel only', () => {
    const handleAction = vi.fn();
    renderWithClient(
      <PurchaseOrderDetailCard order={mockSubmittedOrder} onAction={handleAction} />,
    );

    expect(screen.getByRole('button', { name: /Approve Order/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('4. displays APPROVED lifecycle actions: Receive Goods and Cancel Order', () => {
    renderWithClient(<PurchaseOrderDetailCard order={mockApprovedOrder} onAction={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /Receive Goods/i }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByRole('button', { name: /Cancel Order/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Order/i })).not.toBeInTheDocument();
  });

  it('5. renders CANCELLED order as strictly read-only with zero mutation buttons', () => {
    renderWithClient(<PurchaseOrderDetailCard order={mockCancelledOrder} onAction={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Edit Order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('6. ActionDialog triggers onConfirm and handles errors gracefully', async () => {
    const handleConfirm = vi.fn().mockRejectedValueOnce(new Error('Invalid status transition'));
    const handleOpenChange = vi.fn();

    renderWithClient(
      <PurchaseOrderActionDialog
        open={true}
        onOpenChange={handleOpenChange}
        order={mockDraftOrder}
        action="submit"
        onConfirm={handleConfirm}
      />,
    );

    expect(screen.getByText('Submit Purchase Order')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Submit Order/i });
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalled();
    expect(await screen.findByText('Invalid status transition')).toBeInTheDocument();
  });
});
