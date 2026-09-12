'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, History } from 'lucide-react';
import { Button, Skeleton } from '@repo/ui';
import { useStockBalances } from '../../hooks/use-stock';
import { usePermissions } from '../../hooks/use-permissions';
import { StockBalanceTable } from '../../components/stock/stock-balance-table';
import { StockTableToolbar } from '../../components/stock/stock-table-toolbar';
import { StockTablePagination } from '../../components/stock/stock-table-pagination';
import { StockMutationDialog } from '../../components/stock/stock-mutation-dialog';
import type { StockBalanceDto, SortOrder, AllowedStockBalanceSortField } from '@repo/types';

function StockPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canMutateStock } = usePermissions();

  // Parse initial state from URL search params
  const initialProductId = searchParams?.get('productId') || undefined;
  const initialWarehouseId = searchParams?.get('warehouseId') || undefined;
  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;
  const initialSortBy =
    (searchParams?.get('sortBy') as AllowedStockBalanceSortField) || 'updatedAt';
  const initialSortOrder = (searchParams?.get('sortOrder') as SortOrder) || 'desc';

  // Filter state
  const [productId, setProductId] = React.useState<string | undefined>(initialProductId);
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>(initialWarehouseId);

  // Sorting state
  const [sortBy, setSortBy] = React.useState<AllowedStockBalanceSortField>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialSortOrder);

  // Pagination state
  const [page, setPage] = React.useState<number>(initialPage);
  const [limit, setLimit] = React.useState<number>(initialLimit);

  // Mutation dialog states
  const [isMutationOpen, setIsMutationOpen] = React.useState(false);
  const [selectedBalanceForMutation, setSelectedBalanceForMutation] =
    React.useState<StockBalanceDto | null>(null);

  const isFirstRender = React.useRef(true);

  // Helper to synchronize state to URL search parameters
  const syncToUrl = React.useCallback(
    (updates: {
      productId?: string | undefined;
      warehouseId?: string | undefined;
      sortBy?: AllowedStockBalanceSortField;
      sortOrder?: SortOrder;
      page?: number;
      limit?: number;
    }) => {
      const current = searchParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      const newProduct = updates.productId !== undefined ? updates.productId : productId;
      const newWarehouse = updates.warehouseId !== undefined ? updates.warehouseId : warehouseId;
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : sortBy;
      const newSortOrder = updates.sortOrder !== undefined ? updates.sortOrder : sortOrder;
      const newPage = updates.page !== undefined ? updates.page : page;
      const newLimit = updates.limit !== undefined ? updates.limit : limit;

      if (newProduct) current.set('productId', newProduct);
      else current.delete('productId');

      if (newWarehouse) current.set('warehouseId', newWarehouse);
      else current.delete('warehouseId');

      if (newSortBy && newSortBy !== 'updatedAt') current.set('sortBy', newSortBy);
      else current.delete('sortBy');

      if (newSortOrder && newSortOrder !== 'desc') current.set('sortOrder', newSortOrder);
      else current.delete('sortOrder');

      if (newPage > 1) current.set('page', String(newPage));
      else current.delete('page');

      if (newLimit !== 10) current.set('limit', String(newLimit));
      else current.delete('limit');

      const qs = current.toString();
      const nextPath = qs ? `${pathname || '/stock'}?${qs}` : pathname || '/stock';
      router.replace(nextPath, { scroll: false });
    },
    [searchParams, productId, warehouseId, sortBy, sortOrder, page, limit, pathname, router],
  );

  // Mark first render complete
  React.useEffect(() => {
    isFirstRender.current = false;
  }, []);

  // Sync external URL back/forward navigation
  React.useEffect(() => {
    if (!searchParams) return;
    const urlProduct = searchParams.get('productId') || undefined;
    const urlWarehouse = searchParams.get('warehouseId') || undefined;
    const urlPage = Math.max(1, Number(searchParams.get('page')) || 1);
    const urlLimit = Number(searchParams.get('limit')) || 10;
    const urlSortBy = (searchParams.get('sortBy') as AllowedStockBalanceSortField) || 'updatedAt';
    const urlSortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

    if (urlProduct !== productId) setProductId(urlProduct);
    if (urlWarehouse !== warehouseId) setWarehouseId(urlWarehouse);
    if (urlPage !== page) setPage(urlPage);
    if (urlLimit !== limit) setLimit(urlLimit);
    if (urlSortBy !== sortBy) setSortBy(urlSortBy);
    if (urlSortOrder !== sortOrder) setSortOrder(urlSortOrder);
  }, [searchParams]);

  // Fetch balances query
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useStockBalances({
    productId,
    warehouseId,
    sortBy,
    sortOrder,
    page,
    limit,
  });

  const balances = response?.data ?? [];
  const total = response?.meta?.total ?? 0;
  const totalPages = response?.meta?.totalPages ?? Math.ceil(Math.max(1, total) / limit);

  // Auto-recovery if page is beyond totalPages
  React.useEffect(() => {
    if (!isLoading && !isError && total > 0 && page > totalPages) {
      const validPage = Math.max(1, totalPages);
      setPage(validPage);
      syncToUrl({ page: validPage });
    }
  }, [isLoading, isError, total, page, totalPages, syncToUrl]);

  const handleResetFilters = () => {
    setProductId(undefined);
    setWarehouseId(undefined);
    setPage(1);
    syncToUrl({
      productId: undefined,
      warehouseId: undefined,
      page: 1,
    });
  };

  const handleSort = (field: AllowedStockBalanceSortField) => {
    let nextOrder: SortOrder = 'asc';
    if (sortBy === field) {
      nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(nextOrder);
    setPage(1);
    syncToUrl({ sortBy: field, sortOrder: nextOrder, page: 1 });
  };

  const handleOpenNewMutation = () => {
    setSelectedBalanceForMutation(null);
    setIsMutationOpen(true);
  };

  const handleOpenSpecificMutation = (balance: StockBalanceDto) => {
    setSelectedBalanceForMutation(balance);
    setIsMutationOpen(true);
  };

  const hasActiveFilters = Boolean(productId || warehouseId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Stock Balances
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authoritative real-time inventory balances across products and warehouses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild size="sm" className="w-full sm:w-auto">
            <Link href="/stock/ledger">
              <History className="mr-2 h-4 w-4" aria-hidden="true" />
              View Ledger History
            </Link>
          </Button>
          {canMutateStock && (
            <Button
              onClick={handleOpenNewMutation}
              size="sm"
              className="w-full sm:w-auto"
              aria-label="Record stock mutation"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
              Record Mutation
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <StockTableToolbar
        productId={productId}
        onProductChange={(pId) => {
          setProductId(pId);
          setPage(1);
          syncToUrl({ productId: pId, page: 1 });
        }}
        warehouseId={warehouseId}
        onWarehouseChange={(wId) => {
          setWarehouseId(wId);
          setPage(1);
          syncToUrl({ warehouseId: wId, page: 1 });
        }}
        onReset={handleResetFilters}
      />

      {/* Main Stock Balances Table */}
      <StockBalanceTable
        balances={balances}
        isLoading={isLoading}
        isError={isError}
        error={error}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onAddNewMutation={canMutateStock ? handleOpenNewMutation : undefined}
        onMutateStock={canMutateStock ? handleOpenSpecificMutation : undefined}
        onRetry={() => refetch()}
        hasFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Pagination */}
      {!isLoading && !isError && (total > 0 || page > 1) && (
        <StockTablePagination
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

      {/* Mutation Dialog */}
      <StockMutationDialog
        open={isMutationOpen}
        onOpenChange={setIsMutationOpen}
        initialProductId={selectedBalanceForMutation?.productId}
        initialWarehouseId={selectedBalanceForMutation?.warehouseId}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

function StockPageFallback() {
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

export default function StockPage() {
  return (
    <React.Suspense fallback={<StockPageFallback />}>
      <StockPageContent />
    </React.Suspense>
  );
}
