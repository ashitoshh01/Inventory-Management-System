'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal, Warehouse } from 'lucide-react';
import { Button, Skeleton, Card, CardHeader, CardTitle, CardDescription } from '@repo/ui';
import { useWarehouseStock } from '../../../../hooks/use-stock';
import { useWarehouse } from '../../../../hooks/use-warehouses';
import { usePermissions } from '../../../../hooks/use-permissions';
import { StockBalanceTable } from '../../../../components/stock/stock-balance-table';
import { StockTablePagination } from '../../../../components/stock/stock-table-pagination';
import { StockMutationDialog } from '../../../../components/stock/stock-mutation-dialog';
import type { StockBalanceDto, SortOrder, AllowedStockBalanceSortField } from '@repo/types';

function WarehouseStockPageContent() {
  const routeParams = useParams<{ warehouseId: string }>();
  const searchParams = useSearchParams();
  const warehouseId = routeParams?.warehouseId || '';

  const { canMutateStock } = usePermissions();

  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;
  const initialSortBy =
    (searchParams?.get('sortBy') as AllowedStockBalanceSortField) || 'updatedAt';
  const initialSortOrder = (searchParams?.get('sortOrder') as SortOrder) || 'desc';

  const [sortBy, setSortBy] = React.useState<AllowedStockBalanceSortField>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialSortOrder);
  const [page, setPage] = React.useState<number>(initialPage);
  const [limit, setLimit] = React.useState<number>(initialLimit);

  const [isMutationOpen, setIsMutationOpen] = React.useState(false);
  const [selectedBalanceForMutation, setSelectedBalanceForMutation] =
    React.useState<StockBalanceDto | null>(null);

  // Fetch warehouse info
  const { data: warehouseResponse } = useWarehouse(warehouseId);
  const warehouse = warehouseResponse?.data;

  // Fetch warehouse balances
  const {
    data: stockResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useWarehouseStock(warehouseId, {
    page,
    limit,
    sortBy,
    sortOrder,
  });

  const balances = stockResponse?.data ?? [];
  const total = stockResponse?.meta?.total ?? 0;
  const totalPages = stockResponse?.meta?.totalPages ?? Math.ceil(Math.max(1, total) / limit);

  const handleSort = (field: AllowedStockBalanceSortField) => {
    let nextOrder: SortOrder = 'asc';
    if (sortBy === field) {
      nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(nextOrder);
    setPage(1);
  };

  const handleOpenNewMutation = () => {
    setSelectedBalanceForMutation(null);
    setIsMutationOpen(true);
  };

  const handleOpenSpecificMutation = (balance: StockBalanceDto) => {
    setSelectedBalanceForMutation(balance);
    setIsMutationOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/stock"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Stock Balances
        </Link>
        {canMutateStock && (
          <Button onClick={handleOpenNewMutation} size="sm">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Record Stock Mutation
          </Button>
        )}
      </div>

      {/* Warehouse Summary Header Card */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Warehouse className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {warehouse?.name || `Warehouse: ${warehouseId}`}
              </CardTitle>
              <CardDescription className="text-xs">
                Code: <span className="font-mono font-medium">{warehouse?.code || '—'}</span>
                {warehouse?.city ? ` • Location: ${warehouse.city}` : ''}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stock Balances for this warehouse */}
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
      />

      {/* Pagination */}
      {!isLoading && !isError && (total > 0 || page > 1) && (
        <StockTablePagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
        />
      )}

      {/* Mutation Dialog */}
      <StockMutationDialog
        open={isMutationOpen}
        onOpenChange={setIsMutationOpen}
        initialProductId={selectedBalanceForMutation?.productId}
        initialWarehouseId={warehouseId}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

function WarehouseStockFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function WarehouseStockPage() {
  return (
    <React.Suspense fallback={<WarehouseStockFallback />}>
      <WarehouseStockPageContent />
    </React.Suspense>
  );
}
