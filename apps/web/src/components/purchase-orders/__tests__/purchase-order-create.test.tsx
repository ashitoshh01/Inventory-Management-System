import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { PurchaseOrderForm } from '../purchase-order-form';
import { warehousesApi } from '../../../lib/api/warehouses';
import { productsApi } from '../../../lib/api/products';
import type { WarehouseDto, ProductDto } from '@repo/types';

const mockWarehouses: WarehouseDto[] = [
  {
    id: 'wh-1',
    organizationId: 'org-1',
    name: 'Main Facility',
    code: 'WH-MAIN',
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
  },
];

const mockProducts: ProductDto[] = [
  {
    id: 'prod-1',
    organizationId: 'org-1',
    categoryId: 'cat-1',
    name: 'Industrial Bolt',
    sku: 'BOLT-001',
    description: null,
    unitOfMeasure: 'UNIT',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-2',
    organizationId: 'org-1',
    categoryId: 'cat-1',
    name: 'Steel Nut',
    sku: 'NUT-001',
    description: null,
    unitOfMeasure: 'UNIT',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('PurchaseOrderForm and LineItemEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: mockWarehouses,
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
      data: mockProducts,
      meta: {
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'r2',
      },
    });
  });

  it('1. renders all required form inputs and line item editor', async () => {
    renderWithClient(<PurchaseOrderForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/Purchase Order Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Destination Warehouse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Supplier Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Order Date/i)).toBeInTheDocument();
    expect(screen.getByText(/Purchase Order Lines/i)).toBeInTheDocument();
    expect(screen.getByText(/Line #1/i)).toBeInTheDocument();
    expect(screen.getByText(/Display Estimate Only/i)).toBeInTheDocument();
  });

  it('2. adds and removes line items dynamically', async () => {
    renderWithClient(<PurchaseOrderForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('Line #1')).toBeInTheDocument();
    expect(screen.queryByText('Line #2')).not.toBeInTheDocument();

    // Click Add Line
    const addLineBtn = screen.getByRole('button', { name: /Add Line/i });
    fireEvent.click(addLineBtn);

    expect(screen.getByText('Line #2')).toBeInTheDocument();

    // Click Remove Line 2
    const removeLineBtn = screen.getByRole('button', { name: /Remove line 2/i });
    fireEvent.click(removeLineBtn);

    expect(screen.queryByText('Line #2')).not.toBeInTheDocument();
  });

  it('3. validates that required fields and product selection cannot be empty', async () => {
    const handleSubmit = vi.fn();
    renderWithClient(
      <PurchaseOrderForm mode="create" onSubmit={handleSubmit} onCancel={vi.fn()} />,
    );

    const submitBtn = screen.getByRole('button', { name: /Create Purchase Order/i });
    fireEvent.click(submitBtn);

    // Missing PO number error
    expect(await screen.findByText(/Purchase Order number is required/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('4. calculates line total and subtotal preview accurately with decimal inputs', async () => {
    renderWithClient(<PurchaseOrderForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const qtyInput = screen.getByLabelText(/Quantity for line 1/i);
    const priceInput = screen.getByLabelText(/Unit price for line 1/i);

    fireEvent.change(qtyInput, { target: { value: '12.5000' } });
    fireEvent.change(priceInput, { target: { value: '4.0000' } });

    // 12.5 * 4 = 50.0000
    expect(screen.getAllByText('$50.0000').length).toBeGreaterThanOrEqual(1);
  });

  it('5. prevents duplicate submissions while isPending is true', () => {
    renderWithClient(
      <PurchaseOrderForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} isLoading={true} />,
    );

    const submitBtn = screen.getByRole('button', { name: /Saving/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByLabelText(/Purchase Order Number/i)).toBeDisabled();
  });
});
