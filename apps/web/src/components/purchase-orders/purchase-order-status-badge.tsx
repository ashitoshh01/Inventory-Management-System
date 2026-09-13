import * as React from 'react';
import { Badge } from '@repo/ui';
import type { PurchaseOrderStatus } from '@repo/types';

interface PurchaseOrderStatusBadgeProps {
  status: PurchaseOrderStatus;
  className?: string;
}

export function PurchaseOrderStatusBadge({ status, className }: PurchaseOrderStatusBadgeProps) {
  switch (status) {
    case 'DRAFT':
      return (
        <Badge
          variant="outline"
          className={`bg-muted/50 text-muted-foreground border-muted-foreground/30 font-medium ${className ?? ''}`}
        >
          Draft
        </Badge>
      );
    case 'SUBMITTED':
      return (
        <Badge
          variant="outline"
          className={`bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-medium ${className ?? ''}`}
        >
          Submitted
        </Badge>
      );
    case 'APPROVED':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium ${className ?? ''}`}
        >
          Approved
        </Badge>
      );
    case 'PARTIALLY_RECEIVED':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium ${className ?? ''}`}
        >
          Partially Received
        </Badge>
      );
    case 'RECEIVED':
      return (
        <Badge
          variant="outline"
          className={`bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30 font-medium ${className ?? ''}`}
        >
          Received
        </Badge>
      );
    case 'CLOSED':
      return (
        <Badge
          variant="outline"
          className={`bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30 font-medium ${className ?? ''}`}
        >
          Closed
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge
          variant="outline"
          className={`bg-destructive/10 text-destructive border-destructive/30 font-medium ${className ?? ''}`}
        >
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}
