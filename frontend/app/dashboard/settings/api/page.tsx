'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, Key, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth-store';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used?: string;
}

export default function ApiPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // TODO: Load API keys from API
    // For now, show empty state
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    setIsCreating(true);
    try {
      // TODO: Implement API call to create key
      toast.success('API key created successfully');
      setNewKeyName('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      // TODO: Implement API call to delete key
      setApiKeys(apiKeys.filter(k => k.id !== id));
      toast.success('API key deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete API key');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">API</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your API keys for programmatic access
        </p>
      </div>

      {/* Create New Key */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create API Key</h3>
        <div className="flex gap-3">
          <Input
            placeholder="Key name (e.g., Production API)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleCreateKey} disabled={isCreating}>
            <Plus className="w-4 h-4 mr-2" />
            Create Key
          </Button>
        </div>
      </div>

      {/* API Keys List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your API Keys</h3>
        {apiKeys.length === 0 ? (
          <div className="text-center py-12">
            <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-500">No API keys yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first API key to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{apiKey.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                      {showKey[apiKey.id] ? apiKey.key : '•'.repeat(32)}
                    </code>
                    <button
                      onClick={() => setShowKey({ ...showKey, [apiKey.id]: !showKey[apiKey.id] })}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {showKey[apiKey.id] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCopyKey(apiKey.key)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {apiKey.last_used && (
                    <p className="text-xs text-gray-500 mt-2">
                      Last used: {new Date(apiKey.last_used).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteKey(apiKey.id)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Documentation Link */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Need help?</strong> Check out our{' '}
          <a href="/api-docs" className="underline hover:text-blue-700">
            API documentation
          </a>{' '}
          to learn how to use your API keys.
        </p>
      </div>
    </div>
  );
}
