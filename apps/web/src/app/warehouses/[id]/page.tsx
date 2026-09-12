'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button, Skeleton, Card, CardHeader, CardContent } from '@repo/ui';
import { useWarehouse } from '../../../hooks/use-warehouses';
import { usePermissions } from '../../../hooks/use-permissions';
import { WarehouseDetailCard } from '../../../components/warehouses/warehouse-detail-card';
import { WarehouseDeleteDialog } from '../../../components/warehouses/warehouse-delete-dialog';
import type { WarehouseDto } from '@repo/types';

interface WarehouseDetailPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function WarehouseDetailPage({ params }: WarehouseDetailPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { canUpdateWarehouse, canDeleteWarehouse } = usePermissions();
  const { data: response, isLoading, isError, error } = useWarehouse(id);
  const warehouse = response?.data;

  const [warehouseToDelete, setWarehouseToDelete] = React.useState<WarehouseDto | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-36" />
        </div>
        <Card>
          <CardHeader className="border-b border-border pb-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-28 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !warehouse) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Link
          href="/warehouses"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Warehouses
        </Link>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-12 space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">Warehouse Not Found</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                {error instanceof Error
                  ? error.message
                  : "The warehouse you requested does not exist or you don't have permission to view it."}
              </p>
            </div>
            <Button onClick={() => router.push('/warehouses')} variant="outline">
              Return to Warehouses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <WarehouseDetailCard
        warehouse={warehouse}
        onEdit={() => router.push(`/warehouses/${warehouse.id}/edit`)}
        onDelete={() => setWarehouseToDelete(warehouse)}
        canUpdate={canUpdateWarehouse}
        canDelete={canDeleteWarehouse}
      />

      <WarehouseDeleteDialog
        warehouse={warehouseToDelete}
        open={!!warehouseToDelete}
        onOpenChange={(open) => {
          if (!open) setWarehouseToDelete(null);
        }}
        onSuccess={() => {
          setWarehouseToDelete(null);
          router.push('/warehouses');
        }}
      />
    </div>
  );
}
