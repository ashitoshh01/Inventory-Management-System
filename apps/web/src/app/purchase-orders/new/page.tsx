'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui';
import { useCreatePurchaseOrder } from '../../../hooks/use-purchase-orders';
import { PurchaseOrderForm } from '../../../components/purchase-orders/purchase-order-form';
import type { CreatePurchaseOrderInput } from '@repo/types';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const createPurchaseOrder = useCreatePurchaseOrder();

  const handleSubmit = async (data: CreatePurchaseOrderInput) => {
    // Generate authoritative client idempotency key
    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await createPurchaseOrder.mutateAsync({
        input: data,
        idempotencyKey,
      });

      const order = response.data;
      toast.success('Purchase order created successfully', {
        description: `Order ${order.purchaseOrderNumber} has been drafted.`,
      });

      router.push(`/purchase-orders/${order.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create purchase order';
      toast.error('Failed to create purchase order', {
        description: message,
      });
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Purchase Orders
        </Link>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Create Purchase Order</CardTitle>
          <CardDescription>
            Specify supplier, delivery warehouse, and itemized product lines. Calculations remain
            display previews until committed.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PurchaseOrderForm
            mode="create"
            onSubmit={(data) => handleSubmit(data as CreatePurchaseOrderInput)}
            onCancel={() => router.push('/purchase-orders')}
            isLoading={createPurchaseOrder.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
