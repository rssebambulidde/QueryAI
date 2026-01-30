/**
 * Subscription Service Unit Tests
 */

import { SubscriptionService, TIER_LIMITS } from '../services/subscription.service';

const mockGetUserSubscription = jest.fn();
const mockGetUserUsageCount = jest.fn();
const mockUpdateSubscription = jest.fn();

jest.mock('../services/database.service', () => ({
  DatabaseService: {
    getUserSubscription: (...args: unknown[]) => mockGetUserSubscription(...args),
    getUserUsageCount: (...args: unknown[]) => mockGetUserUsageCount(...args),
    updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
  },
}));

const mockFrom = jest.fn();
jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TIER_LIMITS', () => {
    it('defines limits for free, starter, premium, pro, enterprise', () => {
      expect(TIER_LIMITS.free).toBeDefined();
      expect(TIER_LIMITS.starter).toBeDefined();
      expect(TIER_LIMITS.premium).toBeDefined();
      expect(TIER_LIMITS.pro).toBeDefined();
      expect(TIER_LIMITS.enterprise).toBeDefined();
    });

    it('free tier has no document upload, no topics', () => {
      expect(TIER_LIMITS.free.documentUploads).toBe(0);
      expect(TIER_LIMITS.free.maxTopics).toBe(0);
      expect(TIER_LIMITS.free.features.documentUpload).toBe(false);
    });

    it('pro tier has unlimited queries and document uploads', () => {
      expect(TIER_LIMITS.pro.queriesPerMonth).toBeNull();
      expect(TIER_LIMITS.pro.documentUploads).toBeNull();
      expect(TIER_LIMITS.pro.features.apiAccess).toBe(true);
    });

    it('enterprise has teamCollaboration and maxTeamMembers', () => {
      expect(TIER_LIMITS.enterprise.features.teamCollaboration).toBe(true);
      expect(TIER_LIMITS.enterprise.maxTeamMembers).toBe(50);
    });
  });

  describe('getUserSubscriptionWithLimits', () => {
    it('returns null when user has no subscription', async () => {
      mockGetUserSubscription.mockResolvedValue(null);
      const result = await SubscriptionService.getUserSubscriptionWithLimits('user-1');
      expect(result).toBeNull();
    });

    it('returns subscription and limits when user has active subscription', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'premium',
        status: 'active',
        paypal_subscription_id: 'I-PREM',
      });
      const result = await SubscriptionService.getUserSubscriptionWithLimits('user-1');
      expect(result).not.toBeNull();
      expect(result!.subscription.tier).toBe('premium');
      expect(result!.limits.queriesPerMonth).toBe(500);
      expect(result!.limits.features.analytics).toBe(true);
    });
  });

  describe('hasFeatureAccess', () => {
    it('returns false when user has no subscription', async () => {
      mockGetUserSubscription.mockResolvedValue(null);
      const ok = await SubscriptionService.hasFeatureAccess('user-1', 'documentUpload');
      expect(ok).toBe(false);
    });

    it('returns true for feature enabled on tier', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'premium',
        status: 'active',
      });
      const ok = await SubscriptionService.hasFeatureAccess('user-1', 'analytics');
      expect(ok).toBe(true);
    });

    it('returns false for feature disabled on tier', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'starter',
        status: 'active',
      });
      const ok = await SubscriptionService.hasFeatureAccess('user-1', 'analytics');
      expect(ok).toBe(false);
    });
  });

  describe('checkQueryLimit', () => {
    it('returns allowed: false when no subscription', async () => {
      mockGetUserSubscription.mockResolvedValue(null);
      const r = await SubscriptionService.checkQueryLimit('user-1');
      expect(r.allowed).toBe(false);
      expect(r.used).toBe(0);
      expect(r.limit).toBe(0);
    });

    it('returns allowed: true, limit null for pro (unlimited)', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'pro',
        status: 'active',
      });
      const r = await SubscriptionService.checkQueryLimit('user-1');
      expect(r.allowed).toBe(true);
      expect(r.limit).toBeNull();
      expect(r.remaining).toBeNull();
      expect(mockGetUserUsageCount).not.toHaveBeenCalled();
    });

    it('returns used/remaining from usage count for limited tier', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'starter',
        status: 'active',
      });
      mockGetUserUsageCount.mockResolvedValue(40);
      const r = await SubscriptionService.checkQueryLimit('user-1');
      expect(r.used).toBe(40);
      expect(r.limit).toBe(100);
      expect(r.remaining).toBe(60);
      expect(r.allowed).toBe(true);
    });

    it('returns allowed: false when at or over limit', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'starter',
        status: 'active',
      });
      mockGetUserUsageCount.mockResolvedValue(100);
      const r = await SubscriptionService.checkQueryLimit('user-1');
      expect(r.allowed).toBe(false);
      expect(r.remaining).toBe(0);
    });
  });

  describe('checkTavilySearchLimit', () => {
    it('returns allowed: false when no subscription', async () => {
      mockGetUserSubscription.mockResolvedValue(null);
      const r = await SubscriptionService.checkTavilySearchLimit('user-1');
      expect(r.allowed).toBe(false);
    });

    it('returns allowed: true, limit null for unlimited tier', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'enterprise',
        status: 'active',
      });
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({ eq: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }) }) }),
        }),
      });
      const r = await SubscriptionService.checkTavilySearchLimit('user-1');
      expect(r.allowed).toBe(true);
      expect(r.limit).toBeNull();
    });

    it('returns used/remaining for limited tier', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'free',
        status: 'active',
      });
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lte: () =>
                  Promise.resolve({
                    data: [
                      { metadata: { usedTavily: true } },
                      { metadata: { usedTavily: true } },
                      { metadata: { usedTavily: false } },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });
      const r = await SubscriptionService.checkTavilySearchLimit('user-1');
      expect(r.used).toBe(2);
      expect(r.limit).toBe(5);
      expect(r.remaining).toBe(3);
      expect(r.allowed).toBe(true);
    });
  });

  describe('checkDocumentUploadLimit', () => {
    it('returns allowed: false when no subscription', async () => {
      mockGetUserSubscription.mockResolvedValue(null);
      const r = await SubscriptionService.checkDocumentUploadLimit('user-1');
      expect(r.allowed).toBe(false);
    });

    it('returns allowed: true, limit null for pro', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'pro',
        status: 'active',
      });
      const r = await SubscriptionService.checkDocumentUploadLimit('user-1');
      expect(r.allowed).toBe(true);
      expect(r.limit).toBeNull();
    });

    it('returns used/remaining for starter', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'starter',
        status: 'active',
      });
      mockGetUserUsageCount.mockResolvedValue(2);
      const r = await SubscriptionService.checkDocumentUploadLimit('user-1');
      expect(r.used).toBe(2);
      expect(r.limit).toBe(3);
      expect(r.remaining).toBe(1);
      expect(r.allowed).toBe(true);
    });
  });
});
