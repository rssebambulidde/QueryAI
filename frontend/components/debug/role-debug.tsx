'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { Alert } from '@/components/ui/alert';

/**
 * Debug component to check user role
 * Add this temporarily to your dashboard to debug role issues
 */
export function RoleDebug() {
  const { user } = useAuthStore();
  const { role, isAdmin, isSuperAdmin } = useUserRole();

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 max-w-md">
      <h3 className="font-semibold mb-2">Role Debug Info</h3>
      <div className="space-y-1 text-sm">
        <div>
          <strong>User Email:</strong> {user?.email || 'Not loaded'}
        </div>
        <div>
          <strong>User Role (from store):</strong> {user?.role || 'undefined'}
        </div>
        <div>
          <strong>Role (from hook):</strong> {role}
        </div>
        <div>
          <strong>Is Admin:</strong> {isAdmin ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>Is Super Admin:</strong> {isSuperAdmin ? '✅ Yes' : '❌ No'}
        </div>
        <div className="mt-2 pt-2 border-t">
          <strong>Full User Object:</strong>
          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-40">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>
      {!user?.role && (
        <Alert variant="warning" className="mt-2">
          ⚠️ Role is missing! Check API response and database.
        </Alert>
      )}
      {user?.role === 'user' && (
        <Alert variant="warning" className="mt-2">
          ⚠️ Role is 'user'. Update database to 'super_admin'.
        </Alert>
      )}
    </div>
  );
}
