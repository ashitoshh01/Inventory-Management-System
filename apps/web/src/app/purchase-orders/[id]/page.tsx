'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Skeleton, Card, CardHeader, CardContent } from '@repo/ui';
import {
  usePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  useDeletePurchaseOrder,
} from '../../../hooks/use-purchase-orders';
import { PurchaseOrderDetailCard } from '../../../components/purchase-orders/purchase-order-detail-card';
import {
  PurchaseOrderActionDialog,
  type PurchaseOrderActionType,
} from '../../../components/purchase-orders/purchase-order-action-dialog';

interface PurchaseOrderDetailPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error, refetch } = usePurchaseOrder(id);
  const order = response?.data;

  // Action Dialog state
  const [actionType, setActionType] = React.useState<PurchaseOrderActionType | null>(null);
  const [isActionOpen, setIsActionOpen] = React.useState(false);

  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const deleteMutation = useDeletePurchaseOrder();

  const handleOpenAction = (action: PurchaseOrderActionType) => {
    setActionType(action);
    setIsActionOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!order || !actionType) return;

    try {
      if (actionType === 'submit') {
        await submitMutation.mutateAsync(order.id);
        toast.success(`Purchase order ${order.purchaseOrderNumber} submitted for approval.`);
      } else if (actionType === 'approve') {
        await approveMutation.mutateAsync(order.id);
        toast.success(`Purchase order ${order.purchaseOrderNumber} approved.`);
      } else if (actionType === 'cancel') {
        await cancelMutation.mutateAsync(order.id);
        toast.success(`Purchase order ${order.purchaseOrderNumber} cancelled.`);
      } else if (actionType === 'delete') {
        await deleteMutation.mutateAsync(order.id);
        toast.success(`Purchase order ${order.purchaseOrderNumber} deleted.`);
        router.push('/purchase-orders');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      toast.error('Action failed', { description: msg });
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-36" />
        <Card className="border border-border">
          <CardHeader className="border-b border-border pb-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="space-y-6">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Purchase Orders
        </Link>
        <div className="flex flex-col items-center justify-center p-12 border rounded-md border-destructive/20 bg-destructive/5 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-foreground">Purchase Order not found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {error?.message ||
              'The requested purchase order could not be found or you do not have permission to view it.'}
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
            <Button onClick={() => router.push('/purchase-orders')}>
              Return to Purchase Orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Purchase Orders
        </Link>
      </div>

      {/* Main Details Card */}
      <PurchaseOrderDetailCard order={order} onAction={handleOpenAction} />

      {/* Confirmation Dialog */}
      <PurchaseOrderActionDialog
        open={isActionOpen}
        onOpenChange={setIsActionOpen}
        order={order}
        action={actionType}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
