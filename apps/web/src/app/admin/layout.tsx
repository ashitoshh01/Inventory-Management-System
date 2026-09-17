'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/providers/AuthProvider';
import { AdminSidebar } from '../../components/admin/admin-sidebar';
import { AdminHeader } from '../../components/admin/admin-header';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { cn } from '@repo/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Verifying platform administrator credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
    return null;
  }

  // Strict Platform Admin check
  if (!user.isPlatformAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-white">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-400">
            This area is restricted to StockMinistry platform administrators. Your account (<span className="text-slate-200 font-medium">{user.email}</span>) does not possess platform-level administrative privileges.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => router.push('/')}
              className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-600/30"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300',
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64',
        )}
      >
        <AdminHeader onMenuClick={() => setIsMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
