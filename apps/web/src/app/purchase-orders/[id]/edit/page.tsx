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
import { usePurchaseOrder, useUpdatePurchaseOrder } from '../../../../hooks/use-purchase-orders';
import { PurchaseOrderForm } from '../../../../components/purchase-orders/purchase-order-form';
import type { UpdatePurchaseOrderInput } from '@repo/types';

interface PurchaseOrderEditPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function PurchaseOrderEditPage({ params }: PurchaseOrderEditPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error } = usePurchaseOrder(id);
  const order = response?.data;
  const updateMutation = useUpdatePurchaseOrder();

  const handleSubmit = async (data: UpdatePurchaseOrderInput) => {
    try {
      await updateMutation.mutateAsync({
        id,
        input: data,
      });

      toast.success('Purchase order updated', {
        description: `Order ${order?.purchaseOrderNumber} was successfully updated.`,
      });

      router.push(`/purchase-orders/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update purchase order';
      toast.error('Failed to update purchase order', {
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
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
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
          <h3 className="text-lg font-semibold text-foreground">Purchase order not found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {error?.message || 'The purchase order could not be located.'}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push('/purchase-orders')}
          >
            Return to Purchase Orders
          </Button>
        </div>
      </div>
    );
  }

  // DRAFT Guard: Non-DRAFT orders are immutable
  if (order.status !== 'DRAFT') {
    return (
      <div className="space-y-6">
        <Link
          href={`/purchase-orders/${order.id}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Order Details
        </Link>

        <div className="flex flex-col items-center justify-center p-12 border rounded-md border-amber-500/20 bg-amber-500/5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Order cannot be edited</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Purchase order{' '}
            <span className="font-mono font-bold text-foreground">{order.purchaseOrderNumber}</span>{' '}
            is currently in <span className="font-semibold text-foreground">{order.status}</span>{' '}
            status. Only DRAFT purchase orders may be modified.
          </p>
          <Button className="mt-6" onClick={() => router.push(`/purchase-orders/${order.id}`)}>
            View Order Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/purchase-orders/${order.id}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Order Details
        </Link>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Edit Purchase Order: <span className="font-mono">{order.purchaseOrderNumber}</span>
          </CardTitle>
          <CardDescription>
            Update destination warehouse, supplier details, or order lines. Only DRAFT purchase
            orders may be edited.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PurchaseOrderForm
            mode="edit"
            initialOrder={order}
            onSubmit={(data) => handleSubmit(data as UpdatePurchaseOrderInput)}
            onCancel={() => router.push(`/purchase-orders/${order.id}`)}
            isLoading={updateMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
