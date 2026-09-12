'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button, Skeleton, Card, CardHeader, CardContent } from '@repo/ui';
import { useStockBalance } from '../../../hooks/use-stock';
import { StockDetailCard } from '../../../components/stock/stock-detail-card';
import { StockMutationDialog } from '../../../components/stock/stock-mutation-dialog';

interface StockDetailPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function StockDetailPage({ params }: StockDetailPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error, refetch } = useStockBalance(id);
  const balance = response?.data;

  const [isMutationOpen, setIsMutationOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32" />
        </div>
        <Card>
          <CardHeader className="border-b border-border pb-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !balance) {
    return (
      <div className="space-y-6">
        <Link
          href="/stock"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Stock Balances
        </Link>
        <div className="flex flex-col items-center justify-center p-12 border rounded-md border-destructive/20 bg-destructive/5 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-foreground">Stock balance not found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {error instanceof Error
              ? error.message
              : 'The requested stock balance record could not be found or you do not have permission to view it.'}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => router.push('/stock')}>
            Return to Stock Balances
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StockDetailCard balance={balance} onMutate={() => setIsMutationOpen(true)} />

      <StockMutationDialog
        open={isMutationOpen}
        onOpenChange={setIsMutationOpen}
        initialProductId={balance.productId}
        initialWarehouseId={balance.warehouseId}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
