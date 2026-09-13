'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Send, Trash2, XCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@repo/ui';
import type { PurchaseOrderDto } from '@repo/types';

export type PurchaseOrderActionType = 'submit' | 'approve' | 'cancel' | 'delete';

interface PurchaseOrderActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrderDto | null;
  action: PurchaseOrderActionType | null;
  onConfirm: () => Promise<void>;
}

export function PurchaseOrderActionDialog({
  open,
  onOpenChange,
  order,
  action,
  onConfirm,
}: PurchaseOrderActionDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [open]);

  if (!order || !action) return null;

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await onConfirm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while performing the action.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionConfig = () => {
    switch (action) {
      case 'submit':
        return {
          title: 'Submit Purchase Order',
          description: `Are you sure you want to submit purchase order "${order.purchaseOrderNumber}"? This will transition it from DRAFT to SUBMITTED for approval. Order lines will no longer be editable.`,
          confirmLabel: 'Submit Order',
          confirmVariant: 'default' as const,
          icon: Send,
          iconColor: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50',
        };
      case 'approve':
        return {
          title: 'Approve Purchase Order',
          description: `Are you sure you want to approve purchase order "${order.purchaseOrderNumber}"? This confirms authorization for the supplier to fulfill the order.`,
          confirmLabel: 'Approve Order',
          confirmVariant: 'default' as const,
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50',
        };
      case 'cancel':
        return {
          title: 'Cancel Purchase Order',
          description: `Are you sure you want to cancel purchase order "${order.purchaseOrderNumber}"? This transition is terminal; cancelled orders cannot be reopened or fulfilled.`,
          confirmLabel: 'Cancel Order',
          confirmVariant: 'destructive' as const,
          icon: XCircle,
          iconColor: 'text-destructive bg-destructive/10',
        };
      case 'delete':
        return {
          title: 'Delete Draft Purchase Order',
          description: `Are you sure you want to permanently delete purchase order "${order.purchaseOrderNumber}"? This will remove the draft order and all child line items. Only DRAFT purchase orders can be deleted.`,
          confirmLabel: 'Delete Order',
          confirmVariant: 'destructive' as const,
          icon: Trash2,
          iconColor: 'text-destructive bg-destructive/10',
        };
    }
  };

  const config = getActionConfig();
  const IconComponent = config.icon;

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${config.iconColor}`}
            >
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{config.title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Current status:{' '}
                <span className="font-semibold text-foreground">{order.status}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-sm text-muted-foreground">{config.description}</div>

        {errorMessage && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              config.confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
