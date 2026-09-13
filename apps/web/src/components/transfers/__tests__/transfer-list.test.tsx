import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { TransferTable } from '../transfer-table';
import { TransferTablePagination } from '../transfer-table-pagination';
import { TransferStatusBadge } from '../transfer-status-badge';
import { warehousesApi } from '../../../lib/api/warehouses';
import type { StockTransferDto, WarehouseDto } from '@repo/types';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/transfers',
}));

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
  {
    id: 'wh-2',
    organizationId: 'org-1',
    name: 'Secondary Hub',
    code: 'WH-SEC',
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

const mockTransfers: StockTransferDto[] = [
  {
    id: 'tr-1',
    organizationId: 'org-1',
    transferNumber: 'TR-2026-001',
    status: 'DRAFT',
    sourceWarehouseId: 'wh-1',
    destinationWarehouseId: 'wh-2',
    sourceWarehouse: mockWarehouses[0],
    destinationWarehouse: mockWarehouses[1],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    lines: [
      {
        id: 'line-1',
        organizationId: 'org-1',
        transferId: 'tr-1',
        productId: 'prod-1',
        quantity: '5.0000',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'tr-2',
    organizationId: 'org-1',
    transferNumber: 'TR-2026-002',
    status: 'IN_TRANSIT',
    sourceWarehouseId: 'wh-1',
    destinationWarehouseId: 'wh-2',
    sourceWarehouse: mockWarehouses[0],
    destinationWarehouse: mockWarehouses[1],
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
    lines: [],
  },
];

describe('TransferTable and List Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: mockWarehouses,
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'r1',
      },
    });
  });

  it('1. renders table headers, transfer numbers, and warehouses correctly', () => {
    renderWithClient(<TransferTable transfers={mockTransfers} isLoading={false} isError={false} />);

    expect(screen.getByText('TR-2026-001')).toBeInTheDocument();
    expect(screen.getByText('TR-2026-002')).toBeInTheDocument();
    expect(screen.getAllByText('Main Facility').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Secondary Hub').length).toBeGreaterThan(0);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('In Transit')).toBeInTheDocument();
  });

  it('2. displays empty state when no transfers exist', () => {
    renderWithClient(
      <TransferTable transfers={[]} isLoading={false} isError={false} hasFilters={false} />,
    );

    expect(screen.getByText('No stock transfers yet')).toBeInTheDocument();
  });

  it('3. displays filtered empty state when search/filter is active', () => {
    renderWithClient(
      <TransferTable transfers={[]} isLoading={false} isError={false} hasFilters={true} />,
    );

    expect(screen.getByText('No stock transfers match your filters')).toBeInTheDocument();
  });

  it('4. triggers onSort when column header button is clicked', () => {
    const handleSort = vi.fn();
    renderWithClient(
      <TransferTable
        transfers={mockTransfers}
        isLoading={false}
        isError={false}
        sortBy="transferNumber"
        sortOrder="asc"
        onSort={handleSort}
      />,
    );

    const sortButton = screen.getByRole('button', { name: /Transfer #/i });
    fireEvent.click(sortButton);
    expect(handleSort).toHaveBeenCalledWith('transferNumber');
  });

  it('5. renders pagination controls properly', () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();

    renderWithClient(
      <TransferTablePagination
        page={1}
        limit={10}
        total={25}
        totalPages={3}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />,
    );

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    const nextBtn = screen.getByLabelText('Go to next page');
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('6. renders status badges with expected labels', () => {
    const { rerender } = renderWithClient(<TransferStatusBadge status="DRAFT" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();

    rerender(<TransferStatusBadge status="APPROVED" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();

    rerender(<TransferStatusBadge status="IN_TRANSIT" />);
    expect(screen.getByText('In Transit')).toBeInTheDocument();

    rerender(<TransferStatusBadge status="RECEIVED" />);
    expect(screen.getByText('Received')).toBeInTheDocument();

    rerender(<TransferStatusBadge status="CANCELLED" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});
