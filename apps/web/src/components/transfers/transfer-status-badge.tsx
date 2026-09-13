import * as React from 'react';
import { Badge } from '@repo/ui';
import type { StockTransferStatus } from '@repo/types';

interface TransferStatusBadgeProps {
  status: StockTransferStatus;
  className?: string;
}

export function TransferStatusBadge({ status, className }: TransferStatusBadgeProps) {
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
    case 'APPROVED':
      return (
        <Badge
          variant="outline"
          className={`bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-medium ${className ?? ''}`}
        >
          Approved
        </Badge>
      );
    case 'IN_TRANSIT':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium ${className ?? ''}`}
        >
          In Transit
        </Badge>
      );
    case 'RECEIVED':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium ${className ?? ''}`}
        >
          Received
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge
          variant="outline"
          className={`bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-medium ${className ?? ''}`}
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
