'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Loader2, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { adminApi, type PricingConfigResponse } from '@/lib/api';
import { invalidatePricingCache } from '@/lib/hooks/use-pricing';

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const TIER_COLORS: Record<string, string> = {
  free: 'border-gray-200 bg-gray-50',
  pro: 'border-orange-200 bg-orange-50',
  enterprise: 'border-purple-200 bg-purple-50',
};

const OVERAGE_LABELS: Record<string, string> = {
  queries: 'Extra queries (per query)',
  document_upload: 'Document uploads (per file)',
  tavily_searches: 'Web searches (per search)',
};

export default function PricingConfig() {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PricingConfigResponse | null>(null);
  const [draft, setDraft] = useState<PricingConfigResponse | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getPricingConfig();
      if (res.success && res.data) {
        setConfig(res.data);
        setDraft(structuredClone(res.data));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to load pricing config';
      showError(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleTierChange = (
    tier: 'free' | 'pro' | 'enterprise',
    period: 'monthly' | 'annual',
    value: string,
  ) => {
    if (!draft) return;
    const num = value === '' ? 0 : parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setDraft({
      ...draft,
      tiers: {
        ...draft.tiers,
        [tier]: { ...draft.tiers[tier], [period]: num },
      },
    });
  };

  const handleOverageChange = (
    metric: 'queries' | 'document_upload' | 'tavily_searches',
    value: string,
  ) => {
    if (!draft) return;
    const num = value === '' ? 0 : parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setDraft({
      ...draft,
      overage: { ...draft.overage, [metric]: num },
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      const res = await adminApi.updatePricingConfig(draft);
      if (res.success && res.data) {
        setConfig(res.data);
        setDraft(structuredClone(res.data));
        invalidatePricingCache();
        success('Pricing updated', 'Changes saved successfully');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to update pricing';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) setDraft(structuredClone(config));
  };

  const hasChanges =
    config && draft && JSON.stringify(config) !== JSON.stringify(draft);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        <span className="ml-2 text-sm text-gray-500">Loading pricing config…</span>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Failed to load pricing configuration.</p>
        <Button variant="outline" className="mt-4" onClick={fetchConfig}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-orange-500" />
            Pricing Configuration
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage subscription prices and overage rates. Changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tier Pricing Cards */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Subscription Prices (USD)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['free', 'pro', 'enterprise'] as const).map((tier) => (
            <div
              key={tier}
              className={`rounded-lg border p-4 ${TIER_COLORS[tier]}`}
            >
              <h5 className="font-semibold text-gray-900 mb-3">
                {TIER_LABELS[tier]}
              </h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Monthly Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.tiers[tier].monthly}
                      onChange={(e) => handleTierChange(tier, 'monthly', e.target.value)}
                      className="pl-7 bg-white"
                      disabled={tier === 'free'}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Annual Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.tiers[tier].annual}
                      onChange={(e) => handleTierChange(tier, 'annual', e.target.value)}
                      className="pl-7 bg-white"
                      disabled={tier === 'free'}
                    />
                  </div>
                </div>
                {tier !== 'free' && draft.tiers[tier].annual > 0 && (
                  <p className="text-xs text-gray-500">
                    Annual savings:{' '}
                    <span className="font-medium text-green-600">
                      {Math.round(
                        ((draft.tiers[tier].monthly * 12 - draft.tiers[tier].annual) /
                          (draft.tiers[tier].monthly * 12)) *
                          100,
                      )}
                      %
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overage Rates */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Overage Rates (USD per unit)</h4>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {(['queries', 'document_upload', 'tavily_searches'] as const).map(
            (metric) => (
              <div
                key={metric}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm text-gray-700">
                  {OVERAGE_LABELS[metric]}
                </span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.overage[metric]}
                    onChange={(e) => handleOverageChange(metric, e.target.value)}
                    className="pl-7 text-right"
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Live Preview */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Preview</h4>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 font-medium">Tier</th>
                <th className="pb-2 font-medium text-right">Monthly</th>
                <th className="pb-2 font-medium text-right">Annual</th>
                <th className="pb-2 font-medium text-right">Per Month (Annual)</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {(['free', 'pro', 'enterprise'] as const).map((tier) => (
                <tr key={tier} className="border-t border-gray-200">
                  <td className="py-2 font-medium">{TIER_LABELS[tier]}</td>
                  <td className="py-2 text-right">
                    ${draft.tiers[tier].monthly.toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    {draft.tiers[tier].annual > 0
                      ? `$${draft.tiers[tier].annual.toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="py-2 text-right text-gray-500">
                    {draft.tiers[tier].annual > 0
                      ? `$${(draft.tiers[tier].annual / 12).toFixed(2)}/mo`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
