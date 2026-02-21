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

// Mock ProviderRegistry with multi-provider model catalogues
jest.mock('../providers/provider-registry', () => ({
  ProviderRegistry: {
    listProviders: jest.fn().mockReturnValue([
      {
        id: 'openai',
        displayName: 'OpenAI',
        models: [
          { id: 'gpt-4o-mini', inputCostPer1M: 0.15, outputCostPer1M: 0.60 },
          { id: 'gpt-4o', inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
          { id: 'gpt-3.5-turbo', inputCostPer1M: 0.50, outputCostPer1M: 1.50 },
        ],
        configured: true,
      },
      {
        id: 'anthropic',
        displayName: 'Anthropic',
        models: [
          { id: 'claude-sonnet-4-20250514', inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
          { id: 'claude-3-5-haiku-20241022', inputCostPer1M: 0.80, outputCostPer1M: 4.00 },
        ],
        configured: true,
      },
      {
        id: 'google',
        displayName: 'Google',
        models: [
          { id: 'gemini-2.0-flash', inputCostPer1M: 0.10, outputCostPer1M: 0.40 },
        ],
        configured: true,
      },
      {
        id: 'groq',
        displayName: 'Groq',
        models: [
          { id: 'llama-3.3-70b-versatile', inputCostPer1M: 0.59, outputCostPer1M: 0.79 },
        ],
        configured: true,
      },
    ]),
  },
}));

describe('CostTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CostTrackingService._resetPricingCache();
  });

  describe('calculateCost', () => {
    it('computes cost for gpt-4o-mini', () => {
      const r = CostTrackingService.calculateCost('gpt-4o-mini', 1000, 500);
      expect(r.model).toBe('gpt-4o-mini');
      expect(r.promptTokens).toBe(1000);
      expect(r.completionTokens).toBe(500);
      expect(r.totalTokens).toBe(1500);
      // (1000/1M)*0.15 = 0.00015, (500/1M)*0.60 = 0.0003
      expect(r.inputCost).toBe(0.00015);
      expect(r.outputCost).toBe(0.0003);
      expect(r.totalCost).toBe(0.00045);
    });

    it('normalizes model name variations (case-insensitive)', () => {
      const a = CostTrackingService.calculateCost('gpt-4o', 100, 50);
      const b = CostTrackingService.calculateCost('GPT-4O', 100, 50);
      expect(a.model).toBe('gpt-4o');
      expect(b.model).toBe('gpt-4o');
      expect(a.totalCost).toBe(b.totalCost);
    });

    it('resolves versioned model names via prefix match', () => {
      const r = CostTrackingService.calculateCost('gpt-4o-2024-08-06', 1000, 500);
      expect(r.model).toBe('gpt-4o');
      // Uses gpt-4o pricing: (1000/1M)*2.50 + (500/1M)*10.00
      expect(r.inputCost).toBe(0.0025);
      expect(r.outputCost).toBe(0.005);
    });

    it('prefers longest prefix (gpt-4o-mini over gpt-4o)', () => {
      const r = CostTrackingService.calculateCost('gpt-4o-mini-2024-07-18', 1000, 500);
      expect(r.model).toBe('gpt-4o-mini');
      expect(r.inputCost).toBe(0.00015);
    });

    it('computes cost for Anthropic model', () => {
      const r = CostTrackingService.calculateCost('claude-sonnet-4-20250514', 2000, 1000);
      expect(r.model).toBe('claude-sonnet-4-20250514');
      // (2000/1M)*3.00 = 0.006, (1000/1M)*15.00 = 0.015
      expect(r.inputCost).toBe(0.006);
      expect(r.outputCost).toBe(0.015);
      expect(r.totalCost).toBe(0.021);
    });

    it('computes cost for Google model', () => {
      const r = CostTrackingService.calculateCost('gemini-2.0-flash', 5000, 2000);
      expect(r.model).toBe('gemini-2.0-flash');
      // (5000/1M)*0.10 = 0.0005, (2000/1M)*0.40 = 0.0008
      expect(r.inputCost).toBe(0.0005);
      expect(r.outputCost).toBe(0.0008);
      expect(r.totalCost).toBe(0.0013);
    });

    it('computes cost for Groq model', () => {
      const r = CostTrackingService.calculateCost('llama-3.3-70b-versatile', 1000, 500);
      expect(r.model).toBe('llama-3.3-70b-versatile');
      // (1000/1M)*0.59 = 0.00059, (500/1M)*0.79 = 0.000395
      expect(r.inputCost).toBe(0.00059);
      expect(r.outputCost).toBe(0.000395);
    });

    it('uses fallback pricing for unknown models', () => {
      const r = CostTrackingService.calculateCost('totally-unknown-model', 1000, 500);
      expect(r.model).toBe('totally-unknown-model');
      // Fallback: (1000/1M)*0.15 + (500/1M)*0.60
      expect(r.inputCost).toBe(0.00015);
      expect(r.outputCost).toBe(0.0003);
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
    it('returns comparison for all models from all providers', () => {
      const comp = CostTrackingService.getCostComparison(1000, 500);
      // 7 models across 4 providers in our mock
      expect(Object.keys(comp).length).toBe(7);
      // OpenAI models
      expect(comp['gpt-4o-mini']).toBeDefined();
      expect(comp['gpt-4o']).toBeDefined();
      expect(comp['gpt-3.5-turbo']).toBeDefined();
      // Anthropic
      expect(comp['claude-sonnet-4-20250514']).toBeDefined();
      expect(comp['claude-3-5-haiku-20241022']).toBeDefined();
      // Google
      expect(comp['gemini-2.0-flash']).toBeDefined();
      // Groq
      expect(comp['llama-3.3-70b-versatile']).toBeDefined();

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
            { metadata: { cost: 0.05, model: 'claude-sonnet-4-20250514', totalTokens: 500 } },
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
      expect(stats.modelBreakdown['claude-sonnet-4-20250514'].count).toBe(1);
      expect(stats.modelBreakdown['claude-sonnet-4-20250514'].totalCost).toBe(0.05);
    });
  });
});
