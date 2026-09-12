'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@repo/ui';
import { apiClient } from '../lib/api/client';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient<{ status: string }>('/health/liveness'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Welcome to the Inventory Management System.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backend Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold text-muted-foreground">Checking...</div>
            ) : error ? (
              <div className="text-2xl font-bold text-destructive">Offline</div>
            ) : (
              <div className="text-2xl font-bold text-primary">
                {data?.data?.status === 'ok' ? 'Online' : 'Unknown'}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Connection to /api/v1/health/liveness
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Button>Test Design System Button</Button>
      </div>
    </div>
  );
}
