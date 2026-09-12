'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Home, Settings, Tags } from 'lucide-react';

import { cn } from '@repo/ui';

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, exact: true },
    { name: 'Products', href: '/products', icon: Package, exact: false },
    { name: 'Categories', href: '/categories', icon: Tags, exact: false },
    { name: 'Settings', href: '/settings', icon: Settings, exact: false },
  ];

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
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
