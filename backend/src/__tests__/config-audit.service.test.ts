/**
 * ConfigAuditService Unit Tests
 */

import { ConfigAuditService, type ConfigType } from '../services/config-audit.service';

// ── Mock supabaseAdmin ───────────────────────────────────────────────────────

const insertMock = jest.fn();
const selectMock = jest.fn();
const inMock = jest.fn();
const eqMock = jest.fn();
const orderMock = jest.fn();
const rangeMock = jest.fn();

const profileChainable = {
  select: selectMock.mockReturnThis(),
  in: inMock,
};

const auditChainable = {
  insert: insertMock,
  select: selectMock.mockReturnThis(),
  eq: eqMock.mockReturnThis(),
  order: orderMock.mockReturnThis(),
  range: rangeMock,
};

const fromMock = jest.fn((table: string) => {
  if (table === 'config_audit_log') return auditChainable;
  if (table === 'user_profiles') return profileChainable;
  return auditChainable;
});

jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const OLD_PRICING = {
  tiers: {
    free: { monthly: 0, annual: 0 },
    pro: { monthly: 45, annual: 450 },
    enterprise: { monthly: 99, annual: 0 },
  },
  overage: { queries: 0.05, document_upload: 0.50, tavily_searches: 0.10 },
};

const NEW_PRICING = {
  tiers: {
    free: { monthly: 0, annual: 0 },
    pro: { monthly: 55, annual: 550 },
    enterprise: { monthly: 99, annual: 0 },
  },
  overage: { queries: 0.05, document_upload: 0.50, tavily_searches: 0.10 },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConfigAuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chainable returns
    selectMock.mockReturnThis();
    eqMock.mockReturnThis();
    orderMock.mockReturnThis();
  });

  // ── logChange ─────────────────────────────────────────────────────────────

  describe('logChange', () => {
    it('inserts an audit entry with auto-generated summary', async () => {
      insertMock.mockResolvedValue({ error: null });

      await ConfigAuditService.logChange(
        'pricing_config',
        OLD_PRICING,
        NEW_PRICING,
        'user-123',
      );

      expect(fromMock).toHaveBeenCalledWith('config_audit_log');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          config_type: 'pricing_config',
          action: 'update',
          old_value: OLD_PRICING,
          new_value: NEW_PRICING,
          changed_by: 'user-123',
          change_summary: expect.stringContaining('pro monthly'),
        }),
      );
    });

    it('uses custom summary when provided', async () => {
      insertMock.mockResolvedValue({ error: null });

      await ConfigAuditService.logChange(
        'tier_limits',
        { free: {} },
        { free: {} },
        'user-456',
        'Manual override',
      );

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          change_summary: 'Manual override',
        }),
      );
    });

    it('does not throw on insert error (fire-and-forget)', async () => {
      insertMock.mockResolvedValue({ error: { message: 'RLS denied' } });

      await expect(
        ConfigAuditService.logChange('pricing_config', {}, {}, 'user-1'),
      ).resolves.not.toThrow();
    });

    it('does not throw on unexpected error', async () => {
      insertMock.mockRejectedValue(new Error('network down'));

      await expect(
        ConfigAuditService.logChange('pricing_config', {}, {}, 'user-1'),
      ).resolves.not.toThrow();
    });
  });

  // ── getAuditLog ───────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    const SAMPLE_ENTRIES = [
      {
        id: 'aaa',
        config_type: 'pricing_config',
        action: 'update',
        old_value: OLD_PRICING,
        new_value: NEW_PRICING,
        changed_by: 'user-123',
        change_summary: 'pro monthly: $45 → $55',
        created_at: '2025-01-15T12:00:00Z',
      },
    ];

    it('returns paginated entries with email enrichment', async () => {
      rangeMock.mockResolvedValue({
        data: SAMPLE_ENTRIES,
        error: null,
        count: 1,
      });
      inMock.mockResolvedValue({
        data: [{ id: 'user-123', email: 'admin@test.com' }],
      });

      const result = await ConfigAuditService.getAuditLog({ page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].changed_by_email).toBe('admin@test.com');
    });

    it('applies config_type filter when provided', async () => {
      rangeMock.mockResolvedValue({ data: [], error: null, count: 0 });

      await ConfigAuditService.getAuditLog({ config_type: 'tier_limits' });

      expect(eqMock).toHaveBeenCalledWith('config_type', 'tier_limits');
    });

    it('throws when DB query fails', async () => {
      rangeMock.mockResolvedValue({
        data: null,
        error: { message: 'query error' },
        count: null,
      });

      await expect(ConfigAuditService.getAuditLog()).rejects.toThrow(
        'Failed to retrieve audit log',
      );
    });

    it('defaults to page 1 and limit 25', async () => {
      rangeMock.mockResolvedValue({ data: [], error: null, count: 0 });

      await ConfigAuditService.getAuditLog();

      expect(rangeMock).toHaveBeenCalledWith(0, 24); // offset 0, limit 25 → range(0, 24)
    });

    it('clamps limit to max 100', async () => {
      rangeMock.mockResolvedValue({ data: [], error: null, count: 0 });

      await ConfigAuditService.getAuditLog({ limit: 999 });

      expect(rangeMock).toHaveBeenCalledWith(0, 99); // limit clamped to 100
    });
  });
});
