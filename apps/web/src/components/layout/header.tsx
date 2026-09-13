'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  HelpCircle,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Building,
} from 'lucide-react';
import { cn } from '@repo/ui';
import { useAuth } from '../providers/AuthProvider';

interface HeaderProps {
  className?: string;
  onMenuClick?: () => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
}

export function Header({
  className,
  onMenuClick,
  searchValue,
  onSearchChange,
}: HeaderProps) {
  const router = useRouter();
  const { user, memberships, activeOrganizationId, setActiveOrganizationId, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeMembership = memberships?.find(
    (m) => m.organizationId === activeOrganizationId,
  ) || memberships?.[0];

  const roleName = activeMembership?.role?.name || 'Admin';
  const displayName = user?.email
    ? user.email.split('@')[0]!.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'John Doe';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    router.push('/login');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8',
        className,
      )}
    >
      {/* Left: Mobile hamburger & Search bar */}
      <div className="flex flex-1 items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={searchValue || ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search products, SKU, barcode..."
            className="w-full rounded-full border border-slate-200 bg-slate-50/70 py-2 pl-4 pr-16 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="mr-2 hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline-block">
              Ctrl + K
            </span>
            <Search className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Right: Notifications, Help, Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            3
          </span>
        </button>

        {/* Help Circle */}
        <button
          type="button"
          className="hidden rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors sm:block"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <div className="hidden h-6 w-px bg-slate-200 sm:block" />

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 font-semibold text-white shadow-sm ring-1 ring-white">
              {initial}
            </div>
            <div className="hidden text-left lg:block">
              <div className="text-sm font-semibold text-slate-800 leading-tight">
                {displayName}
              </div>
              <div className="text-[11px] font-medium text-slate-400 capitalize">
                {roleName.toLowerCase()}
              </div>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-100 bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none z-50">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-xs font-medium text-slate-400">Signed in as</p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user?.email || 'admin@example.com'}
                </p>
              </div>

              {memberships && memberships.length > 1 && (
                <div className="border-b border-slate-100 py-1">
                  <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Organizations
                  </div>
                  {memberships.map((m) => (
                    <button
                      key={m.organizationId}
                      onClick={() => {
                        setActiveOrganizationId(m.organizationId);
                        setShowProfileMenu(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-1.5 text-xs text-left',
                        m.organizationId === activeOrganizationId
                          ? 'bg-blue-50 font-semibold text-blue-600'
                          : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <Building className="h-3.5 w-3.5" />
                      <span className="truncate">Org: {m.organizationId.slice(0, 8)}...</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    router.push('/settings');
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  Settings
                </button>
              </div>

              <div className="border-t border-slate-100 py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
