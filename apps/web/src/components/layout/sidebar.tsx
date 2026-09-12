import * as React from 'react';
import Link from 'next/link';
import { Package, Home, Settings } from 'lucide-react';

import { cn } from '@repo/ui';

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'pb-12 bg-sidebar text-sidebar-foreground flex h-full flex-col border-r border-sidebar-border',
        className,
      )}
    >
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-sidebar-foreground">
            Inventory
          </h2>
          <div className="space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Package className="h-4 w-4" />
              Products
            </Link>
            <Link
              href="#"
              className="flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
