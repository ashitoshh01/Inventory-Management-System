'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Boxes } from 'lucide-react';
import { Button, Skeleton } from '@repo/ui';
import { useStockLedger } from '../../../hooks/use-stock';
import { StockLedgerTable } from '../../../components/stock/stock-ledger-table';
import { StockLedgerToolbar } from '../../../components/stock/stock-ledger-toolbar';
import { StockTablePagination } from '../../../components/stock/stock-table-pagination';
import type { SortOrder, AllowedStockLedgerSortField, StockLedgerEntryType } from '@repo/types';

const ALLOWED_SORT_FIELDS: AllowedStockLedgerSortField[] = [
  'createdAt',
  'quantityDelta',
  'quantityBefore',
  'quantityAfter',
  'type',
];

function LedgerPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse initial state from URL search params
  const initialProductId = searchParams?.get('productId') || undefined;
  const initialWarehouseId = searchParams?.get('warehouseId') || undefined;
  const rawType = searchParams?.get('type') || undefined;
  const initialType: StockLedgerEntryType | undefined =
    rawType === 'OPENING' ||
    rawType === 'RECEIPT' ||
    rawType === 'ISSUE' ||
    rawType === 'ADJUSTMENT'
      ? rawType
      : undefined;

  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;

  const rawSortBy = searchParams?.get('sortBy') as AllowedStockLedgerSortField;
  const initialSortBy: AllowedStockLedgerSortField = ALLOWED_SORT_FIELDS.includes(rawSortBy)
    ? rawSortBy
    : 'createdAt';
  const initialSortOrder: SortOrder = searchParams?.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // Filter state
  const [productId, setProductId] = React.useState<string | undefined>(initialProductId);
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>(initialWarehouseId);
  const [type, setType] = React.useState<StockLedgerEntryType | undefined>(initialType);

  // Sorting state
  const [sortBy, setSortBy] = React.useState<AllowedStockLedgerSortField>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialSortOrder);

  // Pagination state
  const [page, setPage] = React.useState<number>(initialPage);
  const [limit, setLimit] = React.useState<number>(initialLimit);

  // Helper to synchronize state to URL search parameters
  const syncToUrl = React.useCallback(
    (updates: {
      productId?: string | undefined;
      warehouseId?: string | undefined;
      type?: StockLedgerEntryType | undefined;
      sortBy?: AllowedStockLedgerSortField;
      sortOrder?: SortOrder;
      page?: number;
      limit?: number;
    }) => {
      const current = searchParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      const newProduct = updates.productId !== undefined ? updates.productId : productId;
      const newWarehouse = updates.warehouseId !== undefined ? updates.warehouseId : warehouseId;
      const newType = updates.type !== undefined ? updates.type : type;
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : sortBy;
      const newSortOrder = updates.sortOrder !== undefined ? updates.sortOrder : sortOrder;
      const newPage = updates.page !== undefined ? updates.page : page;
      const newLimit = updates.limit !== undefined ? updates.limit : limit;

      if (newProduct) current.set('productId', newProduct);
      else current.delete('productId');

      if (newWarehouse) current.set('warehouseId', newWarehouse);
      else current.delete('warehouseId');

      if (newType) current.set('type', newType);
      else current.delete('type');

      if (newSortBy && newSortBy !== 'createdAt') current.set('sortBy', newSortBy);
      else current.delete('sortBy');

      if (newSortOrder && newSortOrder !== 'desc') current.set('sortOrder', newSortOrder);
      else current.delete('sortOrder');

      if (newPage > 1) current.set('page', String(newPage));
      else current.delete('page');

      if (newLimit !== 10) current.set('limit', String(newLimit));
      else current.delete('limit');

      const qs = current.toString();
      const nextPath = qs ? `${pathname || '/stock/ledger'}?${qs}` : pathname || '/stock/ledger';
      router.replace(nextPath, { scroll: false });
    },
    [searchParams, productId, warehouseId, type, sortBy, sortOrder, page, limit, pathname, router],
  );

  // Sync external URL back/forward navigation
  React.useEffect(() => {
    if (!searchParams) return;
    const urlProduct = searchParams.get('productId') || undefined;
    const urlWarehouse = searchParams.get('warehouseId') || undefined;
    const rawUrlType = searchParams.get('type') || undefined;
    const urlType: StockLedgerEntryType | undefined =
      rawUrlType === 'OPENING' ||
      rawUrlType === 'RECEIPT' ||
      rawUrlType === 'ISSUE' ||
      rawUrlType === 'ADJUSTMENT'
        ? rawUrlType
        : undefined;

    const urlPage = Math.max(1, Number(searchParams.get('page')) || 1);
    const urlLimit = Number(searchParams.get('limit')) || 10;
    const rawSort = searchParams.get('sortBy') as AllowedStockLedgerSortField;
    const urlSortBy: AllowedStockLedgerSortField = ALLOWED_SORT_FIELDS.includes(rawSort)
      ? rawSort
      : 'createdAt';
    const urlSortOrder: SortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    if (urlProduct !== productId) setProductId(urlProduct);
    if (urlWarehouse !== warehouseId) setWarehouseId(urlWarehouse);
    if (urlType !== type) setType(urlType);
    if (urlPage !== page) setPage(urlPage);
    if (urlLimit !== limit) setLimit(urlLimit);
    if (urlSortBy !== sortBy) setSortBy(urlSortBy);
    if (urlSortOrder !== sortOrder) setSortOrder(urlSortOrder);
  }, [searchParams]);

  // Fetch paginated ledger entries
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useStockLedger({
    productId,
    warehouseId,
    type,
    sortBy,
    sortOrder,
    page,
    limit,
  });

  const entries = response?.data ?? [];
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
    setType(undefined);
    setPage(1);
    syncToUrl({ productId: undefined, warehouseId: undefined, type: undefined, page: 1 });
  };

  const handleSort = (field: AllowedStockLedgerSortField) => {
    let newOrder: SortOrder = 'asc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Default to desc for timestamp and balance, asc for type
      newOrder = field === 'type' ? 'asc' : 'desc';
    }

    setSortBy(field);
    setSortOrder(newOrder);
    setPage(1);
    syncToUrl({ sortBy: field, sortOrder: newOrder, page: 1 });
  };

  const hasActiveFilters = Boolean(productId || warehouseId || type);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Stock Ledger History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable chronological audit record of all inventory mutations and balance transitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild size="sm" className="w-full sm:w-auto">
            <Link href="/stock">
              <Boxes className="mr-2 h-4 w-4" aria-hidden="true" />
              View Stock Balances
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <StockLedgerToolbar
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
        type={type}
        onTypeChange={(t) => {
          setType(t);
          setPage(1);
          syncToUrl({ type: t, page: 1 });
        }}
        onReset={handleResetFilters}
      />

      {/* Main Stock Ledger Table */}
      <StockLedgerTable
        entries={entries}
        isLoading={isLoading}
        isError={isError}
        error={error}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
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
    </div>
  );
}

function LedgerPageFallback() {
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

export default function StockLedgerPage() {
  return (
    <React.Suspense fallback={<LedgerPageFallback />}>
      <LedgerPageContent />
    </React.Suspense>
  );
}
