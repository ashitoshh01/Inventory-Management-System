'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Public registration is disabled.
 * This page redirects to /login to prevent direct URL access.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-slate-500">Redirecting to login...</p>
    </div>
  );
}
