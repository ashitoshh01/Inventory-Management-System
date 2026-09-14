'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Skeleton } from '@repo/ui';
import {
  useTransfers,
  useApproveTransfer,
  useShipTransfer,
  useReceiveTransfer,
  useCancelTransfer,
  useDeleteTransfer,
} from '../../hooks/use-transfers';
import { usePermissions } from '../../hooks/use-permissions';
import { TransferTable } from '../../components/transfers/transfer-table';
import { TransferTableToolbar } from '../../components/transfers/transfer-table-toolbar';
import { TransferTablePagination } from '../../components/transfers/transfer-table-pagination';
import { TransferMetricsCards } from '../../components/transfers/transfer-metrics-cards';
import {
  TransferActionDialog,
  type TransferActionType,
} from '../../components/transfers/transfer-action-dialog';
import type {
  StockTransferDto,
  StockTransferStatus,
  AllowedStockTransferSortField,
  SortOrder,
} from '@repo/types';

function TransfersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateTransfer } = usePermissions();

  // Parse initial state from URL parameters
  const initialSearch = searchParams?.get('search') || '';
  const initialStatus = (searchParams?.get('status') as StockTransferStatus) || undefined;
  const initialSourceWh = searchParams?.get('sourceWarehouseId') || undefined;
  const initialDestWh = searchParams?.get('destinationWarehouseId') || undefined;
  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;
  const initialSortBy =
    (searchParams?.get('sortBy') as AllowedStockTransferSortField) || 'createdAt';
  const initialSortOrder = (searchParams?.get('sortOrder') as SortOrder) || 'desc';

  // State
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<StockTransferStatus | undefined>(initialStatus);
  const [sourceWarehouseId, setSourceWarehouseId] = React.useState<string | undefined>(
    initialSourceWh,
  );
  const [destinationWarehouseId, setDestinationWarehouseId] = React.useState<string | undefined>(
    initialDestWh,
  );
  const [sortBy, setSortBy] = React.useState<AllowedStockTransferSortField>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialSortOrder);
  const [page, setPage] = React.useState<number>(initialPage);
  const [limit, setLimit] = React.useState<number>(initialLimit);

  // Track whether initial mount has completed to avoid redundant URL updates
  const isFirstRender = React.useRef(true);

  // Sync to URL
  const syncToUrl = React.useCallback(
    (updates: {
      search?: string;
      status?: StockTransferStatus | undefined;
      sourceWarehouseId?: string | undefined;
      destinationWarehouseId?: string | undefined;
      sortBy?: AllowedStockTransferSortField;
      sortOrder?: SortOrder;
      page?: number;
      limit?: number;
    }) => {
      const current = searchParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      const newSearch = updates.search !== undefined ? updates.search : debouncedSearch;
      const newStatus = updates.status !== undefined ? updates.status : status;
      const newSrcWh =
        updates.sourceWarehouseId !== undefined ? updates.sourceWarehouseId : sourceWarehouseId;
      const newDestWh =
        updates.destinationWarehouseId !== undefined
          ? updates.destinationWarehouseId
          : destinationWarehouseId;
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : sortBy;
      const newSortOrder = updates.sortOrder !== undefined ? updates.sortOrder : sortOrder;
      const newPage = updates.page !== undefined ? updates.page : page;
      const newLimit = updates.limit !== undefined ? updates.limit : limit;

      if (newSearch) current.set('search', newSearch);
      else current.delete('search');

      if (newStatus) current.set('status', newStatus);
      else current.delete('status');

      if (newSrcWh) current.set('sourceWarehouseId', newSrcWh);
      else current.delete('sourceWarehouseId');

      if (newDestWh) current.set('destinationWarehouseId', newDestWh);
      else current.delete('destinationWarehouseId');

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

      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [
      searchParams,
      debouncedSearch,
      status,
      sourceWarehouseId,
      destinationWarehouseId,
      sortBy,
      sortOrder,
      page,
      limit,
      router,
      pathname,
    ],
  );

  const syncToUrlRef = React.useRef(syncToUrl);
  syncToUrlRef.current = syncToUrl;

  // Debounce search input
  React.useEffect(() => {
    if (isFirstRender.current) {
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      syncToUrlRef.current({ search, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    isFirstRender.current = false;
  }, []);

  // Fetch query
  const queryParams = React.useMemo(
    () => ({
      page,
      limit,
      sortBy,
      sortOrder,
      ...(debouncedSearch ? { transferNumber: debouncedSearch } : {}),
      ...(status ? { status } : {}),
      ...(sourceWarehouseId ? { sourceWarehouseId } : {}),
      ...(destinationWarehouseId ? { destinationWarehouseId } : {}),
    }),
    [
      page,
      limit,
      sortBy,
      sortOrder,
      debouncedSearch,
      status,
      sourceWarehouseId,
      destinationWarehouseId,
    ],
  );

  const { data: response, isLoading, isError, error, refetch } = useTransfers(queryParams);
  const transfers = response?.data || [];
  const meta = response?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? Math.ceil(total / limit);

  // Action Dialog States
  const [actionTransfer, setActionTransfer] = React.useState<StockTransferDto | null>(null);
  const [actionType, setActionType] = React.useState<TransferActionType | null>(null);
  const [isActionOpen, setIsActionOpen] = React.useState(false);

  // Mutation hooks
  const approveMutation = useApproveTransfer();
  const shipMutation = useShipTransfer();
  const receiveMutation = useReceiveTransfer();
  const cancelMutation = useCancelTransfer();
  const deleteMutation = useDeleteTransfer();

  const handleOpenAction = (transfer: StockTransferDto, action: TransferActionType) => {
    setActionTransfer(transfer);
    setActionType(action);
    setIsActionOpen(true);
  };

  const handleConfirmAction = async (payload?: { reason?: string | undefined }) => {
    if (!actionTransfer || !actionType) return;

    try {
      if (actionType === 'approve') {
        await approveMutation.mutateAsync(actionTransfer.id);
        toast.success(`Transfer ${actionTransfer.transferNumber} approved.`);
      } else if (actionType === 'ship') {
        const idempotencyKey = crypto.randomUUID();
        await shipMutation.mutateAsync({ id: actionTransfer.id, idempotencyKey });
        toast.success(`Transfer ${actionTransfer.transferNumber} dispatched and in transit.`);
      } else if (actionType === 'receive') {
        const idempotencyKey = crypto.randomUUID();
        await receiveMutation.mutateAsync({ id: actionTransfer.id, idempotencyKey });
        toast.success(
          `Transfer ${actionTransfer.transferNumber} received at destination warehouse.`,
        );
      } else if (actionType === 'cancel') {
        await cancelMutation.mutateAsync({
          id: actionTransfer.id,
          ...(payload?.reason ? { reason: payload.reason } : {}),
        });
        toast.success(`Transfer ${actionTransfer.transferNumber} cancelled.`);
      } else if (actionType === 'delete') {
        await deleteMutation.mutateAsync(actionTransfer.id);
        toast.success(`Transfer ${actionTransfer.transferNumber} deleted.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      toast.error('Action failed', { description: msg });
      throw err;
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (newStatus: StockTransferStatus | undefined) => {
    setStatus(newStatus);
    setPage(1);
    syncToUrl({ status: newStatus, page: 1 });
  };

  const handleSourceWarehouseChange = (newWh: string | undefined) => {
    setSourceWarehouseId(newWh);
    setPage(1);
    syncToUrl({ sourceWarehouseId: newWh, page: 1 });
  };

  const handleDestinationWarehouseChange = (newWh: string | undefined) => {
    setDestinationWarehouseId(newWh);
    setPage(1);
    syncToUrl({ destinationWarehouseId: newWh, page: 1 });
  };

  const handleSort = (field: AllowedStockTransferSortField) => {
    let newOrder: SortOrder = 'asc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(newOrder);
    syncToUrl({ sortBy: field, sortOrder: newOrder });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    syncToUrl({ page: newPage });
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    syncToUrl({ limit: newLimit, page: 1 });
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus(undefined);
    setSourceWarehouseId(undefined);
    setDestinationWarehouseId(undefined);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  const hasFilters = Boolean(
    debouncedSearch || status || sourceWarehouseId || destinationWarehouseId,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock Transfers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage inter-warehouse inventory transfers, shipments, and custody receipts.
          </p>
        </div>
        {canCreateTransfer && (
          <Button asChild className="gap-2">
            <Link href="/transfers/new">
              <Plus className="h-4 w-4" />
              New Transfer
            </Link>
          </Button>
        )}
      </div>

      {/* Metrics Cards */}
      <TransferMetricsCards />

      {/* Toolbar & Filters */}
      <TransferTableToolbar
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        sourceWarehouseId={sourceWarehouseId}
        onSourceWarehouseChange={handleSourceWarehouseChange}
        destinationWarehouseId={destinationWarehouseId}
        onDestinationWarehouseChange={handleDestinationWarehouseChange}
        onReset={handleResetFilters}
      />

      {/* Data Table */}
      <TransferTable
        transfers={transfers}
        isLoading={isLoading}
        isError={isError}
        error={error as Error}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onAction={handleOpenAction}
        onAddNew={() => router.push('/transfers/new')}
        onRetry={() => refetch()}
        hasFilters={hasFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Pagination */}
      {!isLoading && !isError && total > 0 && (
        <TransferTablePagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Confirmation Action Dialog */}
      <TransferActionDialog
        open={isActionOpen}
        onOpenChange={setIsActionOpen}
        transfer={actionTransfer}
        action={actionType}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

export default function TransfersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      }
    >
      <TransfersPageContent />
    </React.Suspense>
  );
}
