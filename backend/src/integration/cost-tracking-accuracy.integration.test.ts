/**
 * Integration: Cost tracking accuracy
 * Validates cost calculation consistency, rounding, and model normalization.
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

describe('Integration: Cost tracking accuracy', () => {
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
    expect(r.totalCost).toBe(r.inputCost + r.outputCost);
  });

  it('model normalization produces consistent costs', () => {
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
});
