/**
 * useTierLimits Hook
 *
 * Fetches per-tier quota limits & feature flags from the backend
 * (`GET /api/config/tier-limits`) and exposes helpers for the
 * subscription-manager, usage-display, and feature-gate components.
 *
 * Falls back to hardcoded defaults while the fetch is in-flight or
 * on error, so callers always have usable data.
 */

'use client';

import { useEffect, useState } from 'react';
import { configApi, type AllTierLimitsResponse, type SingleTierLimitsResponse } from '@/lib/api';

type TierName = 'free' | 'pro' | 'enterprise';

// ── Hardcoded fallback (matches migration 051 seed) ─────────────────────────

const FALLBACK: AllTierLimitsResponse = {
  free: {
    queriesPerMonth: 300,
    tavilySearchesPerMonth: 10,
    maxCollections: 3,
    allowResearchMode: false,
    features: { embedding: false, analytics: false, apiAccess: false, whiteLabel: false },
  },
  pro: {
    queriesPerMonth: null,
    tavilySearchesPerMonth: 200,
    maxCollections: null,
    allowResearchMode: true,
    features: { embedding: true, analytics: true, apiAccess: true, whiteLabel: true },
  },
  enterprise: {
    queriesPerMonth: null,
    tavilySearchesPerMonth: null,
    maxCollections: null,
    allowResearchMode: true,
    features: { embedding: true, analytics: true, apiAccess: true, whiteLabel: true, teamCollaboration: true },
    maxTeamMembers: 50,
  },
};

// ── Module-level singleton cache ────────────────────────────────────────────

let cachedLimits: AllTierLimitsResponse | null = null;
let fetchPromise: Promise<AllTierLimitsResponse> | null = null;

async function fetchLimits(): Promise<AllTierLimitsResponse> {
  if (cachedLimits) return cachedLimits;
  if (fetchPromise) return fetchPromise;

  fetchPromise = configApi
    .getTierLimits()
    .then((res) => {
      if (res.success && res.data) {
        cachedLimits = res.data;
        return res.data;
      }
      return FALLBACK;
    })
    .catch(() => FALLBACK)
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseTierLimitsReturn {
  /** The full tier-limits map. */
  allLimits: AllTierLimitsResponse;
  /** True while the initial fetch is in-flight. */
  loading: boolean;
  /** Get limits for a single tier. */
  getLimits: (tier: TierName) => SingleTierLimitsResponse;
  /** Check if a tier has a specific feature. */
  hasFeature: (tier: TierName, feature: string) => boolean;
  /** Force re-fetch from backend. */
  refresh: () => Promise<void>;
}

export function useTierLimits(): UseTierLimitsReturn {
  const [allLimits, setAllLimits] = useState<AllTierLimitsResponse>(
    cachedLimits ?? FALLBACK,
  );
  const [loading, setLoading] = useState(!cachedLimits);

  useEffect(() => {
    let cancelled = false;

    fetchLimits().then((data) => {
      if (!cancelled) {
        setAllLimits(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const getLimits = (tier: TierName): SingleTierLimitsResponse =>
    allLimits[tier];

  const hasFeature = (tier: TierName, feature: string): boolean => {
    const limits = allLimits[tier];
    if (feature === 'allowResearchMode') return limits.allowResearchMode;
    return !!(limits.features as Record<string, boolean | undefined>)[feature];
  };

  const refresh = async () => {
    cachedLimits = null;
    const data = await fetchLimits();
    setAllLimits(data);
  };

  return {
    allLimits,
    loading,
    getLimits,
    hasFeature,
    refresh,
  };
}
