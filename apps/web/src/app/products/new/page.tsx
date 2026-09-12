'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui';
import { useCreateProduct } from '../../../hooks/use-products';
import { ProductForm } from '../../../components/products/product-form';
import type { CreateProductInput } from '@repo/types';

export default function NewProductPage() {
  const router = useRouter();
  const createProduct = useCreateProduct();

  const handleSubmit = async (data: CreateProductInput) => {
    try {
      const result = await createProduct.mutateAsync(data);
      toast.success('Product created successfully', {
        description: `${data.name} (${data.sku}) has been added to the catalog.`,
      });
      if (result?.data?.id) {
        router.push(`/products/${result.data.id}`);
      } else {
        router.push('/products');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create product';
      toast.error('Failed to create product', {
        description: message,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Top Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/products"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Link>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Create New Product</CardTitle>
          <CardDescription>
            Add a new product to your organization catalog with full inventory tracking properties.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ProductForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={() => router.push('/products')}
            isSubmitting={createProduct.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
