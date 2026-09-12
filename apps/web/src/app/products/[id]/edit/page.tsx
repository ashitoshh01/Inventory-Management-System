'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Skeleton,
  Button,
} from '@repo/ui';
import { useProduct, useUpdateProduct } from '../../../../hooks/use-products';
import { ProductForm } from '../../../../components/products/product-form';
import type { CreateProductInput } from '@repo/types';

interface ProductEditPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function ProductEditPage({ params }: ProductEditPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error } = useProduct(id);
  const product = response?.data;
  const updateProduct = useUpdateProduct();

  const handleSubmit = async (data: CreateProductInput) => {
    try {
      await updateProduct.mutateAsync({
        id,
        input: {
          name: data.name,
          sku: data.sku,
          categoryId: data.categoryId,
          description: data.description ?? null,
          unitOfMeasure: data.unitOfMeasure,
          status: data.status,
        },
      });

      toast.success('Product updated', {
        description: `${data.name} was successfully updated.`,
      });

      router.push(`/products/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update product';
      toast.error('Failed to update product', {
        description: message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Card>
          <CardHeader className="border-b border-border pb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="space-y-6">
        <Link
          href="/products"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Link>
        <div className="flex flex-col items-center justify-center p-12 border rounded-md border-destructive/20 bg-destructive/5 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-foreground">Product not found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {error?.message || 'The product you are trying to edit could not be found.'}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => router.push('/products')}>
            Return to Products Catalog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground transition-colors">
          Products
        </Link>
        <span>/</span>
        <Link
          href={`/products/${product.id}`}
          className="hover:text-foreground transition-colors truncate max-w-[200px]"
        >
          {product.name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">Edit Product</CardTitle>
          <CardDescription>
            Update product details, category, specifications, and availability status.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ProductForm
            mode="edit"
            initialValues={{
              name: product.name,
              sku: product.sku,
              categoryId: product.categoryId,
              description: product.description,
              unitOfMeasure: product.unitOfMeasure,
              status: product.status,
            }}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/products/${product.id}`)}
            isSubmitting={updateProduct.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
