'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiKeyApi, ApiKey, topicApi, Topic } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Edit2, Trash2, X, Save, Copy, Eye, EyeOff, BarChart3, Calendar } from 'lucide-react';

export const ApiKeyManager: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [viewingUsage, setViewingUsage] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    topicId: '',
    rateLimitPerHour: 100,
    rateLimitPerDay: 1000,
    expiresAt: '',
  });

  // Load data
  useEffect(() => {
    loadApiKeys();
    loadTopics();
  }, []);

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const response = await apiKeyApi.list();
      if (response.success && response.data) {
        setApiKeys(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTopics = async () => {
    try {
      const response = await topicApi.list();
      if (response.success && response.data) {
        setTopics(response.data);
      }
    } catch (error) {
      console.warn('Failed to load topics:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('API key name is required');
      return;
    }

    try {
      const response = await apiKeyApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        topicId: formData.topicId || undefined,
        rateLimitPerHour: formData.rateLimitPerHour,
        rateLimitPerDay: formData.rateLimitPerDay,
        expiresAt: formData.expiresAt || undefined,
      });

      if (response.success && response.data) {
        // Show the new key (only shown once)
        if (response.data.key) {
          setNewKey(response.data.key);
        }
        toast.success('API key created successfully');
        setFormData({
          name: '',
          description: '',
          topicId: '',
          rateLimitPerHour: 100,
          rateLimitPerDay: 1000,
          expiresAt: '',
        });
        setShowCreateForm(false);
        loadApiKeys();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create API key');
    }
  };

  const handleUpdate = async () => {
    if (!editingKey) return;
    if (!formData.name.trim()) {
      toast.error('API key name is required');
      return;
    }

    try {
      const response = await apiKeyApi.update(editingKey.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        rateLimitPerHour: formData.rateLimitPerHour,
        rateLimitPerDay: formData.rateLimitPerDay,
        expiresAt: formData.expiresAt || undefined,
      });

      if (response.success && response.data) {
        toast.success('API key updated successfully');
        setEditingKey(null);
        setFormData({
          name: '',
          description: '',
          topicId: '',
          rateLimitPerHour: 100,
          rateLimitPerDay: 1000,
          expiresAt: '',
        });
        loadApiKeys();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update API key');
    }
  };

  const handleDelete = async (apiKey: ApiKey) => {
    if (!confirm(`Are you sure you want to delete "${apiKey.name}"?`)) {
      return;
    }

    try {
      const response = await apiKeyApi.delete(apiKey.id);
      if (response.success) {
        toast.success('API key deleted successfully');
        loadApiKeys();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete API key');
    }
  };

  const handleToggleActive = async (apiKey: ApiKey) => {
    try {
      const response = await apiKeyApi.update(apiKey.id, {
        isActive: !apiKey.is_active,
      });
      if (response.success) {
        toast.success(`API key ${!apiKey.is_active ? 'activated' : 'deactivated'}`);
        loadApiKeys();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update API key');
    }
  };

  const handleEdit = (apiKey: ApiKey) => {
    setEditingKey(apiKey);
    setFormData({
      name: apiKey.name,
      description: apiKey.description || '',
      topicId: apiKey.topic_id || '',
      rateLimitPerHour: apiKey.rate_limit_per_hour,
      rateLimitPerDay: apiKey.rate_limit_per_day,
      expiresAt: apiKey.expires_at || '',
    });
    setShowCreateForm(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setFormData({
      name: '',
      description: '',
      topicId: '',
      rateLimitPerHour: 100,
      rateLimitPerDay: 1000,
      expiresAt: '',
    });
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setFormData({
      name: '',
      description: '',
      topicId: '',
      rateLimitPerHour: 100,
      rateLimitPerDay: 1000,
      expiresAt: '',
    });
    setNewKey(null);
  };

  const getTopicName = (topicId?: string) => {
    if (!topicId) return 'No topic (all topics)';
    const topic = topics.find((t) => t.id === topicId);
    return topic ? topic.name : 'Unknown topic';
  };

  const loadUsage = async (apiKeyId: string) => {
    setUsageLoading(true);
    try {
      const response = await apiKeyApi.getUsage(apiKeyId, {
        limit: 100,
      });
      if (response.success && response.data) {
        setUsageData(response.data);
        setViewingUsage(apiKeyId);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load usage data');
    } finally {
      setUsageLoading(false);
    }
  };

  const closeUsage = () => {
    setViewingUsage(null);
    setUsageData(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">API Keys</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage API keys for programmatic access to your topic-scoped AI
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreateForm(true);
            setEditingKey(null);
            setNewKey(null);
            setFormData({
              name: '',
              description: '',
              topicId: '',
              rateLimitPerHour: 100,
              rateLimitPerDay: 1000,
              expiresAt: '',
            });
          }}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New API Key
        </Button>
      </div>

      {/* New Key Display (shown once after creation) */}
      {newKey && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-orange-900">API Key Created</h4>
            <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-orange-800">
            Save this key securely. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-orange-300 rounded text-sm font-mono">
              {newKey}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(newKey)}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingKey) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              {editingKey ? 'Edit API Key' : 'Create New API Key'}
            </h4>
            <Button variant="ghost" size="sm" onClick={editingKey ? cancelEdit : cancelCreate}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Input
            placeholder="API key name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic Scope (optional)
            </label>
            <select
              value={formData.topicId}
              onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">No topic (all topics)</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rate Limit (per hour)
              </label>
              <Input
                type="number"
                value={formData.rateLimitPerHour}
                onChange={(e) =>
                  setFormData({ ...formData, rateLimitPerHour: parseInt(e.target.value) || 100 })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rate Limit (per day)
              </label>
              <Input
                type="number"
                value={formData.rateLimitPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, rateLimitPerDay: parseInt(e.target.value) || 1000 })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expires At (optional)
            </label>
            <Input
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={editingKey ? handleUpdate : handleCreate}
              size="sm"
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {editingKey ? 'Update' : 'Create'}
            </Button>
            <Button variant="outline" size="sm" onClick={editingKey ? cancelEdit : cancelCreate}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* API Keys List */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading API keys...</div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No API keys yet. Create one to get started!</p>
          <p className="text-sm mt-2">
            API keys allow programmatic access to your topic-scoped AI.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((apiKey) => (
            <div
              key={apiKey.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                apiKey.is_active
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{apiKey.name}</span>
                  {!apiKey.is_active && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                      Inactive
                    </span>
                  )}
                </div>
                {apiKey.description && (
                  <div className="text-sm text-gray-500 mt-1">{apiKey.description}</div>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>Key: {apiKey.key_prefix}...</span>
                  <span>Topic: {getTopicName(apiKey.topic_id)}</span>
                  <span>
                    Limits: {apiKey.rate_limit_per_hour}/hr, {apiKey.rate_limit_per_day}/day
                  </span>
                  {apiKey.last_used_at && (
                    <span>Last used: {new Date(apiKey.last_used_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadUsage(apiKey.id)}
                  className="h-8 w-8 p-0"
                  title="View Usage Statistics"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(apiKey)}
                  className="h-8 w-8 p-0"
                  title={apiKey.is_active ? 'Deactivate' : 'Activate'}
                >
                  {apiKey.is_active ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(apiKey)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(apiKey)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Statistics Modal */}
      {viewingUsage && usageData && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeUsage}
          />
          <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-lg shadow-xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">API Usage Statistics</h3>
                <Button variant="ghost" size="sm" onClick={closeUsage}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {usageLoading ? (
                <div className="text-center py-8 text-gray-500">Loading usage data...</div>
              ) : (
                <div className="space-y-6">
                  {/* Statistics Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-500">Total Requests</div>
                      <div className="text-2xl font-semibold text-gray-900 mt-1">
                        {usageData.statistics.totalRequests}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-green-600">Successful</div>
                      <div className="text-2xl font-semibold text-green-700 mt-1">
                        {usageData.statistics.successCount}
                      </div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="text-sm text-red-600">Errors</div>
                      <div className="text-2xl font-semibold text-red-700 mt-1">
                        {usageData.statistics.errorCount}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-sm text-blue-600">Avg Response Time</div>
                      <div className="text-2xl font-semibold text-blue-700 mt-1">
                        {usageData.statistics.avgResponseTime}ms
                      </div>
                    </div>
                  </div>

                  {/* Endpoint Statistics */}
                  {Object.keys(usageData.statistics.endpointStats).length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Endpoint Statistics</h4>
                      <div className="space-y-2">
                        {Object.entries(usageData.statistics.endpointStats).map(([endpoint, stats]: [string, any]) => (
                          <div
                            key={endpoint}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <div className="font-medium text-gray-900">{endpoint}</div>
                              <div className="text-sm text-gray-500">
                                {stats.count} requests
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              Avg: {stats.avgTime}ms
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Usage Logs */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Recent Requests</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">Time</th>
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">Endpoint</th>
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">Method</th>
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">Status</th>
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">Response Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {usageData.usage.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                No usage data yet
                              </td>
                            </tr>
                          ) : (
                            usageData.usage.map((log: any) => (
                              <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-600">
                                  {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-gray-900 font-mono text-xs">
                                  {log.endpoint}
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                    {log.method}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  {log.status_code ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs ${
                                        log.status_code >= 200 && log.status_code < 300
                                          ? 'bg-green-100 text-green-700'
                                          : log.status_code >= 400
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}
                                    >
                                      {log.status_code}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                  {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
