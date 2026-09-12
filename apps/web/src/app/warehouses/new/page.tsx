'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui';
import { useCreateWarehouse } from '../../../hooks/use-warehouses';
import { WarehouseForm } from '../../../components/warehouses/warehouse-form';
import type { CreateWarehouseInput } from '@repo/types';

export default function NewWarehousePage() {
  const router = useRouter();
  const createWarehouse = useCreateWarehouse();

  const handleSubmit = async (data: CreateWarehouseInput) => {
    try {
      const result = await createWarehouse.mutateAsync(data);
      toast.success('Warehouse created', {
        description: `Successfully created ${result.data.name} (${result.data.code}).`,
      });
      router.push(`/warehouses/${result.data.id}`);
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
        const message = err instanceof Error ? err.message : 'Failed to create warehouse';
        toast.error('Failed to create warehouse', {
          description: message,
        });
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top back navigation */}
      <Link
        href="/warehouses"
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Warehouses
      </Link>

      <Card>
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Create New Warehouse</CardTitle>
          <CardDescription>
            Add a new physical distribution center, facility, or logical storage location to your
            organization.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <WarehouseForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={() => router.push('/warehouses')}
            isSubmitting={createWarehouse.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
