'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi, LLMSettingsResponse, LLMTestResult } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, CheckCircle, XCircle, Zap, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProviderStatus {
  providerId: string;
  displayName: string;
  configured: boolean;
  activeForChat: boolean;
  activeForResearch: boolean;
  modelCount: number;
  lastTest?: LLMTestResult;
  testing: boolean;
  error?: string;
}

interface LLMProviderHealthProps {
  loading?: boolean;
}

export function LLMProviderHealth({ loading: parentLoading }: LLMProviderHealthProps) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviderData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getLLMSettings();
      if (response.success && response.data) {
        const data: LLMSettingsResponse = response.data;
        const statuses: ProviderStatus[] = data.providers.map((p) => ({
          providerId: p.id,
          displayName: p.displayName,
          configured: p.configured,
          activeForChat: data.chatConfig.providerId === p.id,
          activeForResearch: data.researchConfig.providerId === p.id,
          modelCount: p.models.length,
          testing: false,
        }));
        setProviders(statuses);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load provider data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviderData();
  }, [loadProviderData]);

  const testProvider = async (providerId: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.providerId === providerId ? { ...p, testing: true, error: undefined, lastTest: undefined } : p,
      ),
    );

    try {
      // Use the first model of the provider for testing
      const provider = providers.find((p) => p.providerId === providerId);
      if (!provider) return;

      // Get provider settings to find a model
      const settings = await adminApi.getLLMSettings();
      const providerInfo = settings.data?.providers.find((p) => p.id === providerId);
      const testModel = providerInfo?.models.find((m) => m.isDefault)?.id ?? providerInfo?.models[0]?.id;
      if (!testModel) {
        setProviders((prev) =>
          prev.map((p) =>
            p.providerId === providerId ? { ...p, testing: false, error: 'No models available' } : p,
          ),
        );
        return;
      }

      const result = await adminApi.testLLMConnection(providerId, testModel);
      if (result.success && result.data) {
        setProviders((prev) =>
          prev.map((p) =>
            p.providerId === providerId ? { ...p, testing: false, lastTest: result.data! } : p,
          ),
        );
      } else {
        const errMsg = result.error?.message || result.data?.error || 'Test failed';
        setProviders((prev) =>
          prev.map((p) =>
            p.providerId === providerId ? { ...p, testing: false, error: errMsg } : p,
          ),
        );
      }
    } catch (err: any) {
      setProviders((prev) =>
        prev.map((p) =>
          p.providerId === providerId
            ? { ...p, testing: false, error: err.message || 'Connection test failed' }
            : p,
        ),
      );
    }
  };

  const getStatusIcon = (provider: ProviderStatus) => {
    if (!provider.configured) return <XCircle className="w-4 h-4 text-gray-400" />;
    if (provider.error) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (provider.lastTest?.status === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <Activity className="w-4 h-4 text-blue-500" />;
  };

  const getStatusBadge = (provider: ProviderStatus) => {
    if (!provider.configured) return { label: 'Not Configured', color: 'bg-gray-100 text-gray-500' };
    if (provider.error) return { label: 'Error', color: 'bg-red-100 text-red-700' };
    if (provider.lastTest?.status === 'success') return { label: 'Healthy', color: 'bg-green-100 text-green-700' };
    return { label: 'Configured', color: 'bg-blue-100 text-blue-700' };
  };

  if (loading || parentLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-orange-500" />
          <h4 className="font-semibold text-gray-900">LLM Providers</h4>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" />
          <h4 className="font-semibold text-gray-900">LLM Providers</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={loadProviderData} disabled={loading}>
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {providers.map((provider) => {
          const badge = getStatusBadge(provider);
          return (
            <div
              key={provider.providerId}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg border transition-colors',
                (provider.activeForChat || provider.activeForResearch)
                  ? 'border-orange-200 bg-orange-50/50'
                  : 'border-gray-100 bg-gray-50/50',
              )}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">{getStatusIcon(provider)}</div>

              {/* Provider info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{provider.displayName}</span>
                  <span className={cn('px-1.5 py-0.5 text-xs rounded-full font-medium', badge.color)}>
                    {badge.label}
                  </span>
                  {provider.activeForChat && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">
                      Express
                    </span>
                  )}
                  {provider.activeForResearch && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">
                      Research
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{provider.modelCount} model{provider.modelCount !== 1 ? 's' : ''}</span>
                  {provider.lastTest && (
                    <>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {provider.lastTest.latencyMs}ms
                      </span>
                      <span>{provider.lastTest.tokensUsed} tokens</span>
                    </>
                  )}
                  {provider.error && (
                    <span className="text-red-500 truncate">{provider.error}</span>
                  )}
                </div>
              </div>

              {/* Test button */}
              {provider.configured && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testProvider(provider.providerId)}
                  disabled={provider.testing}
                  className="flex-shrink-0 text-xs"
                >
                  {provider.testing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Test'
                  )}
                </Button>
              )}
            </div>
          );
        })}

        {providers.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-500">
            No LLM providers configured
          </div>
        )}
      </div>
    </div>
  );
}
