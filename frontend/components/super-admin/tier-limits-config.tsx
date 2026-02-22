'use client';

import { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Loader2, Save, RotateCcw, Infinity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import {
  adminApi,
  type AllTierLimitsResponse,
  type SingleTierLimitsResponse,
} from '@/lib/api';

type TierName = 'free' | 'pro' | 'enterprise';
type NumericField = 'queriesPerMonth' | 'tavilySearchesPerMonth' | 'maxCollections';

const TIER_LABELS: Record<TierName, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const TIER_COLORS: Record<TierName, string> = {
  free: 'border-gray-200 bg-gray-50',
  pro: 'border-orange-200 bg-orange-50',
  enterprise: 'border-purple-200 bg-purple-50',
};

const LIMIT_LABELS: Record<string, { label: string; description: string }> = {
  queriesPerMonth: {
    label: 'Queries / month',
    description: 'Maximum AI queries per billing cycle',
  },
  tavilySearchesPerMonth: {
    label: 'Web searches / month',
    description: 'Maximum Tavily web searches per cycle',
  },
  maxCollections: {
    label: 'Max collections',
    description: 'Maximum document collections',
  },
  allowResearchMode: {
    label: 'Research mode',
    description: 'Allow access to multi-step research mode',
  },
};

const NUMERIC_FIELDS: NumericField[] = [
  'queriesPerMonth',
  'tavilySearchesPerMonth',
  'maxCollections',
];

export default function TierLimitsConfig() {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState<TierName | null>(null);
  const [config, setConfig] = useState<AllTierLimitsResponse | null>(null);
  const [draft, setDraft] = useState<AllTierLimitsResponse | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTierLimits();
      if (res.success && res.data) {
        setConfig(res.data);
        setDraft(structuredClone(res.data));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to load tier limits';
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleNumericChange = (
    tier: TierName,
    field: NumericField,
    value: string,
    unlimited: boolean,
  ) => {
    if (!draft) return;
    let parsed: number | null;
    if (unlimited) {
      parsed = null;
    } else {
      parsed = value === '' ? 0 : parseInt(value, 10);
      if (isNaN(parsed) || parsed < 0) return;
    }
    setDraft({
      ...draft,
      [tier]: { ...draft[tier], [field]: parsed },
    });
  };

  const handleToggle = (tier: TierName) => {
    if (!draft) return;
    setDraft({
      ...draft,
      [tier]: { ...draft[tier], allowResearchMode: !draft[tier].allowResearchMode },
    });
  };

  const tierHasChanges = (tier: TierName): boolean => {
    if (!config || !draft) return false;
    return JSON.stringify(config[tier]) !== JSON.stringify(draft[tier]);
  };

  const handleSaveTier = async (tier: TierName) => {
    if (!draft) return;
    try {
      setSavingTier(tier);
      const res = await adminApi.updateTierLimits(tier, draft[tier]);
      if (res.success && res.data) {
        setConfig(res.data);
        setDraft(structuredClone(res.data));
        success(
          `${TIER_LABELS[tier]} limits updated`,
          'Changes saved successfully',
        );
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to update tier limits';
      showError(msg);
    } finally {
      setSavingTier(null);
    }
  };

  const handleResetTier = (tier: TierName) => {
    if (!config || !draft) return;
    setDraft({ ...draft, [tier]: structuredClone(config[tier]) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        <span className="ml-2 text-sm text-gray-500">Loading tier limits…</span>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Failed to load tier limits.</p>
        <Button variant="outline" className="mt-4" onClick={fetchConfig}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-orange-500" />
          Tier Limits
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure per-tier quotas and feature access. Save each tier independently.
        </p>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['free', 'pro', 'enterprise'] as const).map((tier) => {
          const changed = tierHasChanges(tier);
          const isSaving = savingTier === tier;
          return (
            <div
              key={tier}
              className={`rounded-lg border p-5 space-y-4 ${TIER_COLORS[tier]}`}
            >
              {/* Tier header */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 text-base">
                  {TIER_LABELS[tier]}
                </h4>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResetTier(tier)}
                    disabled={!changed || isSaving}
                    className="h-7 px-2 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveTier(tier)}
                    disabled={!changed || isSaving}
                    className="h-7 px-3 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              {/* Numeric limits */}
              {NUMERIC_FIELDS.map((field) => {
                const val = draft[tier][field];
                const isUnlimited = val === null;
                return (
                  <div key={field}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-600">
                        {LIMIT_LABELS[field].label}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          handleNumericChange(tier, field, '0', !isUnlimited)
                        }
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                          isUnlimited
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        title={isUnlimited ? 'Click to set a limit' : 'Click for unlimited'}
                      >
                        <Infinity className="h-3 w-3" />
                        {isUnlimited ? 'Unlimited' : 'Set unlimited'}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-1.5">
                      {LIMIT_LABELS[field].description}
                    </p>
                    {isUnlimited ? (
                      <div className="h-9 flex items-center px-3 rounded-md border border-green-200 bg-green-50 text-green-700 text-sm">
                        Unlimited
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        value={val ?? 0}
                        onChange={(e) =>
                          handleNumericChange(tier, field, e.target.value, false)
                        }
                        className="bg-white"
                      />
                    )}
                  </div>
                );
              })}

              {/* Research mode toggle */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      {LIMIT_LABELS.allowResearchMode.label}
                    </label>
                    <p className="text-[11px] text-gray-400">
                      {LIMIT_LABELS.allowResearchMode.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(tier)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      draft[tier].allowResearchMode
                        ? 'bg-orange-500'
                        : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                        draft[tier].allowResearchMode
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Comparison</h4>
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Limit</th>
                {(['free', 'pro', 'enterprise'] as const).map((t) => (
                  <th key={t} className="px-4 py-2 font-medium text-center">
                    {TIER_LABELS[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {NUMERIC_FIELDS.map((field) => (
                <tr key={field} className="border-t border-gray-100">
                  <td className="px-4 py-2">{LIMIT_LABELS[field].label}</td>
                  {(['free', 'pro', 'enterprise'] as const).map((t) => {
                    const v = draft[t][field];
                    return (
                      <td key={t} className="px-4 py-2 text-center">
                        {v === null ? (
                          <span className="text-green-600 font-medium">Unlimited</span>
                        ) : (
                          v.toLocaleString()
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-gray-100">
                <td className="px-4 py-2">Research mode</td>
                {(['free', 'pro', 'enterprise'] as const).map((t) => (
                  <td key={t} className="px-4 py-2 text-center">
                    {draft[t].allowResearchMode ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
