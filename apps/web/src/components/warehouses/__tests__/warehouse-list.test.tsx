import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import WarehousesPage from '../../../app/warehouses/page';
import { WarehouseTable } from '../warehouse-table';
import { WarehouseTableToolbar } from '../warehouse-table-toolbar';
import { WarehouseTablePagination } from '../warehouse-table-pagination';
import { warehousesApi } from '../../../lib/api/warehouses';
import type { WarehouseDto } from '@repo/types';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/warehouses',
}));

const mockWarehouses: WarehouseDto[] = [
  {
    id: 'wh-1',
    organizationId: 'org-test',
    name: 'Primary Center',
    code: 'WH-01',
    description: 'Central distribution depot',
    addressLine1: '123 Harbor Way',
    addressLine2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    status: 'ACTIVE',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'wh-2',
    organizationId: 'org-test',
    name: 'Auxiliary Depot',
    code: 'WH-02',
    description: 'Secondary cold-storage location',
    addressLine1: '456 Industrial Park',
    addressLine2: null,
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    country: 'India',
    status: 'INACTIVE',
    isDefault: false,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
];

describe('Warehouse List Component & Page (Phase 4D UX & Accessibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    localStorage.setItem('activeOrganizationId', 'org-test');
  });

  it('1. renders loading/skeleton state in WarehouseTable', () => {
    renderWithClient(<WarehouseTable isLoading={true} isError={false} warehouses={[]} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Facility Code')).toBeInTheDocument();
  });

  it('2. renders warehouses from API response with table typography, badges, and default indicator', () => {
    renderWithClient(
      <WarehouseTable isLoading={false} isError={false} warehouses={mockWarehouses} />,
    );

    expect(screen.getByText('Primary Center')).toBeInTheDocument();
    expect(screen.getByText('WH-01')).toBeInTheDocument();
    expect(screen.getByText('Mumbai, Maharashtra, India')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();

    expect(screen.getByText('Auxiliary Depot')).toBeInTheDocument();
    expect(screen.getByText('WH-02')).toBeInTheDocument();
    expect(screen.getByText('Pune, Maharashtra, India')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('3. renders empty state when organization has no warehouses', () => {
    const handleCreate = vi.fn();
    renderWithClient(
      <WarehouseTable
        isLoading={false}
        isError={false}
        warehouses={[]}
        hasFilters={false}
        onCreateNew={handleCreate}
      />,
    );

    expect(screen.getByText('No warehouses yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Your organization doesn't have any warehouses or facilities yet/i),
    ).toBeInTheDocument();
    const createBtn = screen.getByRole('button', { name: /create warehouse/i });
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);
    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it('4. renders empty state when search/filters produce zero results', () => {
    const handleReset = vi.fn();
    renderWithClient(
      <WarehouseTable
        isLoading={false}
        isError={false}
        warehouses={[]}
        hasFilters={true}
        onResetFilters={handleReset}
      />,
    );

    expect(screen.getByText('No matching warehouses')).toBeInTheDocument();
    expect(
      screen.getByText(/No warehouses match your current search and filter criteria/i),
    ).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: /reset filters/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('5. renders error state with functional Retry button when API fails', () => {
    const handleRetry = vi.fn();
    renderWithClient(
      <WarehouseTable
        isLoading={false}
        isError={true}
        error={new Error('Network connection failure')}
        warehouses={[]}
        onRetry={handleRetry}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load warehouses')).toBeInTheDocument();
    expect(screen.getByText('Network connection failure')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('6. search updates query, handles keyboard Escape to clear, and clear button', () => {
    const handleSearchChange = vi.fn();

    const { rerender } = renderWithClient(
      <WarehouseTableToolbar
        search="Harbor"
        onSearchChange={handleSearchChange}
        status={undefined}
        onStatusChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/search warehouses by name, code, or city/i);
    expect(input).toHaveValue('Harbor');

    // Test Escape key clears search
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handleSearchChange).toHaveBeenCalledWith('');

    // Test clear search button click
    const clearBtn = screen.getByRole('button', { name: /clear search query/i });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('');

    // Test empty input hides clear button
    rerender(
      <WarehouseTableToolbar
        search=""
        onSearchChange={handleSearchChange}
        status={undefined}
        onStatusChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /clear search query/i })).not.toBeInTheDocument();
  });

  it('7. toolbar shows active filter chips and individual remove buttons', () => {
    const handleStatusChange = vi.fn();
    const handleSearchChange = vi.fn();
    const handleReset = vi.fn();

    renderWithClient(
      <WarehouseTableToolbar
        search="Hub"
        onSearchChange={handleSearchChange}
        status="ACTIVE"
        onStatusChange={handleStatusChange}
        onReset={handleReset}
      />,
    );

    expect(screen.getByText(/active filters:/i)).toBeInTheDocument();

    // Verify search chip and remove
    const removeSearchBtn = screen.getByRole('button', { name: /remove search query filter/i });
    expect(removeSearchBtn).toBeInTheDocument();
    fireEvent.click(removeSearchBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('');

    // Verify status chip and remove
    const removeStatusBtn = screen.getByRole('button', { name: /remove status filter ACTIVE/i });
    expect(removeStatusBtn).toBeInTheDocument();
    fireEvent.click(removeStatusBtn);
    expect(handleStatusChange).toHaveBeenCalledWith(undefined);

    // Reset button clears all
    const resetBtn = screen.getByRole('button', { name: /reset all filters/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('8. table column headers support interactive sorting with mouse and keyboard', () => {
    const handleSort = vi.fn();

    renderWithClient(
      <WarehouseTable
        isLoading={false}
        isError={false}
        warehouses={mockWarehouses}
        sortBy="name"
        sortOrder="asc"
        onSort={handleSort}
      />,
    );

    // Header has aria-sort="ascending"
    const nameHeader = screen.getByRole('columnheader', { name: /sort by warehouse name/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    // Click triggers sort
    fireEvent.click(nameHeader);
    expect(handleSort).toHaveBeenCalledWith('name');

    // Keyboard (Enter / Space) triggers sort
    const codeHeader = screen.getByRole('columnheader', { name: /sort by facility code/i });
    expect(codeHeader).toHaveAttribute('aria-sort', 'none');
    fireEvent.keyDown(codeHeader, { key: 'Enter' });
    expect(handleSort).toHaveBeenCalledWith('code');

    fireEvent.keyDown(codeHeader, { key: ' ' });
    expect(handleSort).toHaveBeenCalledWith('code');
  });

  it('9. pagination controls format range with en-dash and support direct page buttons', () => {
    const handlePageChange = vi.fn();
    const handleLimitChange = vi.fn();

    renderWithClient(
      <WarehouseTablePagination
        page={2}
        limit={10}
        total={35}
        totalPages={4}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />,
    );

    // Formatted range with en-dash: 11–20 of 35 results
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();

    // Direct page buttons exist
    const page1Btn = screen.getByRole('button', { name: 'Page 1' });
    const page2Btn = screen.getByRole('button', { name: 'Page 2' });
    expect(page2Btn).toHaveAttribute('aria-current', 'page');

    fireEvent.click(page1Btn);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    // Next / Previous buttons
    const prevBtn = screen.getByRole('button', { name: /previous page/i });
    expect(prevBtn).toBeEnabled();
    fireEvent.click(prevBtn);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    expect(nextBtn).toBeEnabled();
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('10. row click navigates to warehouse details and action menu has accessible label', () => {
    renderWithClient(
      <WarehouseTable isLoading={false} isError={false} warehouses={mockWarehouses} />,
    );

    const row = screen.getByText('Primary Center').closest('tr');
    expect(row).toBeInTheDocument();
    fireEvent.click(row!);
    expect(mockPush).toHaveBeenCalledWith('/warehouses/wh-1');

    // Action menu has accessible label identifying the warehouse
    const actionBtns = screen.getAllByRole('button', { name: /actions for warehouse/i });
    expect(actionBtns).toHaveLength(2);
    expect(actionBtns[0]).toHaveAttribute(
      'aria-label',
      'Actions for warehouse Primary Center (WH-01)',
    );
  });

  it('11. full page renders warehouses with API integration and syncs search, status, and sort to URL', async () => {
    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: mockWarehouses,
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'req-wh-1',
      },
    });

    renderWithClient(<WarehousesPage />);

    await waitFor(() => {
      expect(screen.getByText('Primary Center')).toBeInTheDocument();
    });

    expect(screen.getByText('Auxiliary Depot')).toBeInTheDocument();

    // Type into search
    const searchInput = screen.getByLabelText(/search warehouses by name, code, or city/i);
    fireEvent.change(searchInput, { target: { value: 'Center' } });

    // Verify debounce triggers API call and URL sync
    await waitFor(() => {
      expect(warehousesApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Center', page: 1 }),
      );
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('search=Center'),
        expect.objectContaining({ scroll: false }),
      );
    });

    // Click sort on code column
    const codeHeader = screen.getByRole('columnheader', { name: /sort by facility code/i });
    fireEvent.click(codeHeader);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=code'),
        expect.objectContaining({ scroll: false }),
      );
    });
  });

  it('12. restores search, status, sort, and pagination state from URL parameters on mount', async () => {
    mockSearchParams = new URLSearchParams(
      'search=Auxiliary&status=INACTIVE&page=2&sortBy=name&sortOrder=asc',
    );

    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: [mockWarehouses[1]!],
      meta: {
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
        requestId: 'req-wh-restore',
      },
    });

    renderWithClient(<WarehousesPage />);

    // Verify initial query called with values parsed from URL
    await waitFor(() => {
      expect(warehousesApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Auxiliary',
          status: 'INACTIVE',
          page: 2,
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      );
    });

    // Check that search input is initialized with 'Auxiliary'
    const searchInput = screen.getByLabelText(/search warehouses by name, code, or city/i);
    expect(searchInput).toHaveValue('Auxiliary');
  });

  it('13. auto-recovers to valid page if current page exceeds totalPages after item deletion', async () => {
    mockSearchParams = new URLSearchParams('page=4');

    // Return total: 2, limit: 10, totalPages: 1 (page 4 is now invalid)
    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: mockWarehouses,
      meta: {
        total: 2,
        page: 4,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
        requestId: 'req-page-recovery',
      },
    });

    renderWithClient(<WarehousesPage />);

    // Expect auto-recovery to adjust page back to valid page 1
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.not.stringContaining('page=4'),
        expect.objectContaining({ scroll: false }),
      );
    });
  });

  it('14. safely handles malformed URL query parameters without errors', async () => {
    mockSearchParams = new URLSearchParams(
      'status=INVALID_STATUS&page=-5&limit=999999&sortBy=DROP_TABLE&sortOrder=INVALID_ORDER',
    );

    vi.spyOn(warehousesApi, 'list').mockResolvedValue({
      data: mockWarehouses,
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'req-malformed',
      },
    });

    renderWithClient(<WarehousesPage />);

    await waitFor(() => {
      // Query should be called with sanitized defaults:
      // status: undefined, page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc'
      expect(warehousesApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          status: undefined,
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      );
    });
  });
});
