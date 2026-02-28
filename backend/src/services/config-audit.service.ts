/**
 * Config Audit Service
 *
 * Immutable append-only log of every pricing / tier-limit change.
 * Writes to `config_audit_log` via supabaseAdmin (service-role).
 *
 * Two public entry-points:
 *  - logChange()  — called from PricingConfigService / TierConfigService
 *  - getAuditLog() — called from admin route
 */

import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export type ConfigType = 'pricing_config' | 'tier_limits';

export interface AuditLogEntry {
  id: string;
  config_type: ConfigType;
  action: string;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  changed_by: string;
  change_summary: string | null;
  created_at: string;
  /** Joined from user_profiles — only present in getAuditLog results */
  changed_by_email?: string;
}

export interface AuditLogFilters {
  config_type?: ConfigType;
  page?: number;
  limit?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a human-readable summary by diffing old vs new JSON values.
 * Keeps the summary short — lists only changed top-level keys.
 */
function buildSummary(
  configType: ConfigType,
  oldVal: Record<string, unknown>,
  newVal: Record<string, unknown>,
): string {
  if (configType === 'pricing_config') {
    return summarisePricingChange(oldVal, newVal);
  }
  return summariseTierLimitsChange(oldVal, newVal);
}

function summarisePricingChange(
  oldVal: Record<string, unknown>,
  newVal: Record<string, unknown>,
): string {
  const parts: string[] = [];

  // Compare tier pricing
  const oldTiers = (oldVal.tiers ?? {}) as Record<string, Record<string, number>>;
  const newTiers = (newVal.tiers ?? {}) as Record<string, Record<string, number>>;

  for (const tier of ['free', 'pro', 'enterprise']) {
    const ot = oldTiers[tier] ?? {};
    const nt = newTiers[tier] ?? {};
    if (ot.monthly !== nt.monthly) {
      parts.push(`${tier} monthly: $${ot.monthly ?? '?'} → $${nt.monthly ?? '?'}`);
    }
    if (ot.annual !== nt.annual) {
      parts.push(`${tier} annual: $${ot.annual ?? '?'} → $${nt.annual ?? '?'}`);
    }
  }

  // Compare overage
  const oldOv = (oldVal.overage ?? {}) as Record<string, number>;
  const newOv = (newVal.overage ?? {}) as Record<string, number>;
  for (const key of Object.keys({ ...oldOv, ...newOv })) {
    if (oldOv[key] !== newOv[key]) {
      parts.push(`overage.${key}: ${oldOv[key] ?? '?'} → ${newOv[key] ?? '?'}`);
    }
  }

  return parts.length ? parts.join('; ') : 'No visible changes';
}

function summariseTierLimitsChange(
  oldVal: Record<string, unknown>,
  newVal: Record<string, unknown>,
): string {
  const parts: string[] = [];

  for (const tier of ['free', 'pro', 'enterprise']) {
    const ot = (oldVal[tier] ?? {}) as Record<string, unknown>;
    const nt = (newVal[tier] ?? {}) as Record<string, unknown>;
    for (const key of new Set([...Object.keys(ot), ...Object.keys(nt)])) {
      const ov = ot[key];
      const nv = nt[key];
      if (JSON.stringify(ov) !== JSON.stringify(nv)) {
        parts.push(`${tier}.${key}: ${ov ?? 'null'} → ${nv ?? 'null'}`);
      }
    }
  }

  return parts.length ? parts.join('; ') : 'No visible changes';
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ConfigAuditService {
  /**
   * Append an audit entry. Fire-and-forget — errors are logged but
   * never propagated so a failed audit write doesn't block the
   * actual config update.
   */
  static async logChange(
    configType: ConfigType,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    changedBy: string,
    changeSummary?: string,
  ): Promise<void> {
    try {
      const summary =
        changeSummary ?? buildSummary(configType, oldValue, newValue);

      const { error } = await supabaseAdmin
        .from('config_audit_log')
        .insert({
          config_type: configType,
          action: 'update',
          old_value: oldValue,
          new_value: newValue,
          changed_by: changedBy,
          change_summary: summary,
        });

      if (error) {
        logger.error('ConfigAuditService.logChange insert failed', {
          error: error.message,
          configType,
          changedBy,
        });
        return;
      }

      logger.info('Config change audited', { configType, changedBy, summary });
    } catch (err) {
      logger.error('ConfigAuditService.logChange unexpected error', {
        error: (err as Error).message,
        configType,
        changedBy,
      });
    }
  }

  /**
   * Retrieve paginated audit log entries (newest first).
   * Optionally filtered by config_type.
   */
  static async getAuditLog(
    filters: AuditLogFilters = {},
  ): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('config_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.config_type) {
      query = query.eq('config_type', filters.config_type);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error('ConfigAuditService.getAuditLog query failed', {
        error: error.message,
      });
      throw new Error('Failed to retrieve audit log');
    }

    // Enrich with email from user_profiles
    const entries: AuditLogEntry[] = (data ?? []) as AuditLogEntry[];

    if (entries.length > 0) {
      const userIds = [...new Set(entries.map((e) => e.changed_by))];
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email')
        .in('id', userIds);

      if (profiles) {
        const emailMap = new Map(profiles.map((p: { id: string; email: string }) => [p.id, p.email]));
        for (const entry of entries) {
          entry.changed_by_email = emailMap.get(entry.changed_by) ?? undefined;
        }
      }
    }

    return { entries, total: count ?? 0 };
  }
}
