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
  DollarSign,
  Users,
  Calculator,
  TrendingUp,
  TrendingDown,
  Activity,
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
  type LLMUsageStats,
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

      {/* ── Cost & Profit Estimator ─────────────────────────────────────── */}
      {settings.providers.length > 0 && (
        <CostProfitEstimator providers={settings.providers} />
      )}

      {/* ── LLM Usage Monitor ───────────────────────────────────────────── */}
      <LLMUsageMonitor />

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

// ── LLM Usage Monitor ────────────────────────────────────────────────────────

function LLMUsageMonitor() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<LLMUsageStats | null>(null);
  const [days, setDays] = useState(30);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getLLMUsageStats(days);
      if (res.success && res.data) setStats(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to load usage stats');
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        className="w-full flex items-center justify-between p-6 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Activity className="w-5 h-5 text-orange-500" />
          LLM API Usage Monitor
        </h3>
        <ChevronUp className={cn('w-5 h-5 text-gray-400 transition-transform', !expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-5">
          {/* Period selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500">Period:</label>
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  days === d
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
              >
                {d}d
              </button>
            ))}
            <button onClick={fetchStats} disabled={loading} className="ml-auto text-gray-400 hover:text-gray-600">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {loading && !stats && (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading usage data…
            </div>
          )}

          {stats && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-[10px] font-medium text-blue-600 uppercase">Total Queries</p>
                  <p className="text-lg font-bold text-blue-900">{stats.totalQueries.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <p className="text-[10px] font-medium text-red-600 uppercase">Total LLM Cost</p>
                  <p className="text-lg font-bold text-red-900">${stats.totalCost.toFixed(4)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-[10px] font-medium text-purple-600 uppercase">Total Tokens</p>
                  <p className="text-lg font-bold text-purple-900">{stats.totalTokens.toLocaleString()}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-[10px] font-medium text-orange-600 uppercase">Avg Cost/Query</p>
                  <p className="text-lg font-bold text-orange-900">${stats.averageCostPerQuery.toFixed(6)}</p>
                </div>
              </div>

              {/* Daily trend mini chart (text-based bar chart) */}
              {stats.dailyTrend.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Daily Cost Trend</h4>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 overflow-x-auto">
                    <div className="flex items-end gap-[2px] h-24 min-w-[400px]">
                      {(() => {
                        const maxCost = Math.max(...stats.dailyTrend.map((d) => d.cost), 0.000001);
                        return stats.dailyTrend.map((d) => {
                          const pct = (d.cost / maxCost) * 100;
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                              <div
                                className="w-full bg-orange-400 rounded-t-sm min-h-[2px] transition-all group-hover:bg-orange-500"
                                style={{ height: `${Math.max(pct, 2)}%` }}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                                {d.date}: ${d.cost.toFixed(4)} · {d.queries} queries
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{stats.dailyTrend[0]?.date}</span>
                      <span>{stats.dailyTrend[stats.dailyTrend.length - 1]?.date}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Model breakdown table */}
              {stats.modelBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Cost by Model</h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Model</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Queries</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total Cost</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Avg Cost/Query</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total Tokens</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {stats.modelBreakdown.map((m) => {
                          const sharePct = stats.totalCost > 0 ? (m.totalCost / stats.totalCost) * 100 : 0;
                          return (
                            <tr key={m.model} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-900 font-mono text-xs">{m.model}</td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-gray-600">{m.queries.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-red-600">${m.totalCost.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-gray-600">${m.avgCostPerQuery.toFixed(6)}</td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-gray-600">{m.totalTokens.toLocaleString()}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-orange-400 rounded-full"
                                      style={{ width: `${sharePct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-gray-500 w-10 text-right">{sharePct.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {stats.totalQueries === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No LLM usage recorded in the last {days} days.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subscription pricing (must match backend constants/pricing.ts) ───────────

const SUBSCRIPTION_PRICING: Record<string, { label: string; monthlyUSD: number; queryLimit: number | null }> = {
  free:    { label: 'Free',    monthlyUSD: 0,  queryLimit: 300 },
  pro:     { label: 'Pro',     monthlyUSD: 45, queryLimit: null }, // unlimited
  enterprise: { label: 'Enterprise', monthlyUSD: 99, queryLimit: null }, // unlimited
};

// ── Cost & Profit Estimator ──────────────────────────────────────────────────

function CostProfitEstimator({ providers }: { providers: LLMProviderInfo[] }) {
  const [expanded, setExpanded] = useState(true);

  // Usage knobs
  const [totalUsers, setTotalUsers] = useState(100);
  const [avgQueriesPerUser, setAvgQueriesPerUser] = useState(30);
  const [avgInputTokens, setAvgInputTokens] = useState(1500);
  const [avgOutputTokens, setAvgOutputTokens] = useState(800);
  const [chatRatio, setChatRatio] = useState(70); // % of queries that are chat vs research

  // User distribution across tiers (percentage)
  const [tierDist, setTierDist] = useState({ free: 60, pro: 30, enterprise: 10 });

  const totalQueries = totalUsers * avgQueriesPerUser;
  const chatQueries = Math.round(totalQueries * (chatRatio / 100));
  const researchQueries = totalQueries - chatQueries;

  // Monthly subscription revenue
  const monthlyRevenue = React.useMemo(() => {
    let rev = 0;
    for (const [tier, dist] of Object.entries(tierDist)) {
      const users = Math.round(totalUsers * (dist / 100));
      rev += users * (SUBSCRIPTION_PRICING[tier]?.monthlyUSD ?? 0);
    }
    return rev;
  }, [totalUsers, tierDist]);

  // Flatten all models
  const allModels = React.useMemo(() => {
    return providers.flatMap((p) =>
      p.models.map((m) => ({
        ...m,
        providerId: p.id,
        providerName: p.displayName,
        configured: p.configured,
        modeFit: getModeFit(m),
      })),
    );
  }, [providers]);

  // Calculate cost for each model
  const estimates = React.useMemo(() => {
    return allModels.map((m) => {
      // Use the model for the mode it best fits; for 'both' split proportionally
      let queriesForModel: number;
      if (m.modeFit === 'chat') queriesForModel = chatQueries;
      else if (m.modeFit === 'research') queriesForModel = researchQueries;
      else queriesForModel = totalQueries; // 'both' — assume all queries use this model

      const inputCost = (queriesForModel * avgInputTokens / 1_000_000) * m.inputCostPer1M;
      const outputCost = (queriesForModel * avgOutputTokens / 1_000_000) * m.outputCostPer1M;
      const totalCost = inputCost + outputCost;
      const profit = monthlyRevenue - totalCost;
      const margin = monthlyRevenue > 0 ? (profit / monthlyRevenue) * 100 : -100;

      return { ...m, queriesForModel, inputCost, outputCost, totalCost, profit, margin };
    });
  }, [allModels, chatQueries, researchQueries, totalQueries, avgInputTokens, avgOutputTokens, monthlyRevenue]);

  // Sort by profit descending
  const sorted = React.useMemo(() => {
    return [...estimates].sort((a, b) => b.profit - a.profit);
  }, [estimates]);

  const updateTierDist = (tier: string, value: number) => {
    setTierDist((prev) => {
      const updated = { ...prev, [tier]: value };
      // Normalise others proportionally so total = 100
      const others = Object.keys(updated).filter((k) => k !== tier);
      const remaining = 100 - value;
      const otherSum = others.reduce((s, k) => s + (prev as any)[k], 0);
      if (otherSum > 0) {
        for (const k of others) {
          (updated as any)[k] = Math.round(((prev as any)[k] / otherSum) * remaining);
        }
      }
      // Fix rounding
      const total = Object.values(updated).reduce((s, v) => s + v, 0);
      if (total !== 100 && others.length > 0) {
        (updated as any)[others[0]] += 100 - total;
      }
      return updated;
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        className="w-full flex items-center justify-between p-6 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Calculator className="w-5 h-5 text-orange-500" />
          Cost &amp; Profit Estimator
        </h3>
        <ChevronUp className={cn('w-5 h-5 text-gray-400 transition-transform', !expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-6">
          {/* ── Usage Parameters ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <Users className="inline w-3.5 h-3.5 mr-1" />
                Total Users: {totalUsers.toLocaleString()}
              </label>
              <input type="range" min={10} max={10_000} step={10} value={totalUsers}
                onChange={(e) => setTotalUsers(Number(e.target.value))}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400"><span>10</span><span>10,000</span></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Avg Queries/User/Month: {avgQueriesPerUser}
              </label>
              <input type="range" min={1} max={200} step={1} value={avgQueriesPerUser}
                onChange={(e) => setAvgQueriesPerUser(Number(e.target.value))}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400"><span>1</span><span>200</span></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Chat / Research Split: {chatRatio}% / {100 - chatRatio}%
              </label>
              <input type="range" min={0} max={100} step={5} value={chatRatio}
                onChange={(e) => setChatRatio(Number(e.target.value))}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400"><span>All Research</span><span>All Chat</span></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Avg Input Tokens/Query: {avgInputTokens.toLocaleString()}
              </label>
              <input type="range" min={100} max={10_000} step={100} value={avgInputTokens}
                onChange={(e) => setAvgInputTokens(Number(e.target.value))}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400"><span>100</span><span>10,000</span></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Avg Output Tokens/Query: {avgOutputTokens.toLocaleString()}
              </label>
              <input type="range" min={50} max={8_000} step={50} value={avgOutputTokens}
                onChange={(e) => setAvgOutputTokens(Number(e.target.value))}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400"><span>50</span><span>8,000</span></div>
            </div>
          </div>

          {/* ── Tier Distribution ─────────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">User Tier Distribution</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(SUBSCRIPTION_PRICING).map(([tier, info]) => (
                <div key={tier} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">{info.label}</span>
                    <span className="text-[10px] text-gray-400">${info.monthlyUSD}/mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={100} step={1}
                      value={(tierDist as any)[tier]}
                      onChange={(e) => updateTierDist(tier, Number(e.target.value))}
                      className="flex-1 accent-orange-500" />
                    <span className="text-xs font-mono w-8 text-right">{(tierDist as any)[tier]}%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {Math.round(totalUsers * ((tierDist as any)[tier] / 100))} users
                    {info.queryLimit ? ` · ${info.queryLimit} q/mo` : ' · Unlimited'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Summary Cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-[10px] font-medium text-blue-600 uppercase">Total Queries/Mo</p>
              <p className="text-lg font-bold text-blue-900">{totalQueries.toLocaleString()}</p>
              <p className="text-[10px] text-blue-500">{chatQueries.toLocaleString()} chat · {researchQueries.toLocaleString()} research</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-[10px] font-medium text-green-600 uppercase">Subscription Revenue</p>
              <p className="text-lg font-bold text-green-900">${monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</p>
              <p className="text-[10px] text-green-500">${(monthlyRevenue * 12).toLocaleString()}/yr</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <p className="text-[10px] font-medium text-orange-600 uppercase">Cheapest LLM Cost</p>
              <p className="text-lg font-bold text-orange-900">
                ${sorted.length > 0 ? sorted[sorted.length - 1].totalCost.toFixed(2) : '—'}/mo
              </p>
              <p className="text-[10px] text-orange-500">{sorted.length > 0 ? sorted[sorted.length - 1].displayName : ''}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-[10px] font-medium text-purple-600 uppercase">Best Profit Margin</p>
              <p className="text-lg font-bold text-purple-900">
                {sorted.length > 0 && sorted[0].margin > 0 ? `${sorted[0].margin.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[10px] text-purple-500">{sorted.length > 0 ? sorted[0].displayName : ''}</p>
            </div>
          </div>

          {/* ── Per-Model Estimates Table ──────────────────────────────── */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Provider</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Model</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Best For</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Queries</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">LLM Cost/Mo</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Revenue/Mo</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Profit/Mo</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sorted.map((m) => {
                  const isProfit = m.profit >= 0;
                  return (
                    <tr key={`est-${m.providerId}-${m.id}`} className={cn('hover:bg-gray-50', !m.configured && 'opacity-50')}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium',
                          m.providerId === 'openai' ? 'bg-green-100 text-green-800' :
                          m.providerId === 'anthropic' ? 'bg-amber-100 text-amber-800' :
                          m.providerId === 'google' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800',
                        )}>{m.providerName}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{m.displayName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium',
                          m.modeFit === 'chat' ? 'bg-sky-100 text-sky-700' :
                          m.modeFit === 'research' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-gray-100 text-gray-700',
                        )}>{m.modeFit === 'chat' ? 'Chat' : m.modeFit === 'research' ? 'Research' : 'Both'}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-gray-600">{m.queriesForModel.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-red-600">${m.totalCost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-green-600">${monthlyRevenue.toFixed(0)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                        <span className={cn('inline-flex items-center gap-0.5', isProfit ? 'text-green-600' : 'text-red-600')}>
                          {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isProfit ? '' : '-'}${Math.abs(m.profit).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        <span className={cn(
                          'font-semibold',
                          m.margin >= 80 ? 'text-green-600' :
                          m.margin >= 50 ? 'text-green-500' :
                          m.margin >= 0 ? 'text-yellow-600' :
                          'text-red-600',
                        )}>{m.margin.toFixed(1)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footnote */}
          <p className="text-[11px] text-gray-400">
            Estimates assume each query uses one model. "Both" models show cost for all {totalQueries.toLocaleString()} queries.
            Chat-only models use {chatQueries.toLocaleString()} queries; Research-only models use {researchQueries.toLocaleString()} queries.
            Actual costs vary with prompt length, caching, and real token counts.
          </p>
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
