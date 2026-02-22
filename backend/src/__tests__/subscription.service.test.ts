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
    it('defines limits for free, pro, enterprise', () => {
      expect(TIER_LIMITS.free).toBeDefined();
      expect(TIER_LIMITS.pro).toBeDefined();
      expect(TIER_LIMITS.enterprise).toBeDefined();
    });

    it('free tier has restricted research mode', () => {
      expect(TIER_LIMITS.free.allowResearchMode).toBe(false);
    });

    it('pro tier has unlimited queries', () => {
      expect(TIER_LIMITS.pro.queriesPerMonth).toBeNull();
      expect(TIER_LIMITS.pro.allowResearchMode).toBe(true);
    });

    it('enterprise has unlimited queries', () => {
      expect(TIER_LIMITS.enterprise.queriesPerMonth).toBeNull();
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
        tier: 'pro',
        status: 'active',
        paypal_subscription_id: 'I-PRO',
      });
      const result = await SubscriptionService.getUserSubscriptionWithLimits('user-1');
      expect(result).not.toBeNull();
      expect(result!.subscription.tier).toBe('pro');
      expect(result!.limits.queriesPerMonth).toBeNull(); // unlimited
      expect(result!.limits.allowResearchMode).toBe(true);
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
        tier: 'free',
        status: 'active',
      });
      mockGetUserUsageCount.mockResolvedValue(40);
      const r = await SubscriptionService.checkQueryLimit('user-1');
      expect(r.used).toBe(40);
      expect(r.limit).toBe(300);
      expect(r.remaining).toBe(260);
      expect(r.allowed).toBe(true);
    });

    it('returns allowed: false when at or over limit', async () => {
      mockGetUserSubscription.mockResolvedValue({
        id: 'sub-1',
        user_id: 'user-1',
        tier: 'free',
        status: 'active',
      });
      mockGetUserUsageCount.mockResolvedValue(300);
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
      expect(r.limit).toBe(10);
      expect(r.remaining).toBe(8);
      expect(r.allowed).toBe(true);
    });
  });
});
