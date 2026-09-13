import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import PurchaseOrderEditPage from '../../../app/purchase-orders/[id]/edit/page';
import { purchaseOrdersApi } from '../../../lib/api/purchase-orders';
import { warehousesApi } from '../../../lib/api/warehouses';
import { productsApi } from '../../../lib/api/products';
import type { PurchaseOrderDto, WarehouseDto, ProductDto } from '@repo/types';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({ id: 'po-1' }),
}));

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
      notes: 'Line 1 notes',
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  ],
};

const mockSubmittedOrder: PurchaseOrderDto = {
  ...mockDraftOrder,
  id: 'po-2',
  status: 'SUBMITTED',
};

describe('PurchaseOrderEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: [mockWarehouse],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'r1',
      },
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

  it('1. pre-populates form with existing DRAFT order and disables PO number editing', async () => {
    vi.spyOn(purchaseOrdersApi, 'getById').mockResolvedValueOnce({
      data: mockDraftOrder,
      meta: { requestId: 'r3' },
    });

    renderWithClient(<PurchaseOrderEditPage />);

    expect(await screen.findByDisplayValue('PO-2026-100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PO-2026-100')).toBeDisabled();
    expect(screen.getByDisplayValue('Valve Tech Inc')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sales@valvetech.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fragile delivery')).toBeInTheDocument();
  });

  it('2. displays lock barrier when attempting to edit a non-DRAFT purchase order', async () => {
    vi.spyOn(purchaseOrdersApi, 'getById').mockResolvedValueOnce({
      data: mockSubmittedOrder,
      meta: { requestId: 'r4' },
    });

    renderWithClient(<PurchaseOrderEditPage />);

    expect(await screen.findByText('Order cannot be edited')).toBeInTheDocument();
    expect(screen.getByText(/Only DRAFT purchase orders may be modified/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Update Purchase Order/i }),
    ).not.toBeInTheDocument();
  });

  it('3. submits updated purchase order and redirects to detail page', async () => {
    vi.spyOn(purchaseOrdersApi, 'getById').mockResolvedValueOnce({
      data: mockDraftOrder,
      meta: { requestId: 'r5' },
    });
    const updateSpy = vi.spyOn(purchaseOrdersApi, 'update').mockResolvedValueOnce({
      data: { ...mockDraftOrder, supplierName: 'Valve Tech Global' },
      meta: { requestId: 'r6' },
    });

    renderWithClient(<PurchaseOrderEditPage />);

    const supplierInput = await screen.findByDisplayValue('Valve Tech Inc');
    fireEvent.change(supplierInput, { target: { value: 'Valve Tech Global' } });

    const submitBtn = screen.getByRole('button', { name: /Update Purchase Order/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'po-1',
        expect.objectContaining({
          supplierName: 'Valve Tech Global',
        }),
      );
      expect(mockPush).toHaveBeenCalledWith('/purchase-orders/po-1');
    });
  });
});
