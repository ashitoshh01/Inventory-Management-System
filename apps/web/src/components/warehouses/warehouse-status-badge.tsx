'use client';

import * as React from 'react';
import { Badge } from '@repo/ui';
import type { WarehouseStatus } from '@repo/types';

interface WarehouseStatusBadgeProps {
  status: WarehouseStatus;
  className?: string;
}

export function WarehouseStatusBadge({ status, className }: WarehouseStatusBadgeProps) {
  if (status === 'ACTIVE') {
    return (
      <Badge
        variant="default"
        className={`bg-emerald-600 hover:bg-emerald-600/90 text-white font-medium ${className ?? ''}`}
      >
        Active
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={`font-medium ${className ?? ''}`}>
      Inactive
    </Badge>
  );
}
