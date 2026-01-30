/**
 * Integration: Cost calculation
 * trackCost → getUserCostStats roundtrip with mocked usage_logs.
 */

import { CostTrackingService } from '../services/cost-tracking.service';

const mockLogUsage = jest.fn();
jest.mock('../services/database.service', () => ({
  DatabaseService: {
    logUsage: (...args: unknown[]) => mockLogUsage(...args),
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

describe('Integration: Cost calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogUsage.mockResolvedValue(true);
  });

  it('trackCost then getUserCostStats aggregates correctly', async () => {
    const userId = 'user-cost-1';
    const model = 'gpt-4o-mini';
    const promptTokens = 100;
    const completionTokens = 50;
    const cost = CostTrackingService.calculateCost(model, promptTokens, completionTokens).totalCost;

    await CostTrackingService.trackCost(userId, {
      userId,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost,
    });
    expect(mockLogUsage).toHaveBeenCalledWith(
      userId,
      'query',
      expect.objectContaining({
        model,
        promptTokens,
        completionTokens,
        totalTokens: 150,
        cost,
      })
    );

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          {
            metadata: {
              model,
              promptTokens,
              completionTokens,
              totalTokens: 150,
              cost,
            },
          },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const stats = await CostTrackingService.getUserCostStats(userId);
    expect(stats.totalQueries).toBe(1);
    expect(stats.totalCost).toBeCloseTo(cost, 6);
    expect(stats.totalTokens).toBe(150);
    expect(stats.modelBreakdown[model].count).toBe(1);
    expect(stats.modelBreakdown[model].totalCost).toBeCloseTo(cost, 6);
  });

  it('calculateCost + getCostComparison consistency', () => {
    const promptTokens = 1000;
    const completionTokens = 500;
    const comp = CostTrackingService.getCostComparison(promptTokens, completionTokens);
    for (const [model, q] of Object.entries(comp)) {
      const single = CostTrackingService.calculateCost(model, promptTokens, completionTokens);
      expect(single.totalCost).toBe(q.totalCost);
      expect(single.totalTokens).toBe(q.totalTokens);
    }
  });
});
