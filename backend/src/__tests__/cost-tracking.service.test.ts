/**
 * Cost Tracking Service Unit Tests
 */

import { CostTrackingService } from '../services/cost-tracking.service';

const mockLogUsage = jest.fn();
const mockFrom = jest.fn();

jest.mock('../services/database.service', () => ({
  DatabaseService: {
    logUsage: (...args: unknown[]) => mockLogUsage(...args),
  },
}));

jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('CostTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('computes cost for gpt-4o-mini', () => {
      const r = CostTrackingService.calculateCost('gpt-4o-mini', 1000, 500);
      expect(r.model).toBe('gpt-4o-mini');
      expect(r.promptTokens).toBe(1000);
      expect(r.completionTokens).toBe(500);
      expect(r.totalTokens).toBe(1500);
      expect(r.inputCost).toBeGreaterThan(0);
      expect(r.outputCost).toBeGreaterThan(0);
      expect(r.totalCost).toBe(r.inputCost + r.outputCost);
    });

    it('normalizes model name variations', () => {
      const a = CostTrackingService.calculateCost('gpt-4o', 100, 50);
      const b = CostTrackingService.calculateCost('GPT-4O', 100, 50);
      expect(a.model).toBe('gpt-4o');
      expect(b.model).toBe('gpt-4o');
      expect(a.totalCost).toBe(b.totalCost);
    });

    it('uses gpt-3.5-turbo for unknown models', () => {
      const r = CostTrackingService.calculateCost('gpt-5-fake', 1000, 500);
      expect(r.model).toBe('gpt-3.5-turbo');
    });

    it('rounds costs to 6 decimal places', () => {
      const r = CostTrackingService.calculateCost('gpt-3.5-turbo', 1234, 567);
      const decimals = (n: number) => (n.toString().split('.')[1] || '').length;
      expect(decimals(r.inputCost)).toBeLessThanOrEqual(6);
      expect(decimals(r.outputCost)).toBeLessThanOrEqual(6);
      expect(decimals(r.totalCost)).toBeLessThanOrEqual(6);
    });
  });

  describe('getCostComparison', () => {
    it('returns comparison for all known models', () => {
      const comp = CostTrackingService.getCostComparison(1000, 500);
      expect(Object.keys(comp).length).toBeGreaterThan(0);
      expect(comp['gpt-4o-mini']).toBeDefined();
      expect(comp['gpt-4o']).toBeDefined();
      expect(comp['gpt-3.5-turbo']).toBeDefined();
      Object.values(comp).forEach((c) => {
        expect(c.promptTokens).toBe(1000);
        expect(c.completionTokens).toBe(500);
        expect(c.totalCost).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('trackCost', () => {
    it('calls DatabaseService.logUsage with query type and metadata', async () => {
      mockLogUsage.mockResolvedValue(true);
      await CostTrackingService.trackCost('user-1', {
        userId: 'user-1',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.001,
      });
      expect(mockLogUsage).toHaveBeenCalledWith('user-1', 'query', {
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.001,
        queryId: undefined,
      });
    });

    it('does not throw when logUsage fails', async () => {
      mockLogUsage.mockRejectedValue(new Error('DB error'));
      await expect(
        CostTrackingService.trackCost('user-1', {
          userId: 'user-1',
          model: 'gpt-4o-mini',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          cost: 0.0001,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('getUserCostStats', () => {
    it('returns zeros when no usage logs', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockFrom.mockReturnValue(chain);

      const stats = await CostTrackingService.getUserCostStats('user-1');
      expect(stats.totalCost).toBe(0);
      expect(stats.totalQueries).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.averageCostPerQuery).toBe(0);
      expect(Object.keys(stats.modelBreakdown)).toHaveLength(0);
    });

    it('aggregates cost and model breakdown from usage logs', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [
            { metadata: { cost: 0.01, model: 'gpt-4o-mini', totalTokens: 100 } },
            { metadata: { cost: 0.02, model: 'gpt-4o-mini', totalTokens: 200 } },
            { metadata: { cost: 0.05, model: 'gpt-4o', totalTokens: 500 } },
          ],
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      const stats = await CostTrackingService.getUserCostStats('user-1');
      expect(stats.totalCost).toBe(0.08);
      expect(stats.totalQueries).toBe(3);
      expect(stats.totalTokens).toBe(800);
      expect(stats.averageCostPerQuery).toBeCloseTo(0.08 / 3, 6);
      expect(stats.modelBreakdown['gpt-4o-mini'].count).toBe(2);
      expect(stats.modelBreakdown['gpt-4o-mini'].totalCost).toBe(0.03);
      expect(stats.modelBreakdown['gpt-4o'].count).toBe(1);
      expect(stats.modelBreakdown['gpt-4o'].totalCost).toBe(0.05);
    });
  });
});
