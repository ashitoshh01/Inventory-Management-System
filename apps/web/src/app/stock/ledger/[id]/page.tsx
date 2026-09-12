'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button, Skeleton, Card, CardHeader, CardContent } from '@repo/ui';
import { useStockLedgerEntry } from '../../../../hooks/use-stock';
import { StockLedgerDetailCard } from '../../../../components/stock/stock-ledger-detail-card';

interface StockLedgerDetailPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function StockLedgerDetailPage({ params }: StockLedgerDetailPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error } = useStockLedgerEntry(id);
  const entry = response?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-40" />
        </div>
        <Card>
          <CardHeader className="border-b border-border pb-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-28 w-full rounded-md" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !entry) {
    return (
      <div className="space-y-6">
        <Link
          href="/stock/ledger"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Stock Ledger History
        </Link>
        <div className="flex flex-col items-center justify-center p-12 border rounded-md border-destructive/20 bg-destructive/5 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-foreground">Stock ledger entry not found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {error instanceof Error
              ? error.message
              : 'The requested immutable stock ledger record could not be found or you do not have permission to view it.'}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => router.push('/stock/ledger')}>
            Return to Stock Ledger History
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StockLedgerDetailCard entry={entry} />
    </div>
  );
}
