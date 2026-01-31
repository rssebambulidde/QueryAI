'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import { Search, UserCheck, UserX, Shield, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'user' | 'admin' | 'super_admin';
  created_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
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

  const updateUserRole = async (userId: string, newRole: 'user' | 'admin' | 'super_admin') => {
    try {
      setUpdatingRole(userId);
      const response = await apiClient.put(`/api/admin/users/${userId}/role`, {
        role: newRole,
      });
      if (response.data.success) {
        toast({
          title: 'Success',
          description: `User role updated to ${newRole}`,
        });
        await loadUsers();
      } else {
        throw new Error(response.data.error?.message || 'Failed to update role');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.error?.message || 'Failed to update user role',
        variant: 'destructive',
      });
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
      admin: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
          <Shield className="w-3 h-3" />
          Admin
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
    <AdminGuard requireOwner>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600">Manage user roles and permissions (Super Admin only)</p>
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="bg-white rounded-lg shadow p-6">
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
            ) : (
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
                                    updateUserRole(user.id, e.target.value as 'user' | 'admin' | 'super_admin')
                                  }
                                  disabled={updatingRole === user.id}
                                  className="text-sm border rounded px-2 py-1"
                                >
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
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
                {filteredUsers.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    {searchTerm ? 'No users found matching your search' : 'No users found'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
