'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, UploadCloud } from 'lucide-react';
import { Button, Skeleton } from '@repo/ui';
import { useProducts } from '../../hooks/use-products';
import { usePermissions } from '../../hooks/use-permissions';
import { ProductTable } from '../../components/products/product-table';
import { ProductTableToolbar } from '../../components/products/product-table-toolbar';
import { ProductTablePagination } from '../../components/products/product-table-pagination';
import { ProductFormDialog } from '../../components/products/product-form-dialog';
import { ProductDeleteDialog } from '../../components/products/product-delete-dialog';
import type { ProductDto, ProductStatus, UnitOfMeasure, SortOrder } from '@repo/types';

function ProductsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateProduct, canUpdateProduct, canDeleteProduct } = usePermissions();

  // Parse initial state from URL parameters
  const initialSearch = searchParams?.get('search') || '';
  const initialCategory = searchParams?.get('categoryId') || undefined;
  const initialStatus = (searchParams?.get('status') as ProductStatus) || undefined;
  const initialUom = (searchParams?.get('unitOfMeasure') as UnitOfMeasure) || undefined;
  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;
  const initialSortBy = searchParams?.get('sortBy') || 'createdAt';
  const initialSortOrder = (searchParams?.get('sortOrder') as SortOrder) || 'desc';

  // Search & Filter state
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [categoryId, setCategoryId] = React.useState<string | undefined>(initialCategory);
  const [status, setStatus] = React.useState<ProductStatus | undefined>(initialStatus);
  const [unitOfMeasure, setUnitOfMeasure] = React.useState<UnitOfMeasure | undefined>(initialUom);

  // Sorting state
  const [sortBy, setSortBy] = React.useState<string>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialSortOrder);

  // Pagination state
  const [page, setPage] = React.useState<number>(initialPage);
  const [limit, setLimit] = React.useState<number>(initialLimit);

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<ProductDto | null>(null);

  // Track whether initial mount has completed to avoid redundant URL updates
  const isFirstRender = React.useRef(true);

  // Helper to synchronize state to URL search parameters
  const syncToUrl = React.useCallback(
    (updates: {
      search?: string;
      categoryId?: string | undefined;
      status?: ProductStatus | undefined;
      unitOfMeasure?: UnitOfMeasure | undefined;
      sortBy?: string;
      sortOrder?: SortOrder;
      page?: number;
      limit?: number;
    }) => {
      const current = searchParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      const newSearch = updates.search !== undefined ? updates.search : debouncedSearch;
      const newCat = updates.categoryId !== undefined ? updates.categoryId : categoryId;
      const newStatus = updates.status !== undefined ? updates.status : status;
      const newUom = updates.unitOfMeasure !== undefined ? updates.unitOfMeasure : unitOfMeasure;
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : sortBy;
      const newSortOrder = updates.sortOrder !== undefined ? updates.sortOrder : sortOrder;
      const newPage = updates.page !== undefined ? updates.page : page;
      const newLimit = updates.limit !== undefined ? updates.limit : limit;

      if (newSearch) current.set('search', newSearch);
      else current.delete('search');

      if (newCat) current.set('categoryId', newCat);
      else current.delete('categoryId');

      if (newStatus) current.set('status', newStatus);
      else current.delete('status');

      if (newUom) current.set('unitOfMeasure', newUom);
      else current.delete('unitOfMeasure');

      if (newSortBy && newSortBy !== 'createdAt') current.set('sortBy', newSortBy);
      else current.delete('sortBy');

      if (newSortOrder && newSortOrder !== 'desc') current.set('sortOrder', newSortOrder);
      else current.delete('sortOrder');

      if (newPage > 1) current.set('page', String(newPage));
      else current.delete('page');

      if (newLimit !== 10) current.set('limit', String(newLimit));
      else current.delete('limit');

      const qs = current.toString();
      const currentQs = searchParams ? searchParams.toString() : '';
      if (qs === currentQs) return;

      const nextPath = qs ? `${pathname || '/products'}?${qs}` : pathname || '/products';
      router.replace(nextPath, { scroll: false });
    },
    [
      searchParams,
      debouncedSearch,
      categoryId,
      status,
      unitOfMeasure,
      sortBy,
      sortOrder,
      page,
      limit,
      pathname,
      router,
    ],
  );

  const syncToUrlRef = React.useRef(syncToUrl);
  syncToUrlRef.current = syncToUrl;

  // Debounce search input by 300ms
  React.useEffect(() => {
    if (isFirstRender.current) {
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      syncToUrlRef.current({ search, page: 1 });
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Mark first render done
  React.useEffect(() => {
    isFirstRender.current = false;
  }, []);

  // Sync external URL navigation (back/forward) to state
  React.useEffect(() => {
    if (!searchParams) return;
    const urlSearch = searchParams.get('search') || '';
    const urlCategory = searchParams.get('categoryId') || undefined;
    const urlStatus = (searchParams.get('status') as ProductStatus) || undefined;
    const urlUom = (searchParams.get('unitOfMeasure') as UnitOfMeasure) || undefined;
    const urlPage = Math.max(1, Number(searchParams.get('page')) || 1);
    const urlLimit = Number(searchParams.get('limit')) || 10;
    const urlSortBy = searchParams.get('sortBy') || 'createdAt';
    const urlSortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

    if (urlSearch !== debouncedSearch) {
      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
    }
    if (urlCategory !== categoryId) setCategoryId(urlCategory);
    if (urlStatus !== status) setStatus(urlStatus);
    if (urlUom !== unitOfMeasure) setUnitOfMeasure(urlUom);
    if (urlPage !== page) setPage(urlPage);
    if (urlLimit !== limit) setLimit(urlLimit);
    if (urlSortBy !== sortBy) setSortBy(urlSortBy);
    if (urlSortOrder !== sortOrder) setSortOrder(urlSortOrder);
  }, [searchParams]);

  // Fetch products query
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useProducts({
    search: debouncedSearch || undefined,
    categoryId,
    status,
    unitOfMeasure,
    sortBy,
    sortOrder,
    page,
    limit,
  });

  const products = response?.data ?? [];
  const total = response?.meta?.total ?? 0;
  const totalPages = response?.meta?.totalPages ?? Math.ceil(Math.max(1, total) / limit);

  // Auto-recovery after deletion: if current page is beyond totalPages, adjust to last valid page
  React.useEffect(() => {
    if (!isLoading && !isError && total > 0 && page > totalPages) {
      const validPage = Math.max(1, totalPages);
      setPage(validPage);
      syncToUrl({ page: validPage });
    }
  }, [isLoading, isError, total, page, totalPages, syncToUrl]);

  // Reset all filters and search
  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCategoryId(undefined);
    setStatus(undefined);
    setUnitOfMeasure(undefined);
    setPage(1);
    syncToUrl({
      search: '',
      categoryId: undefined,
      status: undefined,
      unitOfMeasure: undefined,
      page: 1,
    });
  };

  // Sort change handler
  const handleSort = (field: string) => {
    let nextOrder: SortOrder = 'asc';
    if (sortBy === field) {
      nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(nextOrder);
    setPage(1);
    syncToUrl({ sortBy: field, sortOrder: nextOrder, page: 1 });
  };

  const hasActiveFilters = Boolean(debouncedSearch || categoryId || status || unitOfMeasure);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your organization&apos;s product catalog, units, and categories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreateProduct && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push('/imports?type=PRODUCT')}
                className="w-full sm:w-auto"
                aria-label="Import products from CSV"
              >
                <UploadCloud className="mr-2 h-4 w-4" aria-hidden="true" />
                Import CSV
              </Button>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="w-full sm:w-auto"
                aria-label="Add new product"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <ProductTableToolbar
        search={search}
        onSearchChange={setSearch}
        categoryId={categoryId}
        onCategoryChange={(cat) => {
          setCategoryId(cat);
          setPage(1);
          syncToUrl({ categoryId: cat, page: 1 });
        }}
        status={status}
        onStatusChange={(st) => {
          setStatus(st);
          setPage(1);
          syncToUrl({ status: st, page: 1 });
        }}
        unitOfMeasure={unitOfMeasure}
        onUnitOfMeasureChange={(uom) => {
          setUnitOfMeasure(uom);
          setPage(1);
          syncToUrl({ unitOfMeasure: uom, page: 1 });
        }}
        onReset={handleResetFilters}
      />

      {/* Main Table */}
      <ProductTable
        products={products}
        isLoading={isLoading}
        isError={isError}
        error={error}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onAddNew={canCreateProduct ? () => setIsCreateOpen(true) : undefined}
        onRetry={() => refetch()}
        hasFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        onEdit={
          canUpdateProduct ? (product) => router.push(`/products/${product.id}/edit`) : undefined
        }
        onDelete={canDeleteProduct ? (product) => setProductToDelete(product) : undefined}
      />

      {/* Pagination */}
      {!isLoading && !isError && (total > 0 || page > 1) && (
        <ProductTablePagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={(newPage) => {
            setPage(newPage);
            syncToUrl({ page: newPage });
          }}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
            syncToUrl({ limit: newLimit, page: 1 });
          }}
        />
      )}

      {/* Add Product Modal */}
      <ProductFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Modal */}
      <ProductDeleteDialog
        product={productToDelete}
        open={Boolean(productToDelete)}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        onSuccess={() => {
          setProductToDelete(null);
          refetch();
        }}
      />
    </div>
  );
}

function ProductsPageFallback() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <React.Suspense fallback={<ProductsPageFallback />}>
      <ProductsPageContent />
    </React.Suspense>
  );
}
