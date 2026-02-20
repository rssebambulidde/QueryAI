'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { ArrowLeft } from 'lucide-react';

export default function WorkspacePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    if (!hasCheckedAuth) {
      checkAuth()
        .catch(() => {})
        .finally(() => setHasCheckedAuth(true));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasCheckedAuth && !authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasCheckedAuth, authLoading, isAuthenticated, router]);

  if (!hasCheckedAuth || authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Research Workspace</h1>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Workspace — Retired</h2>
          <p className="text-sm text-gray-500">
            The research workspace has been retired in v2. Use conversations and collections from the dashboard instead.
          </p>
        </div>
      </main>
    </div>
  );
}
