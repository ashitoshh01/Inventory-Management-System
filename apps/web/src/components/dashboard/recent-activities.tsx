'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Package, Boxes, User, ArrowLeftRight, Clock } from 'lucide-react';
import type { RecentActivityDto } from '@repo/types';

interface RecentActivitiesProps {
  activities?: RecentActivityDto[] | undefined;
  isLoading?: boolean | undefined;
  className?: string | undefined;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hr${diffInHours > 1 ? 's' : ''} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
}

function getActivityIcon(action: string, entityType: string) {
  const act = action.toLowerCase();
  const ent = entityType.toLowerCase();

  if (ent.includes('purchase') || act.includes('purchase') || act.includes('receive')) {
    return {
      icon: Package,
      bg: 'bg-emerald-50 text-emerald-600',
    };
  }
  if (ent.includes('transfer') || act.includes('transfer') || act.includes('ship')) {
    return {
      icon: ArrowLeftRight,
      bg: 'bg-blue-50 text-blue-600',
    };
  }
  if (act.includes('alert') || act.includes('low') || act.includes('out_of_stock')) {
    return {
      icon: AlertTriangle,
      bg: 'bg-amber-50 text-amber-600',
    };
  }
  if (ent.includes('user') || ent.includes('member') || act.includes('auth')) {
    return {
      icon: User,
      bg: 'bg-purple-50 text-purple-600',
    };
  }
  return {
    icon: Boxes,
    bg: 'bg-slate-100 text-slate-600',
  };
}

export function RecentActivities({
  activities = [],
  isLoading = false,
  className,
}: RecentActivitiesProps) {
  if (isLoading) {
    return (
      <div
        className={`h-80 animate-pulse rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${
          className || ''
        }`}
      />
    );
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md ${
        className || ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Recent Activities</h3>
        <Link
          href="/stock/ledger"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          View all
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <Clock className="h-8 w-8 text-slate-400 mb-2" />
          <p className="text-xs font-medium text-slate-500">No activity logged yet</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Actions like stock adjustments, transfers, and orders will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex-1 space-y-3.5 overflow-y-auto max-h-64 pr-1">
          {activities.slice(0, 5).map((act) => {
            const { icon: Icon, bg } = getActivityIcon(act.action, act.entityType);
            return (
              <div key={act.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{act.action}</p>
                    <p className="truncate text-slate-500 text-[11px]">{act.description}</p>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-slate-400">
                  {formatRelativeTime(act.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
