'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, checkAuth } =
    useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!isLoading && isAuthenticated) {
      checkAuth();
    }
  }, [isAuthenticated, isLoading, router, checkAuth]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">QueryAI</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.fullName || user.email}
              </span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Welcome to QueryAI! 🎉
              </h2>
              <p className="text-gray-600 mb-8">
                Your authentication is working perfectly. You're logged in as{' '}
                <strong>{user.email}</strong>
              </p>

              <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  User Information
                </h3>
                <div className="text-left space-y-2">
                  <p>
                    <span className="font-medium">ID:</span> {user.id}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span> {user.email}
                  </p>
                  {user.fullName && (
                    <p>
                      <span className="font-medium">Full Name:</span>{' '}
                      {user.fullName}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <p className="text-sm text-gray-500">
                  Next steps: AI integration, chat interface, and more features
                  coming soon!
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
