'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Zap,
  Settings2,
  FlaskConical,
  MessageSquare,
  ChevronDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import {
  adminApi,
  type LLMSettingsResponse,
  type LLMProviderInfo,
  type LLMProviderModel,
  type LLMModeConfig,
} from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(perMillion: number): string {
  if (perMillion < 0.1) return `$${perMillion.toFixed(4)}`;
  if (perMillion < 1) return `$${perMillion.toFixed(3)}`;
  return `$${perMillion.toFixed(2)}`;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function LLMSettings() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<LLMSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // Local editable state
  const [chatConfig, setChatConfig] = useState<LLMModeConfig>({ providerId: '', modelId: '' });
  const [researchConfig, setResearchConfig] = useState<LLMModeConfig>({ providerId: '', modelId: '' });
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  // ── Load Settings ────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getLLMSettings();
      if (res.success && res.data) {
        setSettings(res.data);
        setChatConfig(res.data.chatConfig);
        setResearchConfig(res.data.researchConfig);
        setTemperature(res.data.defaults.temperature);
        setMaxTokens(res.data.defaults.maxTokens);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to load LLM settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Save Mode Config ─────────────────────────────────────────────────────

  const handleSaveMode = async (mode: 'chat' | 'research') => {
    const config = mode === 'chat' ? chatConfig : researchConfig;
    setSaving(true);
    try {
      const res = await adminApi.updateLLMSettings(mode, config.providerId, config.modelId);
      if (res.success) {
        toast.success(`${mode === 'chat' ? 'Chat' : 'Research'} model updated`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Save Defaults ─────────────────────────────────────────────────────────

  const handleSaveDefaults = async () => {
    setSaving(true);
    try {
      const res = await adminApi.updateLLMDefaults({ temperature, maxTokens });
      if (res.success) {
        toast.success('Default parameters saved');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save defaults');
    } finally {
      setSaving(false);
    }
  };

  // ── Test Connection ───────────────────────────────────────────────────────

  const handleTest = async (providerId: string, modelId: string) => {
    setTestingProvider(providerId);
    try {
      const res = await adminApi.testLLMConnection(providerId, modelId);
      if (res.success && res.data) {
        toast.success(`${providerId} responded in ${res.data.latencyMs}ms — "${res.data.response}"`);
      } else {
        toast.error(res.error?.message || 'Test failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Connection test failed');
    } finally {
      setTestingProvider(null);
    }
  };

  // ── Provider / Model Selector ─────────────────────────────────────────────

  const getModelsForProvider = (providerId: string): LLMProviderModel[] => {
    return settings?.providers.find((p) => p.id === providerId)?.models ?? [];
  };

  const handleProviderChange = (mode: 'chat' | 'research', providerId: string) => {
    const models = getModelsForProvider(providerId);
    const defaultModel = models.find((m) => m.isDefault) || models[0];
    const newConfig = { providerId, modelId: defaultModel?.id ?? '' };
    if (mode === 'chat') setChatConfig(newConfig);
    else setResearchConfig(newConfig);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <span className="ml-2 text-gray-500">Loading LLM settings…</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-16 text-gray-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
        Failed to load settings. <button onClick={fetchSettings} className="text-orange-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Provider Status ─────────────────────────────────────────────── */}
      <Section title="Provider Status" icon={Cpu}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {settings.providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              testing={testingProvider === provider.id}
              onTest={() => {
                const defaultModel = provider.models.find((m) => m.isDefault) || provider.models[0];
                if (defaultModel) handleTest(provider.id, defaultModel.id);
              }}
            />
          ))}
        </div>
      </Section>

      {/* ── Mode Configuration ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModeCard
          title="Express Chat"
          description="Fast responses for everyday questions"
          icon={MessageSquare}
          config={chatConfig}
          providers={settings.providers}
          saving={saving}
          onProviderChange={(pid) => handleProviderChange('chat', pid)}
          onModelChange={(mid) => setChatConfig((c) => ({ ...c, modelId: mid }))}
          onSave={() => handleSaveMode('chat')}
          onTest={() => handleTest(chatConfig.providerId, chatConfig.modelId)}
          testing={testingProvider === chatConfig.providerId}
        />
        <ModeCard
          title="Deep Research"
          description="Thorough analysis with multi-hop retrieval"
          icon={FlaskConical}
          config={researchConfig}
          providers={settings.providers}
          saving={saving}
          onProviderChange={(pid) => handleProviderChange('research', pid)}
          onModelChange={(mid) => setResearchConfig((c) => ({ ...c, modelId: mid }))}
          onSave={() => handleSaveMode('research')}
          onTest={() => handleTest(researchConfig.providerId, researchConfig.modelId)}
          testing={testingProvider === researchConfig.providerId}
        />
      </div>

      {/* ── Default Parameters ──────────────────────────────────────────── */}
      <Section title="Default Parameters" icon={Settings2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature ({temperature.toFixed(1)})
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Precise (0)</span>
              <span>Creative (2)</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
            <Input
              type="number"
              min={100}
              max={128000}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 4096)}
            />
            <p className="text-xs text-gray-400 mt-1">Max output tokens per response (100–128 000)</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveDefaults} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Defaults
          </Button>
        </div>
      </Section>

      {/* ── Refresh ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchSettings}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════════

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
        <Icon className="w-5 h-5 text-orange-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProviderCard({
  provider,
  testing,
  onTest,
}: {
  provider: LLMProviderInfo;
  testing: boolean;
  onTest: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        provider.configured ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{provider.displayName}</span>
        {provider.configured ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <XCircle className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {provider.models.length} model{provider.models.length !== 1 ? 's' : ''} &middot;{' '}
        {provider.configured ? 'API key configured' : 'No API key'}
      </p>
      {provider.configured && (
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs"
          disabled={testing}
          onClick={onTest}
        >
          {testing ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <Zap className="w-3 h-3 mr-1" />
          )}
          Test connection
        </Button>
      )}
    </div>
  );
}

function ModeCard({
  title,
  description,
  icon: Icon,
  config,
  providers,
  saving,
  onProviderChange,
  onModelChange,
  onSave,
  onTest,
  testing,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  config: LLMModeConfig;
  providers: LLMProviderInfo[];
  saving: boolean;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onSave: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  const selectedProvider = providers.find((p) => p.id === config.providerId);
  const models = selectedProvider?.models ?? [];
  const selectedModel = models.find((m) => m.id === config.modelId);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5 text-orange-500" />
        <h4 className="font-semibold text-gray-900">{title}</h4>
      </div>
      <p className="text-xs text-gray-500 mb-4">{description}</p>

      {/* Provider select */}
      <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
      <div className="relative mb-3">
        <select
          value={config.providerId}
          onChange={(e) => onProviderChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500 appearance-none"
        >
          {providers
            .filter((p) => p.configured)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {/* Model select */}
      <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
      <div className="relative mb-3">
        <select
          value={config.modelId}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500 appearance-none"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName} — {formatCost(m.inputCostPer1M)} / {formatCost(m.outputCostPer1M)} per 1M
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {/* Model details */}
      {selectedModel && (
        <div className="text-xs text-gray-500 mb-4 grid grid-cols-2 gap-1">
          <span>Context: {(selectedModel.contextWindow / 1000).toFixed(0)}K</span>
          <span>Max output: {(selectedModel.maxOutputTokens / 1000).toFixed(0)}K</span>
          <span>Input: {formatCost(selectedModel.inputCostPer1M)}/1M</span>
          <span>Output: {formatCost(selectedModel.outputCostPer1M)}/1M</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={testing || !selectedProvider?.configured}
          onClick={onTest}
        >
          {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
          Test
        </Button>
      </div>
    </div>
  );
}
