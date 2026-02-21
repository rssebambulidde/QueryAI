/**
 * SystemSettingsService Unit Tests
 */

import { SystemSettingsService } from '../services/system-settings.service';

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

describe('SystemSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SystemSettingsService.invalidateCache();
  });

  describe('get', () => {
    it('returns parsed value from DB', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { value: { temperature: 0.7, maxTokens: 4096 } },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await SystemSettingsService.get('llm_defaults');
      expect(result).toEqual({ temperature: 0.7, maxTokens: 4096 });
      expect(mockFrom).toHaveBeenCalledWith('system_settings');
    });

    it('returns null for missing key (PGRST116)', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'not found' },
        }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await SystemSettingsService.get('nonexistent');
      expect(result).toBeNull();
    });

    it('uses cache on second call (does not hit DB again)', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { value: 'cached_value' },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      await SystemSettingsService.get('key1');
      await SystemSettingsService.get('key1');

      // from() should have been called only once
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('throws on unexpected DB error', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST500', message: 'internal error' },
        }),
      };
      mockFrom.mockReturnValue(chain);

      await expect(SystemSettingsService.get('bad')).rejects.toEqual(
        expect.objectContaining({ code: 'PGRST500' }),
      );
    });
  });

  describe('set', () => {
    it('upserts value and updates cache', async () => {
      const chain = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValue(chain);

      await SystemSettingsService.set('llm_defaults', { temperature: 1.0 }, 'user-1');

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'llm_defaults',
          value: { temperature: 1.0 },
          updated_by: 'user-1',
        }),
        { onConflict: 'key' },
      );

      // Subsequent get should return from cache without hitting DB
      mockFrom.mockClear();
      const cached = await SystemSettingsService.get('llm_defaults');
      expect(cached).toEqual({ temperature: 1.0 });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('throws on DB error', async () => {
      const chain = {
        upsert: jest.fn().mockResolvedValue({ error: { message: 'conflict' } }),
      };
      mockFrom.mockReturnValue(chain);

      await expect(
        SystemSettingsService.set('bad', {}, 'user-1'),
      ).rejects.toEqual(expect.objectContaining({ message: 'conflict' }));
    });
  });

  describe('getAll', () => {
    it('returns all settings as key-value map', async () => {
      const chain = {
        select: jest.fn().mockResolvedValue({
          data: [
            { key: 'llm_defaults', value: { temperature: 0.7 } },
            { key: 'feature_flags', value: { deepResearchEnabled: true } },
          ],
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await SystemSettingsService.getAll();
      expect(result).toEqual({
        llm_defaults: { temperature: 0.7 },
        feature_flags: { deepResearchEnabled: true },
      });
    });
  });

  describe('invalidateCache', () => {
    it('clears specific key from cache', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { value: 'v1' },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      await SystemSettingsService.get('k');
      expect(mockFrom).toHaveBeenCalledTimes(1);

      SystemSettingsService.invalidateCache('k');

      await SystemSettingsService.get('k');
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it('clears all cache when no key provided', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { value: 'v1' },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      await SystemSettingsService.get('a');
      await SystemSettingsService.get('b');
      expect(mockFrom).toHaveBeenCalledTimes(2);

      SystemSettingsService.invalidateCache();

      await SystemSettingsService.get('a');
      await SystemSettingsService.get('b');
      expect(mockFrom).toHaveBeenCalledTimes(4);
    });
  });
});
