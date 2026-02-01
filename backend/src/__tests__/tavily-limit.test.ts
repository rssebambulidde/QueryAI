/**
 * Tests for Tavily Search Limits Implementation
 * 
 * Tests the subscription-based Tavily search limit enforcement
 */

import { SubscriptionService } from '../services/subscription.service';
import { DatabaseService } from '../services/database.service';
import { RAGService } from '../services/rag.service';

// Mock dependencies
jest.mock('../services/database.service');

function thenableTavilyChain(result: { data: unknown[]; error?: unknown }) {
  const lte = jest.fn(() => Promise.resolve(result));
  const gte = jest.fn(() => ({ lte }));
  const eq2 = jest.fn(() => ({ gte }));
  const eq1 = jest.fn(() => ({ eq: eq2 }));
  const select = jest.fn(() => ({ eq: eq1 }));
  return { select, eq: eq1, eq2, gte, lte };
}

jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn(() => thenableTavilyChain({ data: [] })),
  },
}));

describe('Tavily Search Limits', () => {
  const mockUserId = 'test-user-id';
  const mockSubscription = {
    id: 'sub-123',
    user_id: mockUserId,
    tier: 'free' as const,
    status: 'active' as const,
    cancel_at_period_end: false,
    auto_renew: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('SubscriptionService.checkTavilySearchLimit', () => {
    it('should return correct limits for free tier', async () => {
      (DatabaseService.getUserSubscription as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        tier: 'free',
      });

      const limitCheck = await SubscriptionService.checkTavilySearchLimit(mockUserId);

      expect(limitCheck.limit).toBe(5);
      expect(limitCheck.allowed).toBe(true);
    });

    it('should return correct limits for premium tier', async () => {
      (DatabaseService.getUserSubscription as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        tier: 'premium',
      });

      const limitCheck = await SubscriptionService.checkTavilySearchLimit(mockUserId);

      expect(limitCheck.limit).toBe(50);
    });

    it('should return correct limits for pro tier', async () => {
      (DatabaseService.getUserSubscription as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        tier: 'pro',
      });

      const limitCheck = await SubscriptionService.checkTavilySearchLimit(mockUserId);

      expect(limitCheck.limit).toBe(200);
    });

    it('should return false when limit is exceeded', async () => {
      (DatabaseService.getUserSubscription as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        tier: 'free',
      });

      jest.spyOn(SubscriptionService, 'getTavilyUsageCount').mockResolvedValue(6);

      const limitCheck = await SubscriptionService.checkTavilySearchLimit(mockUserId);

      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.used).toBe(6);
      expect(limitCheck.remaining).toBe(0);
    });

    it('should return true when under limit', async () => {
      (DatabaseService.getUserSubscription as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        tier: 'free',
      });

      jest.spyOn(SubscriptionService, 'getTavilyUsageCount').mockResolvedValue(3);

      const limitCheck = await SubscriptionService.checkTavilySearchLimit(mockUserId);

      expect(limitCheck.allowed).toBe(true);
      expect(limitCheck.used).toBe(3);
      expect(limitCheck.remaining).toBe(2);
    });
  });

  describe('SubscriptionService.getTavilyUsageCount', () => {
    async function setupTavilyChain(data: unknown[]) {
      const { supabaseAdmin } = await import('../config/database');
      (supabaseAdmin.from as jest.Mock).mockReset();
      (supabaseAdmin.from as jest.Mock).mockReturnValue(thenableTavilyChain({ data }));
    }

    it('should return correct usage count for current month', async () => {
      const mockUsageLogs = [
        { metadata: { usedTavily: true } },
        { metadata: { usedTavily: true } },
        { metadata: { usedTavily: false } },
        { metadata: { usedTavily: true } },
      ];
      await setupTavilyChain(mockUsageLogs);

      const count = await SubscriptionService.getTavilyUsageCount(mockUserId);

      expect(count).toBe(3); // Only logs with usedTavily: true
    });

    it('should return 0 when no Tavily usage', async () => {
      await setupTavilyChain([]);

      const count = await SubscriptionService.getTavilyUsageCount(mockUserId);

      expect(count).toBe(0);
    });
  });

  describe('SubscriptionService.incrementTavilyUsage', () => {
    it('should log Tavily usage with metadata', async () => {
      const logUsageSpy = jest.spyOn(DatabaseService, 'logUsage').mockResolvedValue(true);

      await SubscriptionService.incrementTavilyUsage(mockUserId, {
        query: 'test query',
        resultCount: 5,
      });

      expect(logUsageSpy).toHaveBeenCalledWith(
        mockUserId,
        'query',
        expect.objectContaining({
          usedTavily: true,
          query: 'test query',
          resultCount: 5,
        })
      );
    });
  });

  describe('Tier Limits Configuration', () => {
    it('should have correct Tavily limits in TIER_LIMITS', () => {
      const { TIER_LIMITS } = require('../services/subscription.service');

      expect(TIER_LIMITS.free.tavilySearchesPerMonth).toBe(5);
      expect(TIER_LIMITS.premium.tavilySearchesPerMonth).toBe(50);
      expect(TIER_LIMITS.pro.tavilySearchesPerMonth).toBe(200);
    });
  });
});
