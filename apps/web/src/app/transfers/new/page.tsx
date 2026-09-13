'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui';
import { useCreateTransfer } from '../../../hooks/use-transfers';
import { TransferForm } from '../../../components/transfers/transfer-form';
import type { CreateStockTransferInput } from '@repo/types';

export default function NewStockTransferPage() {
  const router = useRouter();
  const createTransfer = useCreateTransfer();

  const handleSubmit = async (data: unknown) => {
    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await createTransfer.mutateAsync({
        input: data as CreateStockTransferInput,
        idempotencyKey,
      });

      const transfer = response.data;
      toast.success('Stock transfer created successfully', {
        description: `Transfer ${transfer.transferNumber} has been drafted.`,
      });

      router.push(`/transfers/${transfer.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create stock transfer';
      toast.error('Failed to create stock transfer', {
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
          href="/transfers"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Link>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Create Stock Transfer</CardTitle>
          <CardDescription>
            Allocate inventory from a source warehouse to an authorized destination warehouse.
            Transfers remain in DRAFT status until approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TransferForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={() => router.push('/transfers')}
            isLoading={createTransfer.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
