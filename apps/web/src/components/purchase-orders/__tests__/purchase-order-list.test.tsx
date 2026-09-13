import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { PurchaseOrderTable } from '../purchase-order-table';
import { PurchaseOrderTableToolbar } from '../purchase-order-table-toolbar';
import { PurchaseOrderTablePagination } from '../purchase-order-table-pagination';
import { warehousesApi } from '../../../lib/api/warehouses';
import type { PurchaseOrderDto, WarehouseDto } from '@repo/types';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/purchase-orders',
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
];

const mockOrders: PurchaseOrderDto[] = [
  {
    id: 'po-1',
    organizationId: 'org-1',
    purchaseOrderNumber: 'PO-2026-001',
    supplierName: 'Acme Supplies',
    status: 'DRAFT',
    orderDate: '2026-10-01T00:00:00.000Z',
    warehouseId: 'wh-1',
    currency: 'USD',
    subtotal: '100.0000',
    taxTotal: '0.0000',
    grandTotal: '100.0000',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    lines: [],
  },
  {
    id: 'po-2',
    organizationId: 'org-1',
    purchaseOrderNumber: 'PO-2026-002',
    supplierName: 'Global Logistics',
    status: 'APPROVED',
    orderDate: '2026-10-05T00:00:00.000Z',
    warehouseId: 'wh-1',
    currency: 'USD',
    subtotal: '250.0000',
    taxTotal: '0.0000',
    grandTotal: '250.0000',
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
    lines: [],
  },
];

describe('PurchaseOrderTable and List Components', () => {
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
  });

  it('1. renders table headers and rows correctly', async () => {
    renderWithClient(<PurchaseOrderTable orders={mockOrders} isLoading={false} isError={false} />);

    expect(screen.getAllByText('PO-2026-001')[0]).toBeInTheDocument();
    expect(screen.getAllByText('PO-2026-002')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Acme Supplies')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Global Logistics')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Draft')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Approved')[0]).toBeInTheDocument();
    expect(screen.getAllByText('USD 100.0000')[0]).toBeInTheDocument();
    expect(screen.getAllByText('USD 250.0000')[0]).toBeInTheDocument();
  });

  it('2. displays empty state when no orders exist', () => {
    renderWithClient(
      <PurchaseOrderTable orders={[]} isLoading={false} isError={false} hasFilters={false} />,
    );

    expect(screen.getByText('No purchase orders yet')).toBeInTheDocument();
  });

  it('3. displays filtered empty state when filters are active', () => {
    renderWithClient(
      <PurchaseOrderTable orders={[]} isLoading={false} isError={false} hasFilters={true} />,
    );

    expect(screen.getByText('No purchase orders match your filters')).toBeInTheDocument();
  });

  it('4. triggers onSort when column header is clicked', () => {
    const handleSort = vi.fn();
    renderWithClient(
      <PurchaseOrderTable
        orders={mockOrders}
        isLoading={false}
        isError={false}
        sortBy="purchaseOrderNumber"
        sortOrder="asc"
        onSort={handleSort}
      />,
    );

    const poHeader = screen.getByRole('columnheader', { name: /PO Number/i });
    fireEvent.click(poHeader);
    expect(handleSort).toHaveBeenCalledWith('purchaseOrderNumber');
  });

  it('5. triggers onAction when action is initiated', () => {
    const handleAction = vi.fn();
    renderWithClient(
      <PurchaseOrderTable
        orders={mockOrders}
        isLoading={false}
        isError={false}
        onAction={handleAction}
      />,
    );

    // Mobile action button for DRAFT po
    const submitBtns = screen.getAllByRole('button', { name: /Submit/i });
    expect(submitBtns[0]).toBeDefined();
    fireEvent.click(submitBtns[0]!);
    expect(handleAction).toHaveBeenCalledWith(mockOrders[0], 'submit');
  });

  it('6. toolbar handles search input and reset', () => {
    const handleSearch = vi.fn();
    const handleReset = vi.fn();

    renderWithClient(
      <PurchaseOrderTableToolbar
        search="PO-2026"
        onSearchChange={handleSearch}
        status={undefined}
        onStatusChange={vi.fn()}
        warehouseId={undefined}
        onWarehouseChange={vi.fn()}
        onReset={handleReset}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search PO or supplier...');
    expect(searchInput).toHaveValue('PO-2026');

    const resetBtn = screen.getByRole('button', { name: /Reset all filters/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalled();
  });

  it('7. pagination renders item range and page navigation buttons', () => {
    const handlePageChange = vi.fn();
    const handleLimitChange = vi.fn();

    renderWithClient(
      <PurchaseOrderTablePagination
        page={1}
        limit={10}
        total={25}
        totalPages={3}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />,
    );

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    const nextPageBtn = screen.getByRole('button', { name: /Go to next page/i });
    fireEvent.click(nextPageBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});
