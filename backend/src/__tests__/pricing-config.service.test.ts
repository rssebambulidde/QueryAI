/**
 * PricingConfigService Unit Tests
 */

import { PricingConfigService } from '../services/pricing-config.service';

// ── Mock SystemSettingsService ───────────────────────────────────────────────

const getMock = jest.fn();
const setMock = jest.fn();

jest.mock('../services/system-settings.service', () => ({
  SystemSettingsService: {
    get: (...args: unknown[]) => getMock(...args),
    set: (...args: unknown[]) => setMock(...args),
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CONFIG = {
  tiers: {
    free: { monthly: 0, annual: 0 },
    pro: { monthly: 45, annual: 450 },
    enterprise: { monthly: 99, annual: 0 },
  },
  overage: {
    queries: 0.05,
    document_upload: 0.50,
    tavily_searches: 0.10,
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PricingConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PricingConfigService.invalidateCache();
  });

  // ── getAll ───────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns DB config when present and valid', async () => {
      getMock.mockResolvedValue(VALID_CONFIG);

      const result = await PricingConfigService.getAll();
      expect(result).toEqual(VALID_CONFIG);
      expect(getMock).toHaveBeenCalledWith('pricing_config');
    });

    it('returns fallback when DB value is null', async () => {
      getMock.mockResolvedValue(null);

      const result = await PricingConfigService.getAll();
      expect(result).toEqual(PricingConfigService.fallback);
    });

    it('returns fallback when Zod validation fails', async () => {
      getMock.mockResolvedValue({ bad: 'data' });

      const result = await PricingConfigService.getAll();
      expect(result).toEqual(PricingConfigService.fallback);
    });

    it('returns fallback when DB throws', async () => {
      getMock.mockRejectedValue(new Error('DB down'));

      const result = await PricingConfigService.getAll();
      expect(result).toEqual(PricingConfigService.fallback);
    });

    it('caches result and does not hit DB again', async () => {
      getMock.mockResolvedValue(VALID_CONFIG);

      await PricingConfigService.getAll();
      await PricingConfigService.getAll();

      expect(getMock).toHaveBeenCalledTimes(1);
    });

    it('invalidateCache forces re-fetch', async () => {
      getMock.mockResolvedValue(VALID_CONFIG);

      await PricingConfigService.getAll();
      PricingConfigService.invalidateCache();
      await PricingConfigService.getAll();

      expect(getMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── getCached ────────────────────────────────────────────────────────────

  describe('getCached', () => {
    it('returns fallback when cache is cold', () => {
      const result = PricingConfigService.getCached();
      expect(result).toEqual(PricingConfigService.fallback);
    });

    it('returns DB config after getAll warms cache', async () => {
      const custom = {
        ...VALID_CONFIG,
        tiers: { ...VALID_CONFIG.tiers, pro: { monthly: 99, annual: 990 } },
      };
      getMock.mockResolvedValue(custom);

      await PricingConfigService.getAll();
      const result = PricingConfigService.getCached();
      expect(result.tiers.pro.monthly).toBe(99);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('validates and persists valid config', async () => {
      setMock.mockResolvedValue(undefined);

      const result = await PricingConfigService.update(VALID_CONFIG, 'user-123');
      expect(result).toEqual(VALID_CONFIG);
      expect(setMock).toHaveBeenCalledWith('pricing_config', VALID_CONFIG, 'user-123');
    });

    it('throws ZodError for invalid config', async () => {
      await expect(
        PricingConfigService.update({ bad: true }, 'user-123')
      ).rejects.toThrow();

      expect(setMock).not.toHaveBeenCalled();
    });

    it('throws ZodError when tier has negative price', async () => {
      const bad = {
        ...VALID_CONFIG,
        tiers: { ...VALID_CONFIG.tiers, pro: { monthly: -5, annual: 450 } },
      };

      await expect(
        PricingConfigService.update(bad, 'user-123')
      ).rejects.toThrow();
    });

    it('updates local cache immediately after persist', async () => {
      setMock.mockResolvedValue(undefined);

      const updated = {
        ...VALID_CONFIG,
        tiers: { ...VALID_CONFIG.tiers, pro: { monthly: 55, annual: 550 } },
      };

      await PricingConfigService.update(updated, 'user-123');
      const cached = PricingConfigService.getCached();
      expect(cached.tiers.pro.monthly).toBe(55);
    });
  });

  // ── initialize ───────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('pre-warms cache without throwing', async () => {
      getMock.mockResolvedValue(VALID_CONFIG);

      await expect(PricingConfigService.initialize()).resolves.not.toThrow();
      expect(PricingConfigService.getCached()).toEqual(VALID_CONFIG);
    });

    it('does not throw when DB is unavailable', async () => {
      getMock.mockRejectedValue(new Error('DB down'));

      await expect(PricingConfigService.initialize()).resolves.not.toThrow();
    });
  });

  // ── schema ───────────────────────────────────────────────────────────────

  describe('schema', () => {
    it('accepts valid config', () => {
      const result = PricingConfigService.schema.safeParse(VALID_CONFIG);
      expect(result.success).toBe(true);
    });

    it('rejects missing tiers', () => {
      const result = PricingConfigService.schema.safeParse({ overage: VALID_CONFIG.overage });
      expect(result.success).toBe(false);
    });

    it('rejects missing overage', () => {
      const result = PricingConfigService.schema.safeParse({ tiers: VALID_CONFIG.tiers });
      expect(result.success).toBe(false);
    });
  });
});
