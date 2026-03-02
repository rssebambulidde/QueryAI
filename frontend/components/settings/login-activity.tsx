'use client';

import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface LoginActivityEntry {
  id: string;
  action: string;
  timestamp: string;
  ipAddress: string;
}

interface LoginActivityProps {
  className?: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: 'Login', color: 'bg-green-100 text-green-700' },
  logout: { label: 'Logout', color: 'bg-gray-100 text-gray-700' },
  user_signedup: { label: 'Signed Up', color: 'bg-blue-100 text-blue-700' },
  user_updated_password: { label: 'Password Changed', color: 'bg-orange-100 text-orange-700' },
};

export const LoginActivity: React.FC<LoginActivityProps> = ({ className }) => {
  const [activity, setActivity] = useState<LoginActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.getLoginActivity(20);
      if (response.success && response.data) {
        setActivity(response.data.activity);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load login activity');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-500" />
            Login Activity
          </h3>
          <p className="text-sm text-gray-500 mt-1">Recent account activity</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchActivity}
          disabled={isLoading}
          className="min-h-[36px]"
        >
          <RefreshCw className={cn('w-4 h-4 mr-1', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {isLoading && activity.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 py-2">
              <div className="h-6 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No recent activity found</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {activity.map((entry) => {
            const actionInfo = ACTION_LABELS[entry.action] || {
              label: entry.action,
              color: 'bg-gray-100 text-gray-700',
            };
            return (
              <div key={entry.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', actionInfo.color)}>
                  {actionInfo.label}
                </span>
                <span className="text-gray-600">{formatDate(entry.timestamp)}</span>
                <span className="text-gray-400 ml-auto font-mono text-xs">{entry.ipAddress}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
