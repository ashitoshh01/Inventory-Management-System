'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserPlus,
  ShieldAlert,
  Package,
  Warehouse,
  Boxes,
  ShoppingCart,
  ArrowLeftRight,
  ReceiptText,
  FileSpreadsheet,
  Activity,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '@repo/ui';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Platform Overview',
    items: [
      { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { title: 'System Health', href: '/admin/system', icon: Activity },
    ],
  },
  {
    title: 'Management',
    items: [
      { title: 'Organizations', href: '/admin/organizations', icon: Building2 },
      { title: 'Users & Access', href: '/admin/users', icon: Users },
      { title: 'Account Requests', href: '/admin/account-requests', icon: UserPlus },
      { title: 'Roles & Permissions', href: '/admin/roles', icon: ShieldAlert },
    ],
  },
  {
    title: 'Cross-Tenant Visibility',
    items: [
      { title: 'Products', href: '/admin/products', icon: Package },
      { title: 'Warehouses', href: '/admin/warehouses', icon: Warehouse },
      { title: 'Inventory', href: '/admin/inventory', icon: Boxes },
      { title: 'Purchase Orders', href: '/admin/purchase-orders', icon: ShoppingCart },
      { title: 'Transfers', href: '/admin/transfers', icon: ArrowLeftRight },
      { title: 'Sales Orders', href: '/admin/sales', icon: ReceiptText },
    ],
  },
  {
    title: 'Governance',
    items: [
      { title: 'Audit Logs', href: '/admin/audit', icon: FileSpreadsheet },
    ],
  },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function AdminSidebar({
  isCollapsed,
  onToggle,
  isMobileOpen,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href);
  };

  const content = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100 border-r border-slate-800">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div>
              <span className="font-bold text-base text-white tracking-tight">StockMinistry</span>
              <span className="ml-1.5 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                ADMIN
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <h2 className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {section.title}
              </h2>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isLinkActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                      active
                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                      isCollapsed && 'justify-center px-2',
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Footer: Back to App & Collapse Button */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700/50',
            isCollapsed && 'justify-center px-2',
          )}
          title={isCollapsed ? 'Exit Admin Panel' : undefined}
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-slate-400" />
          {!isCollapsed && <span>Exit to Workspace</span>}
        </Link>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors',
            isCollapsed && 'justify-center px-2',
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden lg:block transition-all duration-300',
          isCollapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {content}
      </aside>

      {/* Mobile Slide-in Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-full shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
