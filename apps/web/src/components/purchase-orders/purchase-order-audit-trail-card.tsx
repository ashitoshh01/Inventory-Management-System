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
import { History, CheckCircle2, Send, FilePlus, XCircle, Truck } from 'lucide-react';
import { usePurchaseOrderAuditTrail } from '../../hooks/use-purchase-orders';

interface PurchaseOrderAuditTrailCardProps {
  purchaseOrderId: string;
}

function getActionBadge(action: string) {
  switch (action) {
    case 'PURCHASE_ORDER_CREATED':
    case 'purchase-order.created':
      return (
        <Badge variant="outline" className="gap-1 border-blue-500/40 text-blue-600 bg-blue-50/50">
          <FilePlus className="h-3 w-3" /> Created
        </Badge>
      );
    case 'PURCHASE_ORDER_UPDATED':
    case 'purchase-order.updated':
      return (
        <Badge variant="outline" className="gap-1 border-gray-400 text-gray-700 bg-gray-50/50">
          Updated
        </Badge>
      );
    case 'PURCHASE_ORDER_STATUS_CHANGED':
      return (
        <Badge variant="outline" className="gap-1 border-cyan-500/40 text-cyan-600 bg-cyan-50/50">
          <CheckCircle2 className="h-3 w-3" /> Status Changed
        </Badge>
      );
    case 'purchase-order.submitted':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/40 text-amber-600 bg-amber-50/50"
        >
          <Send className="h-3 w-3" /> Submitted
        </Badge>
      );
    case 'purchase-order.approved':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/40 text-emerald-600 bg-emerald-50/50"
        >
          <CheckCircle2 className="h-3 w-3" /> Approved
        </Badge>
      );
    case 'purchase-order.received':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-purple-500/40 text-purple-600 bg-purple-50/50"
        >
          <Truck className="h-3 w-3" /> Goods Received
        </Badge>
      );
    case 'purchase-order.cancelled':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-destructive/40 text-destructive bg-destructive/10"
        >
          <XCircle className="h-3 w-3" /> Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{action}</Badge>;
  }
}

export function PurchaseOrderAuditTrailCard({ purchaseOrderId }: PurchaseOrderAuditTrailCardProps) {
  const { data: eventsRes, isLoading, isError } = usePurchaseOrderAuditTrail(purchaseOrderId);
  const events = eventsRes?.data;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError || !events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Audit History Timeline
          </CardTitle>
          <CardDescription>No recorded audit events found for this order.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Procurement Lifecycle Audit Trail
        </CardTitle>
        <CardDescription>
          Immutable chronological record of business events and state transitions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {events.map((event) => (
            <div key={event.id} className="relative group">
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                <div className="flex items-center gap-2">
                  {getActionBadge(event.action)}
                  <span className="text-xs text-muted-foreground">
                    by {event.actorUserId ? `User (${event.actorUserId.slice(0, 8)})` : 'System'}
                  </span>
                </div>
                <time className="text-xs text-muted-foreground font-mono">
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </div>

              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="text-xs bg-muted/40 p-2.5 rounded border mt-1.5 font-mono text-muted-foreground overflow-x-auto max-h-32">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
