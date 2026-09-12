import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { StockMutationDialog } from '../stock-mutation-dialog';
import { stockApi } from '../../../lib/api/stock';

vi.mock('../../../hooks/use-products', () => ({
  useProducts: () => ({
    data: {
      data: [
        { id: 'prod-1', name: 'Widget A', sku: 'WGT-01', unitOfMeasure: 'UNIT' },
        { id: 'prod-2', name: 'Gadget B', sku: 'GDT-02', unitOfMeasure: 'BOX' },
      ],
    },
  }),
}));

vi.mock('../../../hooks/use-warehouses', () => ({
  useWarehouses: () => ({
    data: {
      data: [
        { id: 'wh-1', name: 'Main Depot', code: 'WH-MAIN' },
        { id: 'wh-2', name: 'East Annex', code: 'WH-EAST' },
      ],
    },
  }),
}));

describe('StockMutationDialog Component', () => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with fields when opened', () => {
    renderWithClient(
      <StockMutationDialog
        open={true}
        onOpenChange={onOpenChange}
        initialProductId="prod-1"
        initialWarehouseId="wh-1"
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText('Record Stock Mutation')).toBeDefined();
    expect(screen.getByLabelText(/quantity/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /review mutation details/i })).toBeDefined();
  });

  it('validates quantity format and shows error if invalid', async () => {
    renderWithClient(
      <StockMutationDialog
        open={true}
        onOpenChange={onOpenChange}
        initialProductId="prod-1"
        initialWarehouseId="wh-1"
      />,
    );

    const qtyInput = screen.getByLabelText(/quantity/i);
    const reviewBtn = screen.getByRole('button', { name: /review mutation details/i });

    // Try submitting empty
    fireEvent.click(reviewBtn);
    expect(
      screen.getByText(/Quantity must be a positive number with up to 4 decimal places/),
    ).toBeDefined();

    // Try submitting invalid decimal (> 4 decimal places)
    fireEvent.change(qtyInput, { target: { value: '10.12345' } });
    fireEvent.click(reviewBtn);
    expect(
      screen.getByText(/Quantity must be a positive number with up to 4 decimal places/),
    ).toBeDefined();
  });

  it('advances to confirmation review step with exact decimal formatting and correct sign for RECEIPT', async () => {
    renderWithClient(
      <StockMutationDialog
        open={true}
        onOpenChange={onOpenChange}
        initialProductId="prod-1"
        initialWarehouseId="wh-1"
      />,
    );

    const qtyInput = screen.getByLabelText(/quantity/i);
    fireEvent.change(qtyInput, { target: { value: '15.5' } });

    const reviewBtn = screen.getByRole('button', { name: /review mutation details/i });
    fireEvent.click(reviewBtn);

    // Confirmation step
    expect(screen.getByText('Confirm Stock Mutation')).toBeDefined();
    expect(screen.getByText('15.5000')).toBeDefined();
    expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeDefined();
  });

  it('executes mutation API call with idempotency key and handles success', async () => {
    const mutateSpy = vi.spyOn(stockApi, 'mutate').mockResolvedValueOnce({
      data: {
        balance: {
          id: 'bal-1',
          organizationId: 'org-test',
          productId: 'prod-1',
          warehouseId: 'wh-1',
          quantity: '115.5000',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        ledgerEntry: {
          id: 'led-1',
          organizationId: 'org-test',
          productId: 'prod-1',
          warehouseId: 'wh-1',
          quantityDelta: '15.5000',
          quantityBefore: '100.0000',
          quantityAfter: '115.5000',
          type: 'RECEIPT',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        isIdempotentReplay: false,
      },
      meta: { requestId: 'req-success' },
    });

    renderWithClient(
      <StockMutationDialog
        open={true}
        onOpenChange={onOpenChange}
        initialProductId="prod-1"
        initialWarehouseId="wh-1"
        onSuccess={onSuccess}
      />,
    );

    const qtyInput = screen.getByLabelText(/quantity/i);
    fireEvent.change(qtyInput, { target: { value: '15.5' } });

    const reviewBtn = screen.getByRole('button', { name: /review mutation details/i });
    fireEvent.click(reviewBtn);

    const submitBtn = screen.getByRole('button', { name: /confirm and submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(mutateSpy).toHaveBeenCalledTimes(1));

    const callPayload = mutateSpy.mock.calls[0]![0];
    expect(callPayload.productId).toBe('prod-1');
    expect(callPayload.warehouseId).toBe('wh-1');
    expect(callPayload.quantityDelta).toBe('15.5000');
    expect(callPayload.idempotencyKey).toBeDefined();

    // Success confirmation screen
    await waitFor(() => {
      expect(screen.getByText('Stock Mutation Applied')).toBeDefined();
      expect(screen.getByText('115.5000')).toBeDefined();
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('displays idempotent replay notification when transaction is a replay', async () => {
    vi.spyOn(stockApi, 'mutate').mockResolvedValueOnce({
      data: {
        balance: {
          id: 'bal-1',
          organizationId: 'org-test',
          productId: 'prod-1',
          warehouseId: 'wh-1',
          quantity: '100.0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        ledgerEntry: {
          id: 'led-1',
          organizationId: 'org-test',
          productId: 'prod-1',
          warehouseId: 'wh-1',
          quantityDelta: '10.0000',
          quantityBefore: '90.0000',
          quantityAfter: '100.0000',
          type: 'RECEIPT',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        isIdempotentReplay: true,
      },
      meta: { requestId: 'req-replay' },
    });

    renderWithClient(
      <StockMutationDialog
        open={true}
        onOpenChange={onOpenChange}
        initialProductId="prod-1"
        initialWarehouseId="wh-1"
      />,
    );

    const qtyInput = screen.getByLabelText(/quantity/i);
    fireEvent.change(qtyInput, { target: { value: '10' } });

    const reviewBtn = screen.getByRole('button', { name: /review mutation details/i });
    fireEvent.click(reviewBtn);

    const submitBtn = screen.getByRole('button', { name: /confirm and submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Transaction Processed (Idempotent Replay)')).toBeDefined();
    });
  });
});
