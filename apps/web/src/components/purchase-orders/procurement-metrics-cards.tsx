'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@repo/ui';
import { Package, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { useProcurementMetrics } from '../../hooks/use-purchase-orders';

export function ProcurementMetricsCards() {
  const { data: metricsRes, isLoading, isError } = useProcurementMetrics();
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
            Total Orders
          </CardTitle>
          <Package className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalOrders}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.statusCounts.DRAFT} drafts, {metrics.statusCounts.SUBMITTED} submitted
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ready to Receive
          </CardTitle>
          <Clock className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{metrics.pendingReceivingCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.statusCounts.APPROVED} approved, {metrics.statusCounts.PARTIALLY_RECEIVED}{' '}
            partial
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Overdue Deliveries
          </CardTitle>
          <AlertTriangle
            className={`h-4 w-4 ${metrics.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              metrics.overdueCount > 0 ? 'text-destructive' : 'text-foreground'
            }`}
          >
            {metrics.overdueCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Expected date has passed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Outstanding Qty
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono">{metrics.totalOutstandingQuantity}</div>
          <p className="text-xs text-muted-foreground mt-1">Units pending physical receipt</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Received Qty
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono text-emerald-600">
            {metrics.totalReceivedQuantity}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.recentlyReceivedCount} orders received recently
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
