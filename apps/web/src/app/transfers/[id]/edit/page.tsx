'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, AlertCircle, Lock } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Skeleton,
  Button,
} from '@repo/ui';
import { useTransfer, useUpdateTransfer } from '../../../../hooks/use-transfers';
import { TransferForm } from '../../../../components/transfers/transfer-form';
import type { UpdateStockTransferInput } from '@repo/types';

interface TransferEditPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function TransferEditPage({ params }: TransferEditPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error } = useTransfer(id);
  const transfer = response?.data;
  const updateMutation = useUpdateTransfer();

  const handleSubmit = async (data: unknown) => {
    try {
      await updateMutation.mutateAsync({
        id,
        input: data as UpdateStockTransferInput,
      });

      toast.success('Stock transfer updated', {
        description: `Transfer ${transfer?.transferNumber} was successfully updated.`,
      });

      router.push(`/transfers/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update stock transfer';
      toast.error('Failed to update stock transfer', {
        description: message,
      });
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Card className="border border-border">
          <CardHeader className="border-b border-border pb-6">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !transfer) {
    return (
      <div className="space-y-6">
        <Link
          href="/transfers"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Link>
        <div className="flex flex-col items-center justify-center p-12 border rounded-md border-destructive/20 bg-destructive/5 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-foreground">Stock transfer not found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {error?.message || 'The stock transfer could not be located.'}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => router.push('/transfers')}>
            Return to Transfers
          </Button>
        </div>
      </div>
    );
  }

  // DRAFT Guard: Non-DRAFT transfers are immutable
  if (transfer.status !== 'DRAFT') {
    return (
      <div className="space-y-6">
        <Link
          href={`/transfers/${transfer.id}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfer Details
        </Link>

        <div className="flex flex-col items-center justify-center p-12 border rounded-md border-amber-500/20 bg-amber-500/5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Transfer cannot be edited</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Stock transfer{' '}
            <span className="font-mono font-bold text-foreground">{transfer.transferNumber}</span>{' '}
            is currently in <span className="font-semibold text-foreground">{transfer.status}</span>{' '}
            status. Only DRAFT transfers may be modified.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push(`/transfers/${transfer.id}`)}
          >
            View Transfer Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link
          href={`/transfers/${transfer.id}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfer Details
        </Link>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Edit Transfer {transfer.transferNumber}
          </CardTitle>
          <CardDescription>
            Update warehouses, notes, and line items. Changes apply immediately to the draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TransferForm
            mode="edit"
            initialTransfer={transfer}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/transfers/${transfer.id}`)}
            isLoading={updateMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
