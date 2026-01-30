/**
 * Cache Service Unit Tests (Week 11 cost optimization)
 */

import {
  CacheKeyBuilder,
  getTieredTtl,
  getOrSet,
  warm,
  touchKeys,
  getStaleOrNull,
} from '../services/cache.service';

const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('../services/redis-cache.service', () => ({
  RedisCacheService: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('CacheKeyBuilder', () => {
  describe('hash', () => {
    it('returns deterministic base36 string', () => {
      const a = CacheKeyBuilder.hash('hello');
      const b = CacheKeyBuilder.hash('hello');
      expect(a).toBe(b);
      expect(/^[a-z0-9]+$/.test(a)).toBe(true);
    });
  });

  describe('sha256', () => {
    it('returns truncated hex', () => {
      const r = CacheKeyBuilder.sha256('test', 8);
      expect(r.length).toBe(8);
      expect(/^[0-9a-f]+$/.test(r)).toBe(true);
    });
  });

  describe('normalize', () => {
    it('lowercases, trims, collapses whitespace', () => {
      expect(CacheKeyBuilder.normalize('  Foo  Bar  ')).toBe('foo bar');
    });
  });

  describe('build', () => {
    it('joins segments with colons', () => {
      expect(CacheKeyBuilder.build('a', 'b', 'c')).toBe('a:b:c');
    });

    it('skips undefined and null', () => {
      expect(CacheKeyBuilder.build('a', undefined, 'b', null, 'c')).toBe('a:b:c');
    });

    it('hashes long segments', () => {
      const long = 'x'.repeat(250);
      const r = CacheKeyBuilder.build('p', long);
      expect(r).toMatch(/^p:[a-z0-9]+$/);
    });

    it('returns "default" when no segments', () => {
      expect(CacheKeyBuilder.build()).toBe('default');
    });
  });
});

describe('getTieredTtl', () => {
  it('returns override when provided', () => {
    expect(getTieredTtl('rag', 999)).toBe(999);
  });

  it('returns prefix-specific default', () => {
    expect(getTieredTtl('rag')).toBe(1800);
    expect(getTieredTtl('embedding')).toBe(86400);
    expect(getTieredTtl('search')).toBe(900);
  });

  it('returns 3600 for unknown prefix', () => {
    expect(getTieredTtl('unknown')).toBe(3600);
  });
});

describe('getOrSet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached value when hit', async () => {
    mockGet.mockResolvedValue({ cached: true });
    const fetcher = jest.fn().mockResolvedValue({ fresh: true });
    const r = await getOrSet('k', { prefix: 'cache' }, fetcher);
    expect(r).toEqual({ cached: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('calls fetcher and sets on miss', async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(true);
    const fetcher = jest.fn().mockResolvedValue('value');
    const r = await getOrSet('k', { prefix: 'rag' }, fetcher);
    expect(r).toBe('value');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith('k', 'value', expect.objectContaining({ prefix: 'rag', ttl: 1800 }));
  });
});

describe('warm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockResolvedValue(true);
  });

  it('runs fetchers and sets values', async () => {
    const f1 = jest.fn().mockResolvedValue('v1');
    const f2 = jest.fn().mockResolvedValue('v2');
    const { warmed, failed } = await warm([
      { key: 'k1', prefix: 'cache', fetcher: f1 },
      { key: 'k2', prefix: 'cache', fetcher: f2 },
    ]);
    expect(warmed).toBe(2);
    expect(failed).toBe(0);
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it('counts failed when fetcher throws', async () => {
    const f1 = jest.fn().mockResolvedValue('v1');
    const f2 = jest.fn().mockRejectedValue(new Error('err'));
    const { warmed, failed } = await warm([
      { key: 'k1', prefix: 'cache', fetcher: f1 },
      { key: 'k2', prefix: 'cache', fetcher: f2 },
    ]);
    expect(warmed).toBe(1);
    expect(failed).toBe(1);
  });
});

describe('touchKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns touched count when values exist', async () => {
    mockGet.mockImplementation((k: string) =>
      Promise.resolve(k === 'a' ? 'x' : null)
    );
    const r = await touchKeys([
      { key: 'a', prefix: 'p' },
      { key: 'b', prefix: 'p' },
    ]);
    expect(r.touched).toBe(1);
  });
});

describe('getStaleOrNull', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to RedisCacheService.get', async () => {
    mockGet.mockResolvedValue('stale');
    const r = await getStaleOrNull('k', { prefix: 'cache' });
    expect(r).toBe('stale');
    expect(mockGet).toHaveBeenCalledWith('k', { prefix: 'cache' });
  });
});
