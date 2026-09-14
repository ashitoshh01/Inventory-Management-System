'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, Skeleton } from '@repo/ui';
import { useWarehouses } from '../../hooks/use-warehouses';
import { usePermissions } from '../../hooks/use-permissions';
import { WarehouseTable } from '../../components/warehouses/warehouse-table';
import { WarehouseTableToolbar } from '../../components/warehouses/warehouse-table-toolbar';
import { WarehouseTablePagination } from '../../components/warehouses/warehouse-table-pagination';
import { WarehouseDeleteDialog } from '../../components/warehouses/warehouse-delete-dialog';
import {
  ALLOWED_WAREHOUSE_SORT_FIELDS,
  WAREHOUSE_STATUS_VALUES,
  type WarehouseDto,
  type WarehouseStatus,
  type AllowedWarehouseSortField,
  type SortOrder,
} from '@repo/types';

function WarehousesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateWarehouse, canUpdateWarehouse, canDeleteWarehouse } = usePermissions();

  // Parse initial state from URL parameters with safe validation
  const rawSearch = searchParams?.get('search') || '';
  const rawStatus = searchParams?.get('status') as WarehouseStatus | null;
  const initialStatus =
    rawStatus && WAREHOUSE_STATUS_VALUES.includes(rawStatus) ? rawStatus : undefined;

  const rawSortBy = searchParams?.get('sortBy') as AllowedWarehouseSortField | null;
  const initialSortBy =
    rawSortBy && ALLOWED_WAREHOUSE_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'createdAt';

  const rawSortOrder = searchParams?.get('sortOrder');
  const initialSortOrder: SortOrder =
    rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'desc';

  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;

  // Search & Filter state
  const [search, setSearch] = React.useState(rawSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(rawSearch);
  const [status, setStatus] = React.useState<WarehouseStatus | undefined>(initialStatus);

  // Sorting state
  const [sortBy, setSortBy] = React.useState<AllowedWarehouseSortField>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialSortOrder);

  // Pagination state
  const [page, setPage] = React.useState<number>(initialPage);
  const [limit, setLimit] = React.useState<number>(initialLimit);

  // Deletion modal state
  const [warehouseToDelete, setWarehouseToDelete] = React.useState<WarehouseDto | null>(null);

  // Track initial mount to avoid redundant URL updates
  const isFirstRender = React.useRef(true);

  // Helper to synchronize state to URL search parameters
  const syncToUrl = React.useCallback(
    (updates: {
      search?: string;
      status?: WarehouseStatus | undefined;
      sortBy?: AllowedWarehouseSortField;
      sortOrder?: SortOrder;
      page?: number;
      limit?: number;
    }) => {
      const current = searchParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      const newSearch = updates.search !== undefined ? updates.search : debouncedSearch;
      const newStatus = updates.status !== undefined ? updates.status : status;
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : sortBy;
      const newSortOrder = updates.sortOrder !== undefined ? updates.sortOrder : sortOrder;
      const newPage = updates.page !== undefined ? updates.page : page;
      const newLimit = updates.limit !== undefined ? updates.limit : limit;

      if (newSearch) current.set('search', newSearch);
      else current.delete('search');

      if (newStatus) current.set('status', newStatus);
      else current.delete('status');

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

      const nextPath = qs ? `${pathname || '/warehouses'}?${qs}` : pathname || '/warehouses';
      router.replace(nextPath, { scroll: false });
    },
    [searchParams, debouncedSearch, status, sortBy, sortOrder, page, limit, pathname, router],
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

  // Mark first render completed
  React.useEffect(() => {
    isFirstRender.current = false;
  }, []);

  // Sync external browser URL navigation (back/forward) to local state
  React.useEffect(() => {
    if (!searchParams) return;
    const urlSearch = searchParams.get('search') || '';
    const rawUrlStatus = searchParams.get('status') as WarehouseStatus | null;
    const urlStatus =
      rawUrlStatus && WAREHOUSE_STATUS_VALUES.includes(rawUrlStatus) ? rawUrlStatus : undefined;

    const rawUrlSortBy = searchParams.get('sortBy') as AllowedWarehouseSortField | null;
    const urlSortBy =
      rawUrlSortBy && ALLOWED_WAREHOUSE_SORT_FIELDS.includes(rawUrlSortBy)
        ? rawUrlSortBy
        : 'createdAt';

    const rawUrlSortOrder = searchParams.get('sortOrder');
    const urlSortOrder: SortOrder =
      rawUrlSortOrder === 'asc' || rawUrlSortOrder === 'desc' ? rawUrlSortOrder : 'desc';

    const urlPage = Math.max(1, Number(searchParams.get('page')) || 1);
    const urlLimit = [10, 20, 50].includes(Number(searchParams.get('limit')))
      ? Number(searchParams.get('limit'))
      : 10;

    if (urlSearch !== debouncedSearch) {
      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
    }
    if (urlStatus !== status) setStatus(urlStatus);
    if (urlSortBy !== sortBy) setSortBy(urlSortBy);
    if (urlSortOrder !== sortOrder) setSortOrder(urlSortOrder);
    if (urlPage !== page) setPage(urlPage);
    if (urlLimit !== limit) setLimit(urlLimit);
  }, [searchParams]);

  // Fetch warehouses query with server-side search, filtering, sorting, and pagination
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useWarehouses({
    search: debouncedSearch || undefined,
    status,
    sortBy,
    sortOrder,
    page,
    limit,
  });

  const warehouses = (response?.data ?? []) as WarehouseDto[];
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
    setStatus(undefined);
    setPage(1);
    syncToUrl({
      search: '',
      status: undefined,
      page: 1,
    });
  };

  // Sort change handler
  const handleSort = (field: string) => {
    if (!ALLOWED_WAREHOUSE_SORT_FIELDS.includes(field as AllowedWarehouseSortField)) {
      return;
    }
    const safeField = field as AllowedWarehouseSortField;
    let nextOrder: SortOrder = 'asc';
    if (sortBy === safeField) {
      nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(safeField);
    setSortOrder(nextOrder);
    setPage(1);
    syncToUrl({ sortBy: safeField, sortOrder: nextOrder, page: 1 });
  };

  const hasActiveFilters = Boolean(debouncedSearch || status);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Warehouses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your organization&apos;s physical and logical storage facilities.
          </p>
        </div>

        <div>
          {canCreateWarehouse && (
            <Button
              onClick={() => router.push('/warehouses/new')}
              className="w-full sm:w-auto"
              aria-label="Create new warehouse"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Create Warehouse
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <WarehouseTableToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={(st) => {
          setStatus(st);
          setPage(1);
          syncToUrl({ status: st, page: 1 });
        }}
        onReset={handleResetFilters}
      />

      {/* Main Table */}
      <WarehouseTable
        warehouses={warehouses}
        isLoading={isLoading}
        isError={isError}
        error={error}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onEdit={
          canUpdateWarehouse
            ? (warehouse) => router.push(`/warehouses/${warehouse.id}/edit`)
            : undefined
        }
        onDelete={canDeleteWarehouse ? (warehouse) => setWarehouseToDelete(warehouse) : undefined}
        onCreateNew={canCreateWarehouse ? () => router.push('/warehouses/new') : undefined}
        onRetry={() => refetch()}
        hasFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        canUpdate={canUpdateWarehouse}
        canDelete={canDeleteWarehouse}
      />

      {/* Pagination */}
      {!isLoading && !isError && (total > 0 || page > 1) && (
        <WarehouseTablePagination
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

      {/* Delete Confirmation Dialog */}
      <WarehouseDeleteDialog
        warehouse={warehouseToDelete}
        open={Boolean(warehouseToDelete)}
        onOpenChange={(open) => {
          if (!open) setWarehouseToDelete(null);
        }}
        onSuccess={() => {
          setWarehouseToDelete(null);
          refetch();
        }}
      />
    </div>
  );
}

function WarehousesPageFallback() {
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

export default function WarehousesPage() {
  return (
    <React.Suspense fallback={<WarehousesPageFallback />}>
      <WarehousesPageContent />
    </React.Suspense>
  );
}
