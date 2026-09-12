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
import { useDeleteWarehouse } from '../../hooks/use-warehouses';
import type { WarehouseDto } from '@repo/types';

interface WarehouseDeleteDialogProps {
  warehouse: WarehouseDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WarehouseDeleteDialog({
  warehouse,
  open,
  onOpenChange,
  onSuccess,
}: WarehouseDeleteDialogProps) {
  const deleteWarehouse = useDeleteWarehouse();

  if (!warehouse) return null;

  const handleDelete = async () => {
    try {
      await deleteWarehouse.mutateAsync(warehouse.id);
      toast.success('Warehouse deleted', {
        description: `${warehouse.name} (${warehouse.code}) was successfully removed.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (
        errorObj.code === 'WAREHOUSE_DELETE_CONFLICT' ||
        errorObj.message?.toLowerCase().includes('default')
      ) {
        toast.error('Unable to delete default warehouse', {
          description:
            'Cannot delete the default warehouse. Designate another warehouse as default first.',
        });
      } else {
        const message = err instanceof Error ? err.message : 'Failed to delete warehouse';
        toast.error('Failed to delete warehouse', {
          description: message,
        });
      }
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
              <DialogTitle>Delete Warehouse</DialogTitle>
              <DialogDescription className="mt-1">
                Are you sure you want to delete this warehouse?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3">
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="font-semibold text-foreground">{warehouse.name}</div>
            <div className="font-mono text-xs text-muted-foreground mt-0.5">
              Code: {warehouse.code}
            </div>
            {warehouse.isDefault && (
              <div className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                ⚠️ Warning: This warehouse is currently designated as the default warehouse.
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This action will permanently delete this warehouse location from your organization. This
            action cannot be undone.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteWarehouse.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteWarehouse.isPending}
          >
            {deleteWarehouse.isPending ? 'Deleting...' : 'Delete Warehouse'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
