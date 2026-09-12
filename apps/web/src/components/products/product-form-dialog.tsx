'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@repo/ui';
import { ProductForm } from './product-form';
import { useCreateProduct } from '../../hooks/use-products';
import type { CreateProductInput } from '@repo/types';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProductFormDialog({ open, onOpenChange, onSuccess }: ProductFormDialogProps) {
  const createProduct = useCreateProduct();

  const handleSubmit = async (data: CreateProductInput) => {
    try {
      await createProduct.mutateAsync(data);
      toast.success('Product created successfully', {
        description: `${data.name} (${data.sku}) has been added to the catalog.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create product';
      toast.error('Failed to create product', {
        description: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Enter the details below to add a new product to your organization catalog.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <ProductForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={createProduct.isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
