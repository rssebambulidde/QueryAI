/**
 * Integration: Cost tracking accuracy
 * Validates cost calculation consistency, rounding, and model resolution
 * across multiple providers (OpenAI, Anthropic, Google, Groq).
 */

import { CostTrackingService } from '../services/cost-tracking.service';

jest.mock('../services/database.service', () => ({
  DatabaseService: { logUsage: jest.fn().mockResolvedValue(true) },
}));
jest.mock('../config/database', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
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

describe('Integration: Cost tracking accuracy', () => {
  beforeEach(() => {
    CostTrackingService._resetPricingCache();
  });

  it('calculateCost roundtrip matches input tokens', () => {
    const model = 'gpt-4o-mini';
    const promptTokens = 1234;
    const completionTokens = 567;
    const r = CostTrackingService.calculateCost(model, promptTokens, completionTokens);
    expect(r.promptTokens).toBe(promptTokens);
    expect(r.completionTokens).toBe(completionTokens);
    expect(r.totalTokens).toBe(promptTokens + completionTokens);
    expect(r.inputCost).toBeGreaterThanOrEqual(0);
    expect(r.outputCost).toBeGreaterThanOrEqual(0);
    expect(r.totalCost).toBeCloseTo(r.inputCost + r.outputCost, 6);
  });

  it('model resolution produces consistent costs (case-insensitive)', () => {
    const variants = ['gpt-4o', 'GPT-4O', 'gpt-4o-mini', 'GPT-4O-MINI'];
    const base = CostTrackingService.calculateCost('gpt-4o', 1000, 500);
    for (const v of variants) {
      const r = CostTrackingService.calculateCost(v, 1000, 500);
      if (v.toLowerCase().includes('mini')) {
        expect(r.model).toBe('gpt-4o-mini');
        expect(r.totalCost).not.toBe(base.totalCost);
      } else {
        expect(r.model).toBe('gpt-4o');
        expect(r.totalCost).toBe(base.totalCost);
      }
    }
  });

  it('getCostComparison returns all models with same token inputs', () => {
    const comp = CostTrackingService.getCostComparison(2000, 1000);
    const tokens = Object.values(comp).map((c) => c.totalTokens);
    expect(tokens.every((t) => t === 3000)).toBe(true);
  });

  it('cross-provider cost comparison shows expected ordering', () => {
    const comp = CostTrackingService.getCostComparison(10000, 5000);
    // Cheapest: gemini-2.0-flash, most expensive: claude-sonnet-4
    expect(comp['gemini-2.0-flash'].totalCost).toBeLessThan(comp['gpt-4o'].totalCost);
    expect(comp['gpt-4o'].totalCost).toBeLessThan(comp['claude-sonnet-4-20250514'].totalCost);
  });
});
