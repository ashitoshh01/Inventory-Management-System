'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button, Skeleton, Card, CardHeader, CardContent } from '@repo/ui';
import { useProduct } from '../../../hooks/use-products';
import { ProductDetailCard } from '../../../components/products/product-detail-card';
import { ProductDeleteDialog } from '../../../components/products/product-delete-dialog';
import type { ProductDto } from '@repo/types';

interface ProductDetailPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');

  const { data: response, isLoading, isError, error } = useProduct(id);
  const product = response?.data;

  const [productToDelete, setProductToDelete] = React.useState<ProductDto | null>(null);

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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-28 w-full rounded-lg" />
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
            {error?.message ||
              'The requested product could not be located or you do not have permission to view it.'}
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
      <ProductDetailCard
        product={product}
        onEdit={() => router.push(`/products/${product.id}/edit`)}
        onDelete={() => setProductToDelete(product)}
      />

      <ProductDeleteDialog
        product={productToDelete}
        open={Boolean(productToDelete)}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        onSuccess={() => {
          setProductToDelete(null);
          router.push('/products');
        }}
      />
    </div>
  );
}
