'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Skeleton,
} from '@repo/ui';
import { History, CheckCircle2, FilePlus, XCircle, Truck, PackageCheck, Edit } from 'lucide-react';
import { useTransferAuditTrail } from '../../hooks/use-transfers';

interface TransferAuditTrailCardProps {
  transferId: string;
}

function getActionBadge(action: string) {
  switch (action) {
    case 'STOCK_TRANSFER_CREATED':
      return (
        <Badge variant="outline" className="gap-1 border-blue-500/40 text-blue-600 bg-blue-50/50">
          <FilePlus className="h-3 w-3" /> Created
        </Badge>
      );
    case 'STOCK_TRANSFER_UPDATED':
      return (
        <Badge variant="outline" className="gap-1 border-gray-400 text-gray-700 bg-gray-50/50">
          <Edit className="h-3 w-3" /> Updated
        </Badge>
      );
    case 'STOCK_TRANSFER_APPROVED':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/40 text-emerald-600 bg-emerald-50/50"
        >
          <CheckCircle2 className="h-3 w-3" /> Approved
        </Badge>
      );
    case 'STOCK_TRANSFER_SHIPPED':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-indigo-500/40 text-indigo-600 bg-indigo-50/50"
        >
          <Truck className="h-3 w-3" /> Dispatched
        </Badge>
      );
    case 'STOCK_TRANSFER_RECEIVED':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/40 text-emerald-700 bg-emerald-50/50"
        >
          <PackageCheck className="h-3 w-3" /> Received
        </Badge>
      );
    case 'STOCK_TRANSFER_CANCELLED':
      return (
        <Badge variant="outline" className="gap-1 border-rose-500/40 text-rose-600 bg-rose-50/50">
          <XCircle className="h-3 w-3" /> Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          {action}
        </Badge>
      );
  }
}

export function TransferAuditTrailCard({ transferId }: TransferAuditTrailCardProps) {
  const { data: auditRes, isLoading, isError } = useTransferAuditTrail(transferId);
  const auditEvents = auditRes?.data || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Audit Trail
          </CardTitle>
          <CardDescription>Immutable record of all lifecycle events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="h-3 w-3 rounded-full mt-1.5" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load audit history.</p>
        </CardContent>
      </Card>
    );
  }

  if (auditEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Audit Trail
          </CardTitle>
          <CardDescription>Immutable record of all lifecycle events</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No audit logs recorded for this transfer yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Audit Trail
        </CardTitle>
        <CardDescription>
          Immutable record of all lifecycle events and state transitions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {auditEvents.map((event) => {
            const date = new Date(event.createdAt);
            const formattedDate = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={event.id} className="relative group">
                {/* Timeline dot */}
                <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    {getActionBadge(event.action)}
                    <span className="text-sm font-medium text-foreground">
                      {event.user ? `${event.user.firstName} ${event.user.lastName}` : 'System'}
                    </span>
                  </div>
                  <time className="text-xs text-muted-foreground font-mono">{formattedDate}</time>
                </div>

                {event.metadata && typeof event.metadata === 'object' && (
                  <div className="mt-1 text-xs text-muted-foreground bg-muted/40 rounded p-2 font-mono">
                    {Boolean(event.metadata.reason) && (
                      <p className="font-sans text-rose-600 font-medium">
                        Reason: {String(event.metadata.reason)}
                      </p>
                    )}
                    {Boolean(event.metadata.previousStatus && event.metadata.newStatus) && (
                      <p>
                        Status: {String(event.metadata.previousStatus)} →{' '}
                        {String(event.metadata.newStatus)}
                      </p>
                    )}
                    {event.metadata.itemCount !== undefined && (
                      <p>Items: {String(event.metadata.itemCount)} line(s)</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
