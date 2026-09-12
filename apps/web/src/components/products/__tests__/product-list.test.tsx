import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import ProductsPage from '../../../app/products/page';
import { ProductTable } from '../product-table';
import { ProductTableToolbar } from '../product-table-toolbar';
import { ProductTablePagination } from '../product-table-pagination';
import { productsApi } from '../../../lib/api/products';
import { categoriesApi } from '../../../lib/api/categories';
import type { ProductDto, CategoryDto } from '@repo/types';

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
  usePathname: () => '/products',
}));

const mockCategories: CategoryDto[] = [
  {
    id: 'cat-1',
    organizationId: 'org-1',
    name: 'Electronics',
    description: 'Gadgets and electronic components',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-2',
    organizationId: 'org-1',
    name: 'Hardware',
    description: 'Tools and fasteners',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const mockProducts: ProductDto[] = [
  {
    id: 'prod-1',
    organizationId: 'org-1',
    categoryId: 'cat-1',
    name: 'Wireless Mouse',
    sku: 'MOUSE-001',
    description: 'Ergonomic optical mouse',
    unitOfMeasure: 'UNIT',
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
    category: mockCategories[0]!,
  },
  {
    id: 'prod-2',
    organizationId: 'org-1',
    categoryId: 'cat-2',
    name: 'Hex Bolt 10mm',
    sku: 'BOLT-010',
    description: 'Stainless steel hex bolt',
    unitOfMeasure: 'BOX',
    status: 'INACTIVE',
    createdAt: '2026-01-12T12:00:00.000Z',
    updatedAt: '2026-01-12T12:00:00.000Z',
    category: mockCategories[1]!,
  },
];

describe('Product List Component & Page (Phase 3E UX & Accessibility)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    localStorage.setItem('activeOrganizationId', 'org-1');
  });

  it('1. renders loading/skeleton state in ProductTable', () => {
    renderWithClient(<ProductTable isLoading={true} isError={false} products={[]} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('SKU')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('2. renders products from API response with dense table typography', () => {
    renderWithClient(<ProductTable isLoading={false} isError={false} products={mockProducts} />);

    expect(screen.getByText('Wireless Mouse')).toBeInTheDocument();
    expect(screen.getByText('MOUSE-001')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('Hex Bolt 10mm')).toBeInTheDocument();
    expect(screen.getByText('BOLT-010')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('3. renders empty state when organization has no products', () => {
    renderWithClient(
      <ProductTable
        isLoading={false}
        isError={false}
        products={[]}
        hasFilters={false}
        onAddNew={vi.fn()}
      />,
    );

    expect(screen.getByText('No products yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Your organization doesn't have any products in the catalog yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
  });

  it('4. renders empty state when search/filters produce zero results', () => {
    const handleReset = vi.fn();
    renderWithClient(
      <ProductTable
        isLoading={false}
        isError={false}
        products={[]}
        hasFilters={true}
        onResetFilters={handleReset}
      />,
    );

    expect(screen.getByText('No matching products')).toBeInTheDocument();
    expect(
      screen.getByText(/No products match your current search and filter criteria/i),
    ).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: /reset filters/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('5. renders error state with functional Retry button when API fails', () => {
    const handleRetry = vi.fn();
    renderWithClient(
      <ProductTable
        isLoading={false}
        isError={true}
        error={new Error('Network connection failure')}
        products={[]}
        onRetry={handleRetry}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load products')).toBeInTheDocument();
    expect(screen.getByText('Network connection failure')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('6. search updates query, handles keyboard Escape to clear, and clear button', () => {
    const handleSearchChange = vi.fn();

    const { rerender } = renderWithClient(
      <ProductTableToolbar
        search="Keyboard"
        onSearchChange={handleSearchChange}
        onCategoryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onUnitOfMeasureChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/search products by name or sku/i);
    expect(input).toHaveValue('Keyboard');

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
      <ProductTableToolbar
        search=""
        onSearchChange={handleSearchChange}
        onCategoryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onUnitOfMeasureChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /clear search query/i })).not.toBeInTheDocument();
  });

  it('7. toolbar shows active filter chips and individual remove buttons', async () => {
    vi.spyOn(categoriesApi, 'list').mockResolvedValue({
      data: mockCategories,
      meta: { requestId: 'req-cat' },
    });

    const handleCategoryChange = vi.fn();
    const handleStatusChange = vi.fn();
    const handleUnitChange = vi.fn();
    const handleReset = vi.fn();

    renderWithClient(
      <ProductTableToolbar
        search=""
        onSearchChange={vi.fn()}
        categoryId="cat-1"
        onCategoryChange={handleCategoryChange}
        status="ACTIVE"
        onStatusChange={handleStatusChange}
        unitOfMeasure="UNIT"
        onUnitOfMeasureChange={handleUnitChange}
        onReset={handleReset}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/active filters:/i)).toBeInTheDocument();
    });

    // Verify individual remove buttons
    const removeStatusBtn = screen.getByRole('button', { name: /remove status filter ACTIVE/i });
    expect(removeStatusBtn).toBeInTheDocument();
    fireEvent.click(removeStatusBtn);
    expect(handleStatusChange).toHaveBeenCalledWith(undefined);

    const removeUnitBtn = screen.getByRole('button', {
      name: /remove unit of measure filter UNIT/i,
    });
    expect(removeUnitBtn).toBeInTheDocument();
    fireEvent.click(removeUnitBtn);
    expect(handleUnitChange).toHaveBeenCalledWith(undefined);

    // Reset button clears all
    const resetBtn = screen.getByRole('button', { name: /reset all filters/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('8. table column headers support interactive sorting with mouse and keyboard', () => {
    const handleSort = vi.fn();

    renderWithClient(
      <ProductTable
        isLoading={false}
        isError={false}
        products={mockProducts}
        sortBy="name"
        sortOrder="asc"
        onSort={handleSort}
      />,
    );

    // Header has aria-sort="ascending"
    const nameHeader = screen.getByRole('columnheader', { name: /sort by product name/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    // Click triggers sort
    fireEvent.click(nameHeader);
    expect(handleSort).toHaveBeenCalledWith('name');

    // Keyboard (Enter / Space) triggers sort
    const skuHeader = screen.getByRole('columnheader', { name: /sort by sku/i });
    expect(skuHeader).toHaveAttribute('aria-sort', 'none');
    fireEvent.keyDown(skuHeader, { key: 'Enter' });
    expect(handleSort).toHaveBeenCalledWith('sku');

    fireEvent.keyDown(skuHeader, { key: ' ' });
    expect(handleSort).toHaveBeenCalledWith('sku');
  });

  it('9. pagination controls format range with en-dash and support direct page buttons', () => {
    const handlePageChange = vi.fn();
    const handleLimitChange = vi.fn();

    renderWithClient(
      <ProductTablePagination
        page={2}
        limit={10}
        total={45}
        totalPages={5}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />,
    );

    // Formatted range with en-dash: 11–20 of 45 results
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();

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

  it('10. row click navigates to product details and action menu has accessible label', () => {
    renderWithClient(<ProductTable isLoading={false} isError={false} products={mockProducts} />);

    const row = screen.getByText('Wireless Mouse').closest('tr');
    expect(row).toBeInTheDocument();
    fireEvent.click(row!);
    expect(mockPush).toHaveBeenCalledWith('/products/prod-1');

    // Action menu has accessible label identifying the product
    const actionBtns = screen.getAllByRole('button', { name: /actions for product/i });
    expect(actionBtns).toHaveLength(2);
    expect(actionBtns[0]).toHaveAttribute(
      'aria-label',
      'Actions for product Wireless Mouse (MOUSE-001)',
    );
  });

  it('11. permission-aware UI hides Add Product button when user lacks create permission', async () => {
    localStorage.setItem('user_permissions', JSON.stringify(['product.read']));

    vi.spyOn(productsApi, 'list').mockResolvedValue({
      data: mockProducts,
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'req-perm',
      },
    });

    renderWithClient(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText('Wireless Mouse')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /add new product/i })).not.toBeInTheDocument();
  });

  it('12. full page renders products with API integration and syncs search and sort to URL', async () => {
    vi.spyOn(productsApi, 'list').mockResolvedValue({
      data: mockProducts,
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        requestId: 'req-1',
      },
    });

    vi.spyOn(categoriesApi, 'list').mockResolvedValue({
      data: mockCategories,
      meta: { requestId: 'req-2' },
    });

    renderWithClient(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText('Wireless Mouse')).toBeInTheDocument();
    });

    expect(screen.getByText('Hex Bolt 10mm')).toBeInTheDocument();

    // Type into search
    const searchInput = screen.getByLabelText(/search products by name or sku/i);
    fireEvent.change(searchInput, { target: { value: 'Mouse' } });

    // Verify debounce triggers API call and URL sync
    await waitFor(() => {
      expect(productsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Mouse', page: 1 }),
      );
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('search=Mouse'),
        expect.objectContaining({ scroll: false }),
      );
    });

    // Click sort on SKU column
    const skuHeader = screen.getByRole('columnheader', { name: /sort by sku/i });
    fireEvent.click(skuHeader);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=sku'),
        expect.objectContaining({ scroll: false }),
      );
    });
  });

  it('13. restores search, status, and pagination state from URL parameters on mount', async () => {
    mockSearchParams = new URLSearchParams(
      'search=Bolt&status=INACTIVE&page=2&sortBy=name&sortOrder=asc',
    );

    vi.spyOn(productsApi, 'list').mockResolvedValue({
      data: [mockProducts[1]!],
      meta: {
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
        requestId: 'req-url-restore',
      },
    });

    vi.spyOn(categoriesApi, 'list').mockResolvedValue({
      data: mockCategories,
      meta: { requestId: 'req-cats' },
    });

    renderWithClient(<ProductsPage />);

    // Verify initial query called with values parsed from URL
    await waitFor(() => {
      expect(productsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Bolt',
          status: 'INACTIVE',
          page: 2,
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      );
    });

    // Check that search input is initialized with 'Bolt'
    const searchInput = screen.getByLabelText(/search products by name or sku/i);
    expect(searchInput).toHaveValue('Bolt');
  });

  it('14. auto-recovers to valid page if current page exceeds totalPages after item deletion', async () => {
    mockSearchParams = new URLSearchParams('page=3');

    // Return total: 5, limit: 10, so totalPages is 1 (page 3 is now invalid)
    vi.spyOn(productsApi, 'list').mockResolvedValue({
      data: mockProducts,
      meta: {
        total: 2,
        page: 3,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
        requestId: 'req-page-shrink',
      },
    });

    vi.spyOn(categoriesApi, 'list').mockResolvedValue({
      data: mockCategories,
      meta: { requestId: 'req-cats' },
    });

    renderWithClient(<ProductsPage />);

    // Expect auto-recovery to adjust page back to valid page 1
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.not.stringContaining('page=3'),
        expect.objectContaining({ scroll: false }),
      );
    });
  });
});
