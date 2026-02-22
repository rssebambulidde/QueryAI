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
  ExternalLink,
  KeyRound,
  BarChart3,
  ChevronUp,
  ArrowUpDown,
  Star,
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

// Provider setup info: env var name + link to get an API key
const PROVIDER_INFO: Record<string, { envVar: string; keyUrl: string; keyLabel: string }> = {
  openai: {
    envVar: 'OPENAI_API_KEY',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'OpenAI Dashboard',
  },
  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyLabel: 'Anthropic Console',
  },
  google: {
    envVar: 'GOOGLE_AI_API_KEY',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyLabel: 'Google AI Studio',
  },
  groq: {
    envVar: 'GROQ_API_KEY',
    keyUrl: 'https://console.groq.com/keys',
    keyLabel: 'Groq Console',
  },
};

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
              info={PROVIDER_INFO[provider.id]}
              testing={testingProvider === provider.id}
              onTest={() => {
                const defaultModel = provider.models.find((m) => m.isDefault) || provider.models[0];
                if (defaultModel) handleTest(provider.id, defaultModel.id);
              }}
            />
          ))}
        </div>

        {/* API Key Setup Guide */}
        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-3">
            <KeyRound className="w-4 h-4" />
            API Key Setup
          </h4>
          <p className="text-xs text-blue-800 mb-3">
            Add each provider&apos;s API key as an environment variable in your Railway service settings
            (Service &rarr; Variables tab). The backend detects keys on startup.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-blue-700">
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 pr-4 font-medium">Variable Name</th>
                  <th className="pb-2 font-medium">Get API Key</th>
                </tr>
              </thead>
              <tbody className="text-blue-900">
                {Object.entries(PROVIDER_INFO).map(([id, info]) => (
                  <tr key={id} className="border-t border-blue-100">
                    <td className="py-2 pr-4 font-medium">{settings.providers.find(p => p.id === id)?.displayName ?? id}</td>
                    <td className="py-2 pr-4">
                      <code className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-mono">{info.envVar}</code>
                    </td>
                    <td className="py-2">
                      <a
                        href={info.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                      >
                        {info.keyLabel}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* ── Model Comparison ────────────────────────────────────────────── */}
      {settings.providers.length > 0 && (
        <ModelComparisonTable providers={settings.providers} />
      )}

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
  info,
  testing,
  onTest,
}: {
  provider: LLMProviderInfo;
  info?: { envVar: string; keyUrl: string; keyLabel: string };
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
      <p className="text-xs text-gray-500 mb-1">
        {provider.models.length} model{provider.models.length !== 1 ? 's' : ''} &middot;{' '}
        {provider.configured ? 'API key configured' : 'No API key'}
      </p>
      {info && (
        <p className="text-[11px] text-gray-400 mb-3 font-mono">
          {info.envVar}
          {!provider.configured && (
            <> &middot;{' '}
              <a
                href={info.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-700 underline inline-flex items-center gap-0.5"
              >
                Get key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </>
          )}
        </p>
      )}
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

// ── Mode recommendation helper ────────────────────────────────────────────

type ModeFit = 'chat' | 'research' | 'both';

function getModeFit(model: LLMProviderModel): ModeFit {
  const isReasoning = /^o[0-9]/.test(model.id) || model.id.includes('deepseek-r1') || model.id.includes('qwq');
  if (isReasoning) return 'research';

  const isOpus = model.id.includes('opus');
  if (isOpus) return 'research';

  // Very cheap models → chat; expensive → research; middle → both
  if (model.inputCostPer1M <= 0.20) return 'chat';
  if (model.inputCostPer1M >= 10) return 'research';
  if (model.inputCostPer1M >= 2) return 'both';
  return 'both';
}

function getCostTier(inputCost: number): 'budget' | 'standard' | 'premium' {
  if (inputCost <= 0.25) return 'budget';
  if (inputCost <= 5) return 'standard';
  return 'premium';
}

// ── Model Comparison Table ────────────────────────────────────────────────

type SortField = 'provider' | 'model' | 'context' | 'inputCost' | 'outputCost' | 'mode';

function ModelComparisonTable({ providers }: { providers: LLMProviderInfo[] }) {
  const [expanded, setExpanded] = useState(true);
  const [sortField, setSortField] = useState<SortField>('inputCost');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<string>('all');

  // Flatten all models with provider info
  const allModels = React.useMemo(() => {
    return providers.flatMap((p) =>
      p.models.map((m) => ({
        ...m,
        providerId: p.id,
        providerName: p.displayName,
        configured: p.configured,
        modeFit: getModeFit(m),
        costTier: getCostTier(m.inputCostPer1M),
      })),
    );
  }, [providers]);

  // Filter
  const filtered = React.useMemo(() => {
    let result = allModels;
    if (filterProvider !== 'all') result = result.filter((m) => m.providerId === filterProvider);
    if (filterMode !== 'all') result = result.filter((m) => m.modeFit === filterMode || m.modeFit === 'both');
    return result;
  }, [allModels, filterProvider, filterMode]);

  // Sort
  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    const dir = sortAsc ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'provider': return dir * a.providerName.localeCompare(b.providerName);
        case 'model': return dir * a.displayName.localeCompare(b.displayName);
        case 'context': return dir * (a.contextWindow - b.contextWindow);
        case 'inputCost': return dir * (a.inputCostPer1M - b.inputCostPer1M);
        case 'outputCost': return dir * (a.outputCostPer1M - b.outputCostPer1M);
        case 'mode': return dir * a.modeFit.localeCompare(b.modeFit);
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field ? (
          <ChevronUp className={cn('w-3 h-3 transition-transform', !sortAsc && 'rotate-180')} />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-gray-300" />
        )}
      </span>
    </th>
  );

  const PROVIDER_COLORS: Record<string, string> = {
    openai: 'bg-green-100 text-green-800',
    anthropic: 'bg-amber-100 text-amber-800',
    google: 'bg-blue-100 text-blue-800',
    groq: 'bg-purple-100 text-purple-800',
  };

  const MODE_LABELS: Record<ModeFit, { label: string; color: string }> = {
    chat: { label: 'Express Chat', color: 'bg-sky-100 text-sky-700' },
    research: { label: 'Deep Research', color: 'bg-indigo-100 text-indigo-700' },
    both: { label: 'Both', color: 'bg-gray-100 text-gray-700' },
  };

  const TIER_LABELS: Record<string, { label: string; color: string }> = {
    budget: { label: 'Budget', color: 'text-green-600' },
    standard: { label: 'Standard', color: 'text-yellow-600' },
    premium: { label: 'Premium', color: 'text-red-600' },
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-6 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Model Comparison
        </h3>
        <ChevronUp className={cn('w-5 h-5 text-gray-400 transition-transform', !expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Provider:</label>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="rounded-md border border-gray-300 bg-white py-1 pl-2 pr-6 text-xs shadow-sm focus:border-orange-500 focus:ring-orange-500 appearance-none"
              >
                <option value="all">All providers</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Mode:</label>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="rounded-md border border-gray-300 bg-white py-1 pl-2 pr-6 text-xs shadow-sm focus:border-orange-500 focus:ring-orange-500 appearance-none"
              >
                <option value="all">All modes</option>
                <option value="chat">Express Chat</option>
                <option value="research">Deep Research</option>
              </select>
            </div>
            <span className="text-xs text-gray-400">
              {sorted.length} of {allModels.length} models
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader field="provider">Provider</SortHeader>
                  <SortHeader field="model">Model</SortHeader>
                  <SortHeader field="context">Context</SortHeader>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Max Output</th>
                  <SortHeader field="inputCost">Input $/1M</SortHeader>
                  <SortHeader field="outputCost">Output $/1M</SortHeader>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Capabilities</th>
                  <SortHeader field="mode">Best For</SortHeader>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sorted.map((m) => {
                  const modeInfo = MODE_LABELS[m.modeFit];
                  const tierInfo = TIER_LABELS[m.costTier];
                  return (
                    <tr
                      key={`${m.providerId}-${m.id}`}
                      className={cn(
                        'hover:bg-gray-50 transition-colors',
                        !m.configured && 'opacity-50',
                      )}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium', PROVIDER_COLORS[m.providerId] || 'bg-gray-100 text-gray-700')}>
                          {m.providerName}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        {m.displayName}
                        {m.isDefault && (
                          <Star className="inline w-3 h-3 ml-1 text-orange-400 fill-orange-400" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono text-xs">
                        {m.contextWindow >= 1_000_000
                          ? `${(m.contextWindow / 1_000_000).toFixed(1)}M`
                          : `${(m.contextWindow / 1_000).toFixed(0)}K`}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono text-xs">
                        {(m.maxOutputTokens / 1_000).toFixed(0)}K
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                        <span className={tierInfo.color}>{formatCost(m.inputCostPer1M)}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                        <span className={tierInfo.color}>{formatCost(m.outputCostPer1M)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {m.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className={cn(
                                'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                                cap === 'vision'
                                  ? 'bg-pink-50 text-pink-600'
                                  : cap === 'structured_output'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-gray-50 text-gray-500',
                              )}
                            >
                              {cap === 'structured_output' ? 'JSON' : cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium', modeInfo.color)}>
                          {modeInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <span className={tierInfo.color}>{tierInfo.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-orange-400 fill-orange-400" /> Provider default
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Budget — cheapest, great for high-volume chat
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Standard — balanced cost &amp; quality
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Premium — highest quality, best for research
            </span>
            <span>Dimmed rows = provider not configured</span>
          </div>
        </div>
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
