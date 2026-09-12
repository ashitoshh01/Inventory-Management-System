'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@repo/ui';
import { useDeleteProduct } from '../../hooks/use-products';
import type { ProductDto } from '@repo/types';

interface ProductDeleteDialogProps {
  product: ProductDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProductDeleteDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: ProductDeleteDialogProps) {
  const deleteProduct = useDeleteProduct();

  if (!product) return null;

  const handleDelete = async () => {
    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success('Product deleted', {
        description: `${product.name} (${product.sku}) was successfully removed.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete product';
      toast.error('Failed to delete product', {
        description: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Delete Product</DialogTitle>
              <DialogDescription className="mt-1">
                Are you sure you want to delete this product?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3">
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="font-semibold text-foreground">{product.name}</div>
            <div className="font-mono text-xs text-muted-foreground mt-0.5">SKU: {product.sku}</div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This action will permanently delete this product from your organization catalog. It
            cannot be undone.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteProduct.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProduct.isPending}
          >
            {deleteProduct.isPending ? 'Deleting...' : 'Delete Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
