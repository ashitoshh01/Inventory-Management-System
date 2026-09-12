import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { StockLedgerTable } from '../stock-ledger-table';
import type { StockLedgerEntryDto } from '@repo/types';

vi.mock('../../../hooks/use-products', () => ({
  useProducts: () => ({
    data: {
      data: [
        { id: 'prod-1', name: 'Widget Pro', sku: 'WGT-PRO', unitOfMeasure: 'UNIT' },
        { id: 'prod-2', name: 'Gadget Max', sku: 'GDT-MAX', unitOfMeasure: 'BOX' },
      ],
    },
  }),
}));

vi.mock('../../../hooks/use-warehouses', () => ({
  useWarehouses: () => ({
    data: {
      data: [
        { id: 'wh-1', name: 'Central Warehouse', code: 'WH-CENTRAL' },
        { id: 'wh-2', name: 'North Annex', code: 'WH-NORTH' },
      ],
    },
  }),
}));

const mockEntries: StockLedgerEntryDto[] = [
  {
    id: 'led-001',
    organizationId: 'org-test',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantityDelta: '25.5000',
    quantityBefore: '100.0000',
    quantityAfter: '125.5000',
    type: 'RECEIPT',
    referenceType: 'PO',
    referenceId: 'PO-2026-001',
    metadata: { notes: 'Initial receipt shipment' },
    idempotencyKey: 'idem-001',
    createdById: 'user-001',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'led-002',
    organizationId: 'org-test',
    productId: 'prod-2',
    warehouseId: 'wh-2',
    quantityDelta: '-10.2500',
    quantityBefore: '50.0000',
    quantityAfter: '39.7500',
    type: 'ISSUE',
    referenceType: 'SO',
    referenceId: 'SO-2026-002',
    metadata: { notes: 'Customer dispatch' },
    idempotencyKey: 'idem-002',
    createdById: null,
    createdAt: '2026-02-02T12:00:00.000Z',
  },
];

describe('StockLedgerTable Component', () => {
  const onSort = vi.fn();
  const onRetry = vi.fn();
  const onResetFilters = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders loading skeleton rows when isLoading is true', () => {
    renderWithClient(
      <StockLedgerTable entries={[]} isLoading={true} isError={false} onSort={onSort} />,
    );

    expect(screen.getByText('Timestamp')).toBeDefined();
    expect(screen.getByText('Type')).toBeDefined();
    expect(screen.getByText('Product')).toBeDefined();
    expect(screen.getByText('Warehouse')).toBeDefined();
    expect(screen.getByText('Delta')).toBeDefined();
  });

  it('2. renders error state with retry button', () => {
    renderWithClient(
      <StockLedgerTable
        entries={[]}
        isLoading={false}
        isError={true}
        error={new Error('Network error loading history')}
        onSort={onSort}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Error Loading Stock Ledger')).toBeDefined();
    expect(screen.getByText('Network error loading history')).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('3. renders empty state without filters', () => {
    renderWithClient(
      <StockLedgerTable entries={[]} isLoading={false} isError={false} onSort={onSort} />,
    );

    expect(screen.getByText('No stock ledger entries found')).toBeDefined();
  });

  it('4. renders empty state with reset filters button when hasFilters is true', () => {
    renderWithClient(
      <StockLedgerTable
        entries={[]}
        isLoading={false}
        isError={false}
        hasFilters={true}
        onResetFilters={onResetFilters}
        onSort={onSort}
      />,
    );

    expect(screen.getByText('No matching ledger entries')).toBeDefined();

    const resetBtn = screen.getByRole('button', { name: /reset filters/i });
    fireEvent.click(resetBtn);
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('5. renders ledger entries with exact decimal deltas and type badges', () => {
    renderWithClient(
      <StockLedgerTable entries={mockEntries} isLoading={false} isError={false} onSort={onSort} />,
    );

    // Products and warehouses resolved from hooks
    expect(screen.getByText('Widget Pro')).toBeDefined();
    expect(screen.getByText('Gadget Max')).toBeDefined();
    expect(screen.getByText('Central Warehouse')).toBeDefined();
    expect(screen.getByText('North Annex')).toBeDefined();

    // Type badges
    expect(screen.getByText('RECEIPT')).toBeDefined();
    expect(screen.getByText('ISSUE')).toBeDefined();

    // Exact signed deltas
    expect(screen.getByText('+25.5000')).toBeDefined();
    expect(screen.getByText('-10.2500')).toBeDefined();

    // Balances before and after
    expect(screen.getByText('100.0000')).toBeDefined();
    expect(screen.getByText('125.5000')).toBeDefined();
    expect(screen.getByText('50.0000')).toBeDefined();
    expect(screen.getByText('39.7500')).toBeDefined();

    // References
    expect(screen.getByText('Ref: PO-2026-001')).toBeDefined();
    expect(screen.getByText('Ref: SO-2026-002')).toBeDefined();
  });

  it('6. clicking column headers triggers onSort with allowed sort field', () => {
    renderWithClient(
      <StockLedgerTable
        entries={mockEntries}
        isLoading={false}
        isError={false}
        sortBy="createdAt"
        sortOrder="desc"
        onSort={onSort}
      />,
    );

    const timestampHeader = screen.getByRole('button', { name: /timestamp/i });
    fireEvent.click(timestampHeader);
    expect(onSort).toHaveBeenCalledWith('createdAt');

    const typeHeader = screen.getByRole('button', { name: /type/i });
    fireEvent.click(typeHeader);
    expect(onSort).toHaveBeenCalledWith('type');

    const deltaHeader = screen.getByRole('button', { name: /delta/i });
    fireEvent.click(deltaHeader);
    expect(onSort).toHaveBeenCalledWith('quantityDelta');
  });
});
