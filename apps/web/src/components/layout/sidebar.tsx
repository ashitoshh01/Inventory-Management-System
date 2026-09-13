'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  ArrowLeftRight,
  Building2,
  Tags,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import { cn } from '@repo/ui';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  children?: { name: string; href: string }[];
  badge?: number;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, exact: true },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Categories', href: '/categories', icon: Tags },
  { name: 'Warehouses', href: '/warehouses', icon: Building2 },
  {
    name: 'Inventory',
    href: '/stock',
    icon: Boxes,
    children: [
      { name: 'Stock Overview', href: '/stock' },
      { name: 'Stock Movements', href: '/stock/ledger' },
    ],
  },
  {
    name: 'Purchasing',
    href: '/purchase-orders',
    icon: ShoppingCart,
  },
  { name: 'Transfers', href: '/transfers', icon: ArrowLeftRight },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    children: [
      { name: 'Reports Hub', href: '/reports' },
      { name: 'Stock Movements', href: '/reports/stock-movement' },
      { name: 'Inventory Valuation', href: '/reports/inventory-valuation' },
      { name: 'Reconciliation', href: '/reports/reconciliation' },
      { name: 'Procurement', href: '/reports/procurement' },
      { name: 'Sales Summary', href: '/reports/sales' },
    ],
  },
];

function NavItemComponent({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const isChildActive = hasChildren
    ? item.children!.some(
        (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
      )
    : false;

  const active = isActive || isChildActive;

  // Auto-open if a child is active
  React.useEffect(() => {
    if (isChildActive) setIsOpen(true);
  }, [isChildActive]);

  if (hasChildren && !isCollapsed) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
            active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 text-left">{item.name}</span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </button>
        {isOpen && (
          <div className="mt-1 ml-4 space-y-0.5 border-l border-white/10 pl-4">
            {item.children!.map((child) => {
              const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
              return (
                <Link
                  key={child.name}
                  href={child.href}
                  className={cn(
                    'block rounded-md px-3 py-2 text-[13px] transition-all duration-150',
                    childActive
                      ? 'bg-white/10 font-semibold text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {child.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-primary text-white shadow-sm'
          : 'text-slate-300 hover:bg-white/5 hover:text-white',
      )}
      title={isCollapsed ? item.name : undefined}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      {!isCollapsed && <span className="flex-1">{item.name}</span>}
      {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  className,
  isCollapsed = false,
  onToggle,
  isMobileOpen = false,
  onMobileClose,
}: {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={onMobileClose} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300',
          isCollapsed ? 'w-[72px]' : 'w-64',
          // Mobile: slide in/out
          'max-lg:-translate-x-full max-lg:shadow-2xl',
          isMobileOpen && 'max-lg:translate-x-0',
          className,
        )}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold text-white">IMS</h1>
              <p className="truncate text-[11px] text-slate-400">Inventory Management</p>
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="ml-auto rounded-md p-1 text-slate-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavItemComponent key={item.name} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        </nav>

        {/* Collapse toggle (desktop only) */}
        {onToggle && (
          <div className="hidden border-t border-white/10 p-3 lg:block">
            <button
              onClick={onToggle}
              className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
