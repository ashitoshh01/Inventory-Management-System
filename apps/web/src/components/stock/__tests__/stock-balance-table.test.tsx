import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { StockBalanceTable } from '../stock-balance-table';
import type { StockBalanceDto } from '@repo/types';

// Mock Next.js navigation and products/warehouses hooks
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

const mockBalances: StockBalanceDto[] = [
  {
    id: 'bal-1',
    organizationId: 'org-test',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity: '100.5000',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T12:30:00.000Z',
  },
  {
    id: 'bal-2',
    organizationId: 'org-test',
    productId: 'prod-2',
    warehouseId: 'wh-2',
    quantity: '0.0000',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T14:00:00.000Z',
  },
];

describe('StockBalanceTable Component', () => {
  const onSort = vi.fn();
  const onRetry = vi.fn();
  const onResetFilters = vi.fn();
  const onMutateStock = vi.fn();
  const onAddNewMutation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state with table skeleton rows', () => {
    renderWithClient(
      <StockBalanceTable balances={[]} isLoading={true} isError={false} onSort={onSort} />,
    );

    // Should have table header and skeleton elements
    expect(screen.getByText('Product')).toBeDefined();
    expect(screen.getByText('Warehouse')).toBeDefined();
    expect(screen.getByText('Quantity')).toBeDefined();
  });

  it('renders error state with retry button', () => {
    renderWithClient(
      <StockBalanceTable
        balances={[]}
        isLoading={false}
        isError={true}
        error={new Error('Failed to load balances')}
        onSort={onSort}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Error Loading Stock Balances')).toBeDefined();
    expect(screen.getByText('Failed to load balances')).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no balances exist', () => {
    renderWithClient(
      <StockBalanceTable
        balances={[]}
        isLoading={false}
        isError={false}
        onSort={onSort}
        onAddNewMutation={onAddNewMutation}
      />,
    );

    expect(screen.getByText('No stock balances found')).toBeDefined();
    const recordBtn = screen.getByRole('button', { name: /record stock mutation/i });
    fireEvent.click(recordBtn);
    expect(onAddNewMutation).toHaveBeenCalledTimes(1);
  });

  it('renders empty filter state when filtered out', () => {
    renderWithClient(
      <StockBalanceTable
        balances={[]}
        isLoading={false}
        isError={false}
        hasFilters={true}
        onSort={onSort}
        onResetFilters={onResetFilters}
      />,
    );

    expect(screen.getByText('No matching stock balances')).toBeDefined();
    const resetBtn = screen.getByRole('button', { name: /reset filters/i });
    fireEvent.click(resetBtn);
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('renders stock balance rows with resolved product/warehouse names and exact decimal values', () => {
    renderWithClient(
      <StockBalanceTable
        balances={mockBalances}
        isLoading={false}
        isError={false}
        onSort={onSort}
        onMutateStock={onMutateStock}
      />,
    );

    // Product names and SKUs
    expect(screen.getByText('Widget A')).toBeDefined();
    expect(screen.getByText(/SKU: WGT-01/)).toBeDefined();
    expect(screen.getByText('Gadget B')).toBeDefined();
    expect(screen.getByText(/SKU: GDT-02/)).toBeDefined();

    // Warehouse names and codes
    expect(screen.getByText('Main Depot')).toBeDefined();
    expect(screen.getByText('WH-MAIN')).toBeDefined();
    expect(screen.getByText('East Annex')).toBeDefined();
    expect(screen.getByText('WH-EAST')).toBeDefined();

    // Quantities displayed as exact strings
    expect(screen.getByText('100.5000')).toBeDefined();
    expect(screen.getByText('0.0000')).toBeDefined();
    expect(screen.getByText('Zero Stock')).toBeDefined();
  });

  it('triggers onSort when clicking column headers', () => {
    renderWithClient(
      <StockBalanceTable
        balances={mockBalances}
        isLoading={false}
        isError={false}
        onSort={onSort}
      />,
    );

    const qtySortBtn = screen.getByRole('button', { name: /quantity/i });
    fireEvent.click(qtySortBtn);
    expect(onSort).toHaveBeenCalledWith('quantity');

    const updatedSortBtn = screen.getByRole('button', { name: /last updated/i });
    fireEvent.click(updatedSortBtn);
    expect(onSort).toHaveBeenCalledWith('updatedAt');
  });

  it('triggers onMutateStock when clicking Mutate action button', () => {
    renderWithClient(
      <StockBalanceTable
        balances={mockBalances}
        isLoading={false}
        isError={false}
        onSort={onSort}
        onMutateStock={onMutateStock}
      />,
    );

    const mutateBtns = screen.getAllByRole('button', { name: /mutate/i });
    expect(mutateBtns.length).toBeGreaterThan(0);
    fireEvent.click(mutateBtns[0]!);
    expect(onMutateStock).toHaveBeenCalledWith(mockBalances[0]);
  });
});
