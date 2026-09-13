'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@repo/ui';
import { ArrowLeftRight, Clock, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { useTransferMetrics } from '../../hooks/use-transfers';

export function TransferMetricsCards() {
  const { data: metricsRes, isLoading, isError } = useTransferMetrics();
  const metrics = metricsRes?.data;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !metrics) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Transfers
          </CardTitle>
          <ArrowLeftRight className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.statusCounts.DRAFT} drafts, {metrics.statusCounts.APPROVED} approved
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Approved
          </CardTitle>
          <Clock className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{metrics.approvedCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Ready for dispatch</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            In Transit
          </CardTitle>
          <Truck className="h-4 w-4 text-indigo-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-indigo-600">{metrics.inTransitCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Dispatched between hubs</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Received
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{metrics.receivedCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Successfully fulfilled</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Cancelled
          </CardTitle>
          <XCircle className="h-4 w-4 text-rose-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-600">{metrics.statusCounts.CANCELLED}</div>
          <p className="text-xs text-muted-foreground mt-1">Voided transfers</p>
        </CardContent>
      </Card>
    </div>
  );
}
