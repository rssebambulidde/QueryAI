/**
 * TierConfigService Unit Tests
 */

import { TierConfigService, type AllTierLimits, type TierName } from '../services/tier-config.service';

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

const VALID_LIMITS: AllTierLimits = {
  free: {
    queriesPerMonth: 300,
    tavilySearchesPerMonth: 10,
    maxCollections: 3,
    allowResearchMode: false,
  },
  pro: {
    queriesPerMonth: null,
    tavilySearchesPerMonth: 200,
    maxCollections: null,
    allowResearchMode: true,
  },
  enterprise: {
    queriesPerMonth: null,
    tavilySearchesPerMonth: null,
    maxCollections: null,
    allowResearchMode: true,
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TierConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TierConfigService.invalidateCache();
  });

  // ── getAllLimits ──────────────────────────────────────────────────────────

  describe('getAllLimits', () => {
    it('returns DB limits when present and valid', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);

      const result = await TierConfigService.getAllLimits();
      expect(result).toEqual(VALID_LIMITS);
      expect(getMock).toHaveBeenCalledWith('tier_limits');
    });

    it('returns fallback when DB value is null', async () => {
      getMock.mockResolvedValue(null);

      const result = await TierConfigService.getAllLimits();
      expect(result).toEqual(TierConfigService.fallback);
    });

    it('returns fallback when Zod validation fails', async () => {
      getMock.mockResolvedValue({ bad: 'data' });

      const result = await TierConfigService.getAllLimits();
      expect(result).toEqual(TierConfigService.fallback);
    });

    it('returns fallback when DB throws', async () => {
      getMock.mockRejectedValue(new Error('DB down'));

      const result = await TierConfigService.getAllLimits();
      expect(result).toEqual(TierConfigService.fallback);
    });

    it('caches result and does not hit DB again', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);

      await TierConfigService.getAllLimits();
      await TierConfigService.getAllLimits();

      expect(getMock).toHaveBeenCalledTimes(1);
    });

    it('invalidateCache forces re-fetch', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);

      await TierConfigService.getAllLimits();
      TierConfigService.invalidateCache();
      await TierConfigService.getAllLimits();

      expect(getMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── getLimits ────────────────────────────────────────────────────────────

  describe('getLimits', () => {
    it('returns limits for a specific tier', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);

      const result = await TierConfigService.getLimits('pro');
      expect(result.queriesPerMonth).toBeNull();
      expect(result.allowResearchMode).toBe(true);
    });

    it('returns free tier limits', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);

      const result = await TierConfigService.getLimits('free');
      expect(result.queriesPerMonth).toBe(300);
      expect(result.allowResearchMode).toBe(false);
    });
  });

  // ── getCached / getCachedTier ────────────────────────────────────────────

  describe('getCached', () => {
    it('returns fallback when cache is cold', () => {
      const result = TierConfigService.getCached();
      expect(result).toEqual(TierConfigService.fallback);
    });

    it('returns DB data after getAllLimits warms cache', async () => {
      const custom = {
        ...VALID_LIMITS,
        pro: { ...VALID_LIMITS.pro, queriesPerMonth: 999 },
      };
      getMock.mockResolvedValue(custom);

      await TierConfigService.getAllLimits();
      expect(TierConfigService.getCachedTier('pro').queriesPerMonth).toBe(999);
    });
  });

  // ── updateLimits ─────────────────────────────────────────────────────────

  describe('updateLimits', () => {
    it('validates and persists valid single-tier update', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);
      setMock.mockResolvedValue(undefined);

      const newPro = {
        ...VALID_LIMITS.pro,
        queriesPerMonth: 500,
      };

      const result = await TierConfigService.updateLimits('pro', newPro, 'user-1');
      expect(result.pro.queriesPerMonth).toBe(500);
      expect(setMock).toHaveBeenCalledWith(
        'tier_limits',
        expect.objectContaining({ pro: expect.objectContaining({ queriesPerMonth: 500 }) }),
        'user-1',
      );
    });

    it('throws ZodError for invalid tier limits', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);

      await expect(
        TierConfigService.updateLimits('pro', { bad: true }, 'user-1'),
      ).rejects.toThrow();

      expect(setMock).not.toHaveBeenCalled();
    });

    it('updates local cache immediately', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);
      setMock.mockResolvedValue(undefined);

      const newFree = { ...VALID_LIMITS.free, queriesPerMonth: 100 };
      await TierConfigService.updateLimits('free', newFree, 'user-1');

      expect(TierConfigService.getCachedTier('free').queriesPerMonth).toBe(100);
    });
  });

  // ── initialize ───────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('pre-warms cache without throwing', async () => {
      getMock.mockResolvedValue(VALID_LIMITS);

      await expect(TierConfigService.initialize()).resolves.not.toThrow();
      expect(TierConfigService.getCached()).toEqual(VALID_LIMITS);
    });

    it('does not throw when DB is unavailable', async () => {
      getMock.mockRejectedValue(new Error('DB down'));

      await expect(TierConfigService.initialize()).resolves.not.toThrow();
    });
  });

  // ── schema validation ────────────────────────────────────────────────────

  describe('schema', () => {
    it('accepts valid single-tier limits', () => {
      const result = TierConfigService.singleTierSchema.safeParse(VALID_LIMITS.pro);
      expect(result.success).toBe(true);
    });

    it('rejects negative queriesPerMonth', () => {
      const result = TierConfigService.singleTierSchema.safeParse({
        ...VALID_LIMITS.free,
        queriesPerMonth: -1,
      });
      expect(result.success).toBe(false);
    });

    it('accepts null queriesPerMonth (unlimited)', () => {
      const result = TierConfigService.singleTierSchema.safeParse({
        ...VALID_LIMITS.free,
        queriesPerMonth: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid full tier map', () => {
      const result = TierConfigService.allTiersSchema.safeParse(VALID_LIMITS);
      expect(result.success).toBe(true);
    });

    it('rejects missing tier in full map', () => {
      const { free, ...rest } = VALID_LIMITS;
      const result = TierConfigService.allTiersSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });
});
