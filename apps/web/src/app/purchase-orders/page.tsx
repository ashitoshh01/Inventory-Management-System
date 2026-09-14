'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Skeleton } from '@repo/ui';
import {
  usePurchaseOrders,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  useDeletePurchaseOrder,
} from '../../hooks/use-purchase-orders';
import { usePermissions } from '../../hooks/use-permissions';
import { PurchaseOrderTable } from '../../components/purchase-orders/purchase-order-table';
import { PurchaseOrderTableToolbar } from '../../components/purchase-orders/purchase-order-table-toolbar';
import { PurchaseOrderTablePagination } from '../../components/purchase-orders/purchase-order-table-pagination';
import { ProcurementMetricsCards } from '../../components/purchase-orders/procurement-metrics-cards';
import {
  PurchaseOrderActionDialog,
  type PurchaseOrderActionType,
} from '../../components/purchase-orders/purchase-order-action-dialog';
import type {
  PurchaseOrderDto,
  PurchaseOrderStatus,
  AllowedPurchaseOrderSortField,
  SortOrder,
} from '@repo/types';

function PurchaseOrdersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreatePurchaseOrder } = usePermissions();

  // Parse initial state from URL parameters
  const initialSearch = searchParams?.get('search') || '';
  const initialStatus = (searchParams?.get('status') as PurchaseOrderStatus) || undefined;
  const initialWarehouse = searchParams?.get('warehouseId') || undefined;
  const initialOverdue = searchParams?.get('isOverdue') === 'true' ? true : undefined;
  const initialReceivingState =
    (searchParams?.get('receivingState') as 'OUTSTANDING' | 'RECEIVED') || undefined;
  const initialPage = Math.max(1, Number(searchParams?.get('page')) || 1);
  const initialLimit = [10, 20, 50].includes(Number(searchParams?.get('limit')))
    ? Number(searchParams?.get('limit'))
    : 10;
  const initialSortBy =
    (searchParams?.get('sortBy') as AllowedPurchaseOrderSortField) || 'createdAt';
  const initialSortOrder = (searchParams?.get('sortOrder') as SortOrder) || 'desc';

  // State
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<PurchaseOrderStatus | undefined>(initialStatus);
  const [warehouseId, setWarehouseId] = React.useState<string | undefined>(initialWarehouse);
  const [isOverdue, setIsOverdue] = React.useState<boolean | undefined>(initialOverdue);
  const [receivingState, setReceivingState] = React.useState<
    'OUTSTANDING' | 'RECEIVED' | undefined
  >(initialReceivingState);
  const [sortBy, setSortBy] = React.useState<AllowedPurchaseOrderSortField>(initialSortBy);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(initialSortOrder);
  const [page, setPage] = React.useState<number>(initialPage);
  const [limit, setLimit] = React.useState<number>(initialLimit);

  // Track whether initial mount has completed to avoid redundant URL updates
  const isFirstRender = React.useRef(true);

  // Sync to URL
  const syncToUrl = React.useCallback(
    (updates: {
      search?: string;
      status?: PurchaseOrderStatus | undefined;
      warehouseId?: string | undefined;
      isOverdue?: boolean | undefined;
      receivingState?: 'OUTSTANDING' | 'RECEIVED' | undefined;
      sortBy?: AllowedPurchaseOrderSortField;
      sortOrder?: SortOrder;
      page?: number;
      limit?: number;
    }) => {
      const current = searchParams
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

      const newSearch = updates.search !== undefined ? updates.search : debouncedSearch;
      const newStatus = updates.status !== undefined ? updates.status : status;
      const newWh = updates.warehouseId !== undefined ? updates.warehouseId : warehouseId;
      const newOverdue = updates.isOverdue !== undefined ? updates.isOverdue : isOverdue;
      const newRecState =
        updates.receivingState !== undefined ? updates.receivingState : receivingState;
      const newSortBy = updates.sortBy !== undefined ? updates.sortBy : sortBy;
      const newSortOrder = updates.sortOrder !== undefined ? updates.sortOrder : sortOrder;
      const newPage = updates.page !== undefined ? updates.page : page;
      const newLimit = updates.limit !== undefined ? updates.limit : limit;

      if (newSearch) current.set('search', newSearch);
      else current.delete('search');

      if (newStatus) current.set('status', newStatus);
      else current.delete('status');

      if (newWh) current.set('warehouseId', newWh);
      else current.delete('warehouseId');

      if (newOverdue) current.set('isOverdue', 'true');
      else current.delete('isOverdue');

      if (newRecState) current.set('receivingState', newRecState);
      else current.delete('receivingState');

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
      warehouseId,
      isOverdue,
      receivingState,
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
      ...(debouncedSearch ? { purchaseOrderNumber: debouncedSearch } : {}),
      ...(status ? { status } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(isOverdue !== undefined ? { isOverdue } : {}),
      ...(receivingState ? { receivingState } : {}),
    }),
    [
      page,
      limit,
      sortBy,
      sortOrder,
      debouncedSearch,
      status,
      warehouseId,
      isOverdue,
      receivingState,
    ],
  );

  const { data: response, isLoading, isError, error, refetch } = usePurchaseOrders(queryParams);
  const orders = response?.data || [];
  const meta = response?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? Math.ceil(total / limit);

  // Action Dialog States
  const [actionOrder, setActionOrder] = React.useState<PurchaseOrderDto | null>(null);
  const [actionType, setActionType] = React.useState<PurchaseOrderActionType | null>(null);
  const [isActionOpen, setIsActionOpen] = React.useState(false);

  // Mutation hooks
  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const deleteMutation = useDeletePurchaseOrder();

  const handleOpenAction = (order: PurchaseOrderDto, action: PurchaseOrderActionType) => {
    setActionOrder(order);
    setActionType(action);
    setIsActionOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!actionOrder || !actionType) return;

    try {
      if (actionType === 'submit') {
        await submitMutation.mutateAsync(actionOrder.id);
        toast.success(`Purchase order ${actionOrder.purchaseOrderNumber} submitted for approval.`);
      } else if (actionType === 'approve') {
        await approveMutation.mutateAsync(actionOrder.id);
        toast.success(`Purchase order ${actionOrder.purchaseOrderNumber} approved.`);
      } else if (actionType === 'cancel') {
        await cancelMutation.mutateAsync(actionOrder.id);
        toast.success(`Purchase order ${actionOrder.purchaseOrderNumber} cancelled.`);
      } else if (actionType === 'delete') {
        await deleteMutation.mutateAsync(actionOrder.id);
        toast.success(`Purchase order ${actionOrder.purchaseOrderNumber} deleted.`);
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

  const handleStatusChange = (newStatus: PurchaseOrderStatus | undefined) => {
    setStatus(newStatus);
    setPage(1);
    syncToUrl({ status: newStatus, page: 1 });
  };

  const handleWarehouseChange = (newWh: string | undefined) => {
    setWarehouseId(newWh);
    setPage(1);
    syncToUrl({ warehouseId: newWh, page: 1 });
  };

  const handleOverdueChange = (newOverdue: boolean | undefined) => {
    setIsOverdue(newOverdue);
    setPage(1);
    syncToUrl({ isOverdue: newOverdue, page: 1 });
  };

  const handleReceivingStateChange = (newState: 'OUTSTANDING' | 'RECEIVED' | undefined) => {
    setReceivingState(newState);
    setPage(1);
    syncToUrl({ receivingState: newState, page: 1 });
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus(undefined);
    setWarehouseId(undefined);
    setIsOverdue(undefined);
    setReceivingState(undefined);
    setPage(1);
    syncToUrl({
      search: '',
      status: undefined,
      warehouseId: undefined,
      isOverdue: undefined,
      receivingState: undefined,
      page: 1,
    });
  };

  const handleSort = (field: string) => {
    const validField = field as AllowedPurchaseOrderSortField;
    let nextOrder: SortOrder = 'asc';
    if (sortBy === validField && sortOrder === 'asc') {
      nextOrder = 'desc';
    }
    setSortBy(validField);
    setSortOrder(nextOrder);
    syncToUrl({ sortBy: validField, sortOrder: nextOrder });
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

  const hasAnyFilter = Boolean(search || status || warehouseId || isOverdue || receivingState);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Purchase Orders & Procurement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage procurement lifecycles, supplier commitments, physical receiving, and inventory
            reconciliation.
          </p>
        </div>
        {canCreatePurchaseOrder && (
          <Link href="/purchase-orders/new">
            <Button size="sm" className="h-9">
              <Plus className="mr-1.5 h-4 w-4" />
              New Purchase Order
            </Button>
          </Link>
        )}
      </div>

      {/* Procurement Overview KPI Cards */}
      <ProcurementMetricsCards />

      {/* Quick View Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm border-b border-border/60">
        <Button
          variant={!status && !isOverdue && !receivingState ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setStatus(undefined);
            setIsOverdue(undefined);
            setReceivingState(undefined);
            setPage(1);
            syncToUrl({
              status: undefined,
              isOverdue: undefined,
              receivingState: undefined,
              page: 1,
            });
          }}
          className="h-8 text-xs font-medium"
        >
          All Orders
        </Button>
        <Button
          variant={status === 'DRAFT' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setStatus('DRAFT');
            setIsOverdue(undefined);
            setReceivingState(undefined);
            setPage(1);
            syncToUrl({
              status: 'DRAFT',
              isOverdue: undefined,
              receivingState: undefined,
              page: 1,
            });
          }}
          className="h-8 text-xs font-medium"
        >
          Drafts
        </Button>
        <Button
          variant={status === 'SUBMITTED' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setStatus('SUBMITTED');
            setIsOverdue(undefined);
            setReceivingState(undefined);
            setPage(1);
            syncToUrl({
              status: 'SUBMITTED',
              isOverdue: undefined,
              receivingState: undefined,
              page: 1,
            });
          }}
          className="h-8 text-xs font-medium"
        >
          Pending Approval
        </Button>
        <Button
          variant={receivingState === 'OUTSTANDING' && !isOverdue ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setStatus(undefined);
            setIsOverdue(undefined);
            setReceivingState('OUTSTANDING');
            setPage(1);
            syncToUrl({
              status: undefined,
              isOverdue: undefined,
              receivingState: 'OUTSTANDING',
              page: 1,
            });
          }}
          className="h-8 text-xs font-medium text-blue-600"
        >
          Ready to Receive
        </Button>
        <Button
          variant={isOverdue ? 'destructive' : 'ghost'}
          size="sm"
          onClick={() => {
            setStatus(undefined);
            setIsOverdue(true);
            setReceivingState(undefined);
            setPage(1);
            syncToUrl({ status: undefined, isOverdue: true, receivingState: undefined, page: 1 });
          }}
          className="h-8 text-xs font-medium"
        >
          Overdue Deliveries
        </Button>
        <Button
          variant={status === 'RECEIVED' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setStatus('RECEIVED');
            setIsOverdue(undefined);
            setReceivingState(undefined);
            setPage(1);
            syncToUrl({
              status: 'RECEIVED',
              isOverdue: undefined,
              receivingState: undefined,
              page: 1,
            });
          }}
          className="h-8 text-xs font-medium text-emerald-600"
        >
          Completed
        </Button>
      </div>

      {/* Filter Toolbar */}
      <PurchaseOrderTableToolbar
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        warehouseId={warehouseId}
        onWarehouseChange={handleWarehouseChange}
        isOverdue={isOverdue}
        onIsOverdueChange={handleOverdueChange}
        receivingState={receivingState}
        onReceivingStateChange={handleReceivingStateChange}
        onReset={handleResetFilters}
      />

      {/* Main Table */}
      <PurchaseOrderTable
        orders={orders}
        isLoading={isLoading}
        isError={isError}
        error={error as Error | null}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onAction={handleOpenAction}
        onAddNew={() => router.push('/purchase-orders/new')}
        onRetry={() => refetch()}
        hasFilters={hasAnyFilter}
        onResetFilters={handleResetFilters}
      />

      {/* Pagination */}
      {!isLoading && !isError && orders.length > 0 && (
        <PurchaseOrderTablePagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Confirmation Action Dialog */}
      <PurchaseOrderActionDialog
        open={isActionOpen}
        onOpenChange={setIsActionOpen}
        order={actionOrder}
        action={actionType}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

function PurchaseOrdersPageFallback() {
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

export default function PurchaseOrdersPage() {
  return (
    <React.Suspense fallback={<PurchaseOrdersPageFallback />}>
      <PurchaseOrdersPageContent />
    </React.Suspense>
  );
}
