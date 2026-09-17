'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8">
      {/* Left: Hamburger & Title */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-purple-100 text-purple-700">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              Platform Administration
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Global tenant management, authorization, and system telemetry
            </p>
          </div>
        </div>
      </div>

      {/* Right: Actions and User */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Exit to Workspace
        </button>

        <div className="h-6 w-px bg-slate-200" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-800 leading-tight">
              {user?.email || 'Platform Admin'}
            </div>
            <span className="inline-block rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700">
              Platform Admin
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100/70 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
