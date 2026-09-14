'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Filter, Plus, UploadCloud } from 'lucide-react';
import { useStockBalances } from '../../hooks/use-stock';
import { useDashboardStats } from '../../hooks/use-dashboard';
import { usePermissions } from '../../hooks/use-permissions';
import { useProducts } from '../../hooks/use-products';
import { StockStatsCards } from '../../components/stock/stock-stats-cards';
import { StockTableToolbar, type StockTab } from '../../components/stock/stock-table-toolbar';
import { StockBalanceTable } from '../../components/stock/stock-balance-table';
import { StockTablePagination } from '../../components/stock/stock-table-pagination';
import { StockMutationDialog } from '../../components/stock/stock-mutation-dialog';
import { WarehouseSelector } from '../../components/dashboard/warehouse-selector';
import type {
  StockBalanceDto,
  SortOrder,
  AllowedStockBalanceSortField,
  ProductDto,
} from '@repo/types';

function StockPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateProduct, canMutateStock } = usePermissions();

  // Parse initial state from URL search params
  const initialWarehouseId = searchParams?.get('warehouseId') || undefined;
  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50, 100].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;
  const initialSortBy =
    (searchParams?.get('sortBy') as AllowedStockBalanceSortField) || 'updatedAt';
  const initialSortOrder = (searchParams?.get('sortOrder') as SortOrder) || 'desc';

  // Filter & Search states
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>(initialWarehouseId);
  const [currentTab, setCurrentTab] = React.useState<StockTab>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [categoryId, setCategoryId] = React.useState<string | undefined>();
  const [unit, setUnit] = React.useState<string | undefined>();
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list');

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

  // Helper to synchronize state to URL search parameters
  const syncToUrl = React.useCallback(
    (updates: {
      warehouseId?: string | undefined;
      sortBy?: AllowedStockBalanceSortField;
      sortOrder?: SortOrder;
      page?: number;
      limit?: number;
    }) => {
      const current = searchParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      const newWarehouse = updates.warehouseId !== undefined ? updates.warehouseId : warehouseId;
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : sortBy;
      const newSortOrder = updates.sortOrder !== undefined ? updates.sortOrder : sortOrder;
      const newPage = updates.page !== undefined ? updates.page : page;
      const newLimit = updates.limit !== undefined ? updates.limit : limit;

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
      const currentQs = searchParams ? searchParams.toString() : '';
      if (qs === currentQs) return;

      const nextPath = qs ? `${pathname || '/stock'}?${qs}` : pathname || '/stock';
      router.replace(nextPath, { scroll: false });
    },
    [searchParams, warehouseId, sortBy, sortOrder, page, limit, pathname, router],
  );

  // Sync external URL back/forward navigation
  React.useEffect(() => {
    if (!searchParams) return;
    const urlWarehouse = searchParams.get('warehouseId') || undefined;
    const urlPage = Math.max(1, Number(searchParams.get('page')) || 1);
    const urlLimit = Number(searchParams.get('limit')) || 10;
    const urlSortBy = (searchParams.get('sortBy') as AllowedStockBalanceSortField) || 'updatedAt';
    const urlSortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

    if (urlWarehouse !== warehouseId) setWarehouseId(urlWarehouse);
    if (urlPage !== page) setPage(urlPage);
    if (urlLimit !== limit) setLimit(urlLimit);
    if (urlSortBy !== sortBy) setSortBy(urlSortBy);
    if (urlSortOrder !== sortOrder) setSortOrder(urlSortOrder);
  }, [searchParams]);

  // Fetch live metrics for the 5 summary cards
  const { data: statsResponse, isLoading: statsLoading } = useDashboardStats({
    warehouseId,
  });

  // Fetch balances query
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useStockBalances({
    warehouseId,
    sortBy,
    sortOrder,
    page,
    limit,
  });

  // Load products to filter by name/SKU/category/unit if needed
  const { data: productsResponse } = useProducts({ limit: 100 });
  const productsMap = React.useMemo(() => {
    const map = new Map<string, ProductDto>();
    if (productsResponse?.data) {
      for (const p of productsResponse.data) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [productsResponse]);

  const rawBalances = response?.data ?? [];

  // Filter balances based on current tab, search term, category, and unit
  const filteredBalances = React.useMemo(() => {
    return rawBalances.filter((b) => {
      const product = productsMap.get(b.productId);
      const qtyNum = parseFloat(b.quantity) || 0;

      // Tab filter
      if (currentTab === 'low' && (qtyNum <= 0 || qtyNum > 10)) return false;
      if (currentTab === 'out' && qtyNum > 0) return false;
      if (currentTab === 'expiring' || currentTab === 'transit') {
        // Tab placeholder for advanced domain features
        return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const nameMatch = product?.name.toLowerCase().includes(query);
        const skuMatch = product?.sku.toLowerCase().includes(query);
        const idMatch = b.productId.toLowerCase().includes(query);
        if (!nameMatch && !skuMatch && !idMatch) return false;
      }

      // Category filter
      if (categoryId && product?.categoryId !== categoryId) return false;

      // Unit filter
      if (unit && product?.unitOfMeasure !== unit) return false;

      return true;
    });
  }, [rawBalances, productsMap, currentTab, searchTerm, categoryId, unit]);

  const total = response?.meta?.total ?? 0;
  const totalPages = response?.meta?.totalPages ?? Math.ceil(Math.max(1, total) / limit);

  const handleWarehouseChange = (wId?: string) => {
    setWarehouseId(wId);
    setPage(1);
    syncToUrl({ warehouseId: wId, page: 1 });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategoryId(undefined);
    setUnit(undefined);
    setCurrentTab('all');
    setWarehouseId(undefined);
    setPage(1);
    syncToUrl({ warehouseId: undefined, page: 1 });
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

  const hasActiveFilters = Boolean(
    searchTerm || categoryId || unit || warehouseId || currentTab !== 'all',
  );

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Inventory / Stock Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage all your inventory items across warehouses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Warehouse Selector */}
          <WarehouseSelector value={warehouseId} onChange={handleWarehouseChange} allowAll />

          {/* Filters Button */}
          <button
            type="button"
            onClick={() => handleResetFilters()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Filter className="h-4 w-4 text-slate-500" />
            <span>Filters</span>
          </button>

          {/* Import Stock Button */}
          {canMutateStock && (
            <Link
              href="/imports?type=STOCK"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <UploadCloud className="h-4 w-4 text-slate-500" />
              <span>Import Stock</span>
            </Link>
          )}

          {/* + Add Product Button */}
          {canCreateProduct && (
            <Link
              href="/products/new"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. 5 Summary Metric Cards */}
      <StockStatsCards stats={statsResponse?.data} isLoading={statsLoading} currencySymbol="$" />

      {/* 3. Main White Card containing Tabs, Toolbar, Table, and Pagination */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="p-6 pb-2">
          <StockTableToolbar
            currentTab={currentTab}
            onTabChange={(t) => {
              setCurrentTab(t);
              setPage(1);
            }}
            searchTerm={searchTerm}
            onSearchChange={(s) => {
              setSearchTerm(s);
              setPage(1);
            }}
            categoryId={categoryId}
            onCategoryChange={(c) => {
              setCategoryId(c);
              setPage(1);
            }}
            unit={unit}
            onUnitChange={(u) => {
              setUnit(u);
              setPage(1);
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onExport={() => {
              // Export CSV of visible balances
              const csvContent =
                'data:text/csv;charset=utf-8,' +
                ['Product,SKU,Warehouse,Stock,UpdatedAt']
                  .concat(
                    filteredBalances.map((b) => {
                      const p = productsMap.get(b.productId);
                      return `"${p?.name || b.productId}","${p?.sku || ''}","${b.warehouseId}","${b.quantity}","${b.updatedAt}"`;
                    }),
                  )
                  .join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', 'inventory_export.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          />
        </div>

        {/* Stock Balance Table */}
        <StockBalanceTable
          balances={filteredBalances}
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
          currencySymbol="$"
        />

        {/* Pagination */}
        {!isLoading && !isError && total > 0 && (
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
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
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
