'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Skeleton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@repo/ui';
import { useWarehouse, useUpdateWarehouse } from '../../../../hooks/use-warehouses';
import { WarehouseForm } from '../../../../components/warehouses/warehouse-form';
import type { UpdateWarehouseInput } from '@repo/types';

interface EditWarehousePageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function EditWarehousePage({ params }: EditWarehousePageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error } = useWarehouse(id);
  const warehouse = response?.data;
  const updateWarehouse = useUpdateWarehouse();

  const handleSubmit = async (data: UpdateWarehouseInput) => {
    if (!id) return;

    try {
      await updateWarehouse.mutateAsync({ id, input: data });
      toast.success('Warehouse updated', {
        description: 'Warehouse facility details were saved successfully.',
      });
      router.push(`/warehouses/${id}`);
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj.code === 'WAREHOUSE_DUPLICATE_CODE') {
        toast.error('Facility code already in use', {
          description: `The warehouse code "${data.code}" already exists in your organization.`,
        });
      } else if (errorObj.code === 'WAREHOUSE_DUPLICATE_NAME') {
        toast.error('Facility name already in use', {
          description: `A warehouse named "${data.name}" already exists in your organization.`,
        });
      } else {
        const message = err instanceof Error ? err.message : 'Failed to update warehouse';
        toast.error('Failed to update warehouse', {
          description: message,
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-5 w-36" />
        <Card>
          <CardHeader className="border-b border-border pb-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !warehouse) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
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
                  : 'Unable to load warehouse details for editing.'}
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href={`/warehouses/${id}`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Facility Details
      </Link>

      <Card>
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Edit Warehouse</CardTitle>
          <CardDescription>
            Update facility details, address information, and operational status for{' '}
            <span className="font-semibold text-foreground">{warehouse.name}</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <WarehouseForm
            mode="edit"
            initialValues={{
              name: warehouse.name,
              code: warehouse.code,
              description: warehouse.description,
              addressLine1: warehouse.addressLine1,
              addressLine2: warehouse.addressLine2,
              city: warehouse.city,
              state: warehouse.state,
              postalCode: warehouse.postalCode,
              country: warehouse.country,
              status: warehouse.status,
              isDefault: warehouse.isDefault,
            }}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/warehouses/${id}`)}
            isSubmitting={updateWarehouse.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
