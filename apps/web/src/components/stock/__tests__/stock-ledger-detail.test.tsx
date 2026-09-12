import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { StockLedgerDetailCard } from '../stock-ledger-detail-card';
import type { StockLedgerEntryDto } from '@repo/types';

vi.mock('../../../hooks/use-products', () => ({
  useProducts: () => ({
    data: {
      data: [{ id: 'prod-100', name: 'Industrial Sensor', sku: 'SEN-100', unitOfMeasure: 'UNIT' }],
    },
  }),
}));

vi.mock('../../../hooks/use-warehouses', () => ({
  useWarehouses: () => ({
    data: {
      data: [{ id: 'wh-200', name: 'Logistics Hub A', code: 'HUB-A' }],
    },
  }),
}));

const mockEntry: StockLedgerEntryDto = {
  id: 'led-12345678-1234-4234-8234-123456789012',
  organizationId: 'org-audit',
  productId: 'prod-100',
  warehouseId: 'wh-200',
  quantityDelta: '+45.7500',
  quantityBefore: '100.2500',
  quantityAfter: '146.0000',
  type: 'RECEIPT',
  referenceType: 'PO',
  referenceId: 'PO-AUDIT-999',
  metadata: { reason: 'Quarterly restock inspection verified' },
  idempotencyKey: 'idem-uuid-999',
  createdById: 'user-supervisor-1',
  createdAt: '2026-03-01T15:45:00.000Z',
};

describe('StockLedgerDetailCard Component', () => {
  it('1. renders immutable audit notice and entry identifiers', () => {
    renderWithClient(<StockLedgerDetailCard entry={mockEntry} />);

    expect(screen.getByText('Immutable Audit Record')).toBeDefined();
    expect(
      screen.getByText(/Ledger entries cannot be altered, replaced, or deleted/i),
    ).toBeDefined();
    expect(screen.getByText(`ID: ${mockEntry.id}`)).toBeDefined();
    expect(screen.getByText('RECEIPT')).toBeDefined();
  });

  it('2. displays exact decimal arithmetic breakdown (Before + Delta = After)', () => {
    renderWithClient(<StockLedgerDetailCard entry={mockEntry} />);

    expect(screen.getByText('Inventory Balance Arithmetic')).toBeDefined();
    expect(screen.getByText('Balance Before')).toBeDefined();
    expect(screen.getByText('100.2500')).toBeDefined();

    expect(screen.getByText('Quantity Delta')).toBeDefined();
    expect(screen.getByText('+45.7500')).toBeDefined();

    expect(screen.getByText('Balance After')).toBeDefined();
    expect(screen.getByText('146.0000')).toBeDefined();
  });

  it('3. displays resolved product and warehouse details with navigation links', () => {
    renderWithClient(<StockLedgerDetailCard entry={mockEntry} />);

    expect(screen.getByText('Industrial Sensor')).toBeDefined();
    expect(screen.getByText('SEN-100')).toBeDefined();
    expect(screen.getByText('Logistics Hub A')).toBeDefined();
    expect(screen.getByText('HUB-A')).toBeDefined();
  });

  it('4. displays reference, notes, idempotency key, and creator info', () => {
    renderWithClient(<StockLedgerDetailCard entry={mockEntry} />);

    expect(screen.getByText('PO: PO-AUDIT-999')).toBeDefined();
    expect(screen.getByText('Quarterly restock inspection verified')).toBeDefined();
    expect(screen.getByText('idem-uuid-999')).toBeDefined();
    expect(screen.getByText('User (user-supervisor-1)')).toBeDefined();
  });

  it('5. renders "System (Automated)" when createdById is null', () => {
    const systemEntry: StockLedgerEntryDto = {
      ...mockEntry,
      createdById: null,
    };
    renderWithClient(<StockLedgerDetailCard entry={systemEntry} />);

    expect(screen.getByText('System (Automated)')).toBeDefined();
  });

  it('6. INVARIANT: strictly lacks edit, mutate, or delete controls', () => {
    renderWithClient(<StockLedgerDetailCard entry={mockEntry} />);

    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /mutate/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /adjust/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /update/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reverse/i })).toBeNull();
  });
});
