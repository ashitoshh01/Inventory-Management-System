'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Skeleton, Card, CardContent } from '@repo/ui';
import {
  useTransfer,
  useApproveTransfer,
  useShipTransfer,
  useReceiveTransfer,
  useCancelTransfer,
  useDeleteTransfer,
} from '../../../hooks/use-transfers';
import { TransferDetailCard } from '../../../components/transfers/transfer-detail-card';
import {
  TransferActionDialog,
  type TransferActionType,
} from '../../../components/transfers/transfer-action-dialog';

interface TransferDetailPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function TransferDetailPage({ params }: TransferDetailPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error, refetch } = useTransfer(id);
  const transfer = response?.data;

  // Action Dialog state
  const [actionType, setActionType] = React.useState<TransferActionType | null>(null);
  const [isActionOpen, setIsActionOpen] = React.useState(false);

  const approveMutation = useApproveTransfer();
  const shipMutation = useShipTransfer();
  const receiveMutation = useReceiveTransfer();
  const cancelMutation = useCancelTransfer();
  const deleteMutation = useDeleteTransfer();

  const handleOpenAction = (action: TransferActionType) => {
    setActionType(action);
    setIsActionOpen(true);
  };

  const handleConfirmAction = async (payload?: { reason?: string | undefined }) => {
    if (!transfer || !actionType) return;

    try {
      if (actionType === 'approve') {
        await approveMutation.mutateAsync(transfer.id);
        toast.success(`Transfer ${transfer.transferNumber} approved.`);
      } else if (actionType === 'ship') {
        const idempotencyKey = crypto.randomUUID();
        await shipMutation.mutateAsync({ id: transfer.id, idempotencyKey });
        toast.success(`Transfer ${transfer.transferNumber} dispatched and in transit.`);
      } else if (actionType === 'receive') {
        const idempotencyKey = crypto.randomUUID();
        await receiveMutation.mutateAsync({ id: transfer.id, idempotencyKey });
        toast.success(`Transfer ${transfer.transferNumber} received at destination warehouse.`);
      } else if (actionType === 'cancel') {
        await cancelMutation.mutateAsync({
          id: transfer.id,
          ...(payload?.reason ? { reason: payload.reason } : {}),
        });
        toast.success(`Transfer ${transfer.transferNumber} cancelled.`);
      } else if (actionType === 'delete') {
        await deleteMutation.mutateAsync(transfer.id);
        toast.success(`Transfer ${transfer.transferNumber} deleted.`);
        router.push('/transfers');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      toast.error('Action failed', { description: msg });
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link
          href="/transfers"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : isError ? (
        <Card className="border-destructive/30 bg-destructive/5 my-4">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load transfer</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              {error?.message || 'The requested stock transfer could not be found or loaded.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : transfer ? (
        <>
          <TransferDetailCard transfer={transfer} onAction={handleOpenAction} />

          <TransferActionDialog
            open={isActionOpen}
            onOpenChange={setIsActionOpen}
            transfer={transfer}
            action={actionType}
            onConfirm={handleConfirmAction}
          />
        </>
      ) : null}
    </div>
  );
}
