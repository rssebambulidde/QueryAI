'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Loader2, Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { adminApi, type UsageAlertThresholdConfig } from '@/lib/api';

type Metric = 'queries' | 'tavilySearches' | 'collections';

const METRIC_LABELS: Record<Metric, { label: string; description: string }> = {
  queries: {
    label: 'Queries',
    description: 'AI queries per billing cycle',
  },
  tavilySearches: {
    label: 'Web Searches',
    description: 'Tavily web searches per cycle',
  },
  collections: {
    label: 'Collections',
    description: 'Document collections count',
  },
};

const ALL_METRICS: Metric[] = ['queries', 'tavilySearches', 'collections'];

export default function UsageAlertsConfig() {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<UsageAlertThresholdConfig | null>(null);
  const [draft, setDraft] = useState<UsageAlertThresholdConfig | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsageAlertThresholds();
      if (res.success && res.data) {
        setConfig(res.data);
        setDraft(structuredClone(res.data));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to load usage alert config';
      showError(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!draft) return;

    // Validate thresholds
    const invalid = draft.thresholds.some((t) => t < 1 || t > 100 || isNaN(t));
    if (invalid) {
      showError('All thresholds must be between 1 and 100');
      return;
    }
    if (draft.thresholds.length === 0) {
      showError('At least one threshold is required');
      return;
    }
    if (draft.metrics.length === 0) {
      showError('At least one metric must be enabled');
      return;
    }

    // De-duplicate and sort thresholds
    const cleaned: UsageAlertThresholdConfig = {
      ...draft,
      thresholds: [...new Set(draft.thresholds)].sort((a, b) => a - b),
    };

    try {
      setSaving(true);
      const res = await adminApi.updateUsageAlertThresholds(cleaned);
      if (res.success && res.data) {
        setConfig(res.data);
        setDraft(structuredClone(res.data));
        success('Usage alert thresholds updated');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to save';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setDraft(structuredClone(config));
    }
  };

  const hasChanges =
    config && draft && JSON.stringify(config) !== JSON.stringify(draft);

  const addThreshold = () => {
    if (!draft) return;
    // Default to a sensible next value
    const existing = draft.thresholds;
    const next = existing.length === 0 ? 80 : Math.min(100, Math.max(...existing) + 10);
    setDraft({ ...draft, thresholds: [...existing, next] });
  };

  const removeThreshold = (index: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      thresholds: draft.thresholds.filter((_, i) => i !== index),
    });
  };

  const updateThreshold = (index: number, value: string) => {
    if (!draft) return;
    const num = value === '' ? 0 : parseInt(value, 10);
    const updated = [...draft.thresholds];
    updated[index] = num;
    setDraft({ ...draft, thresholds: updated });
  };

  const toggleMetric = (metric: Metric) => {
    if (!draft) return;
    const current = draft.metrics;
    if (current.includes(metric)) {
      setDraft({ ...draft, metrics: current.filter((m) => m !== metric) });
    } else {
      setDraft({ ...draft, metrics: [...current, metric] });
    }
  };

  const toggleEnabled = () => {
    if (!draft) return;
    setDraft({ ...draft, enabled: !draft.enabled });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load configuration.
        <button onClick={fetchConfig} className="ml-2 text-orange-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-gray-900">Usage Alert Thresholds</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Enabled toggle */}
      <div className="rounded-lg border border-gray-200 p-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900">Enable Usage Alerts</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Send email notifications when users approach their usage limits
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.enabled}
            onClick={toggleEnabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
              draft.enabled ? 'bg-orange-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                draft.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Thresholds */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Threshold Percentages</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Alert users when they reach these percentages of their limits (1–100)
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addThreshold} disabled={draft.thresholds.length >= 5}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>

        {draft.thresholds.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No thresholds configured. Click &quot;Add&quot; to create one.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {draft.thresholds.map((val, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={val || ''}
                    onChange={(e) => updateThreshold(i, e.target.value)}
                    className="w-20 pr-6 text-center text-sm"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
                <button
                  onClick={() => removeThreshold(i)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove threshold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Visual preview */}
        {draft.thresholds.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-1.5">Preview</p>
            <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-200 via-yellow-200 to-red-200" />
              {[...new Set(draft.thresholds)]
                .filter((t) => t > 0 && t <= 100)
                .sort((a, b) => a - b)
                .map((t) => (
                  <div
                    key={t}
                    className="absolute top-0 h-full w-0.5 bg-gray-700"
                    style={{ left: `${t}%` }}
                    title={`${t}%`}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 font-medium whitespace-nowrap">
                      {t}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Monitored Metrics</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Which usage metrics should trigger alerts
          </p>
        </div>
        <div className="grid gap-2">
          {ALL_METRICS.map((metric) => {
            const info = METRIC_LABELS[metric];
            const checked = draft.metrics.includes(metric);
            return (
              <label
                key={metric}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked
                    ? 'border-orange-200 bg-orange-50/60'
                    : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMetric(metric)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{info.label}</p>
                  <p className="text-xs text-gray-500">{info.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Info note */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
        <strong>How it works:</strong> A daily cron job checks every user&apos;s usage against the configured
        thresholds. When a user crosses a threshold, they receive an in-app notification and an email.
        Each threshold–metric pair fires at most once per billing period.
      </div>
    </div>
  );
}
