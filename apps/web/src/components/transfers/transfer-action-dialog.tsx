'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Truck,
  Trash2,
  XCircle,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@repo/ui';
import type { StockTransferDto } from '@repo/types';

export type TransferActionType = 'approve' | 'ship' | 'receive' | 'cancel' | 'delete';

interface TransferActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransferDto | null;
  action: TransferActionType | null;
  onConfirm: (payload?: { reason?: string | undefined }) => Promise<void>;
}

export function TransferActionDialog({
  open,
  onOpenChange,
  transfer,
  action,
  onConfirm,
}: TransferActionDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [cancelReason, setCancelReason] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsLoading(false);
      setCancelReason('');
    }
  }, [open]);

  if (!transfer || !action) return null;

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const trimmed = cancelReason.trim();
      await onConfirm(trimmed ? { reason: trimmed } : {});
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
      case 'approve':
        return {
          title: 'Approve Stock Transfer',
          description: `Are you sure you want to approve transfer "${transfer.transferNumber}"? This authorizes warehouse operations to dispatch ${transfer.lines?.length || 0} line item(s) from ${transfer.sourceWarehouse?.name || 'source'} to ${transfer.destinationWarehouse?.name || 'destination'}.`,
          confirmLabel: 'Approve Transfer',
          confirmVariant: 'default' as const,
          icon: CheckCircle2,
          iconColor: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50',
        };
      case 'ship':
        return {
          title: 'Dispatch Stock Transfer',
          description: `Are you sure you want to dispatch transfer "${transfer.transferNumber}"? This will deduct the transferred items from "${transfer.sourceWarehouse?.name || 'source'}" and transition the status to IN_TRANSIT.`,
          confirmLabel: 'Dispatch Stock',
          confirmVariant: 'default' as const,
          icon: Truck,
          iconColor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50',
        };
      case 'receive':
        return {
          title: 'Receive Stock Transfer',
          description: `Are you sure you want to receive transfer "${transfer.transferNumber}"? This will credit the transferred items into "${transfer.destinationWarehouse?.name || 'destination'}" and transition the status to RECEIVED.`,
          confirmLabel: 'Receive Stock',
          confirmVariant: 'default' as const,
          icon: PackageCheck,
          iconColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50',
        };
      case 'cancel':
        return {
          title: 'Cancel Stock Transfer',
          description: `Are you sure you want to cancel transfer "${transfer.transferNumber}"? Cancelled transfers cannot be reopened or fulfilled. Only DRAFT and APPROVED transfers can be cancelled.`,
          confirmLabel: 'Cancel Transfer',
          confirmVariant: 'destructive' as const,
          icon: XCircle,
          iconColor: 'text-destructive bg-destructive/10',
        };
      case 'delete':
        return {
          title: 'Delete Draft Transfer',
          description: `Are you sure you want to permanently delete draft transfer "${transfer.transferNumber}"? This will delete the transfer and all child items. Only DRAFT transfers can be deleted.`,
          confirmLabel: 'Delete Transfer',
          confirmVariant: 'destructive' as const,
          icon: Trash2,
          iconColor: 'text-destructive bg-destructive/10',
        };
    }
  };

  const config = getActionConfig();
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-full ${config.iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">{config.title}</DialogTitle>
              <span className="text-xs text-muted-foreground font-mono">
                {transfer.transferNumber}
              </span>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {action === 'cancel' && (
          <div className="space-y-2 pt-2">
            <Label htmlFor="cancel-reason" className="text-sm font-medium">
              Cancellation Reason (Optional)
            </Label>
            <Input
              id="cancel-reason"
              placeholder="e.g., Damaged prior to dispatch, incorrect destination"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
