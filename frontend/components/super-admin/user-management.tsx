'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import { Search, UserCheck, UserX, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { useMobile } from '@/lib/hooks/use-mobile';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'user' | 'super_admin';
  created_at: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
  const { isMobile } = useMobile();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/admin/users', {
        params: { limit: 100 },
      });
      if (response.data.success) {
        setUsers(response.data.data.users || []);
      } else {
        setError(response.data.error?.message || 'Failed to load users');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'user' | 'super_admin') => {
    try {
      setUpdatingRole(userId);
      const response = await apiClient.put(`/api/admin/users/${userId}/role`, {
        role: newRole,
      });
      if (response.data.success) {
        toast.success(`User role updated to ${newRole}`);
        await loadUsers();
      } else {
        throw new Error(response.data.error?.message || 'Failed to update role');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update user role');
    } finally {
      setUpdatingRole(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const badges = {
      super_admin: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
          <ShieldCheck className="w-3 h-3" />
          Super Admin
        </span>
      ),
      user: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
          <UserX className="w-3 h-3" />
          User
        </span>
      ),
    };
    return badges[role as keyof typeof badges] || badges.user;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">User Management</h3>
        <p className="text-sm text-gray-600 mt-1">Manage user roles and permissions</p>
      </div>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={loadUsers} variant="outline">
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? 'No users found matching your search' : 'No users found'}
          </div>
        ) : isMobile ? (
          /* Mobile: Card Layout */
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 break-words">{user.email}</div>
                    {user.full_name && (
                      <div className="text-sm text-gray-600 mt-1">{user.full_name}</div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {getRoleBadge(user.role)}
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Created:</span>
                    <span>{new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-gray-200">
                  {user.id !== currentUser?.id && isSuperAdmin ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          updateUserRole(user.id, e.target.value as 'user' | 'super_admin')
                        }
                        disabled={updatingRole === user.id}
                        className="flex-1 text-sm border rounded px-3 py-2 min-h-[44px] touch-manipulation"
                      >
                        <option value="user">User</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                      {updatingRole === user.id && (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">
                      {user.id === currentUser?.id ? 'Current user' : '—'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table Layout */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold text-gray-700">Email</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Name</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Role</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Created</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">{user.full_name || '—'}</td>
                    <td className="p-3">{getRoleBadge(user.role)}</td>
                    <td className="p-3 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {user.id !== currentUser?.id && isSuperAdmin ? (
                          <>
                            <select
                              value={user.role}
                              onChange={(e) =>
                                updateUserRole(user.id, e.target.value as 'user' | 'super_admin')
                              }
                              disabled={updatingRole === user.id}
                              className="text-sm border rounded px-2 py-1"
                            >
                              <option value="user">User</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                            {updatingRole === user.id && (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">
                            {user.id === currentUser?.id ? 'Current user' : '—'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
