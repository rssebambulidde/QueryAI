/**
 * Alert Service (Week 12: Monitoring & Analytics)
 * Cost alerts, profitability monitoring, and alert system.
 */

import logger from '../config/logger';
import { CostTrackingService } from './cost-tracking.service';
import { DatabaseService } from './database.service';

export type AlertType = 'cost_threshold' | 'profitability' | 'usage_spike';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  userId?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  acknowledged?: boolean;
}

export interface CostAlertConfig {
  periodCostThresholdUsd: number;
  periodDays?: number;
}

export interface ProfitabilityAlertConfig {
  minMarginPercent: number;
  periodDays?: number;
}

const alerts: Alert[] = [];
const MAX_ALERTS = 500;

function addAlert(a: Omit<Alert, 'id' | 'createdAt'>): Alert {
  const id = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const created = { ...a, id, createdAt: Date.now() };
  alerts.push(created);
  if (alerts.length > MAX_ALERTS) alerts.splice(0, alerts.length - MAX_ALERTS);
  return created;
}

/**
 * Check cost threshold for a user and optionally emit an alert.
 */
export async function checkCostAlerts(
  userId: string,
  config: CostAlertConfig
): Promise<Alert | null> {
  const days = config.periodDays ?? 30;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const stats = await CostTrackingService.getUserCostStats(userId, start, end);
  if (stats.totalCost < config.periodCostThresholdUsd) return null;

  const existing = alerts.find(
    (a) =>
      a.type === 'cost_threshold' &&
      a.userId === userId &&
      a.metadata?.periodDays === days &&
      !a.acknowledged &&
      a.createdAt > Date.now() - 24 * 60 * 60 * 1000
  );
  if (existing) return existing;

  const alert = addAlert({
    type: 'cost_threshold',
    severity: stats.totalCost >= config.periodCostThresholdUsd * 2 ? 'critical' : 'warning',
    userId,
    title: 'Cost threshold exceeded',
    message: `Query cost ($${stats.totalCost.toFixed(2)}) exceeded threshold ($${config.periodCostThresholdUsd}) over the last ${days} days.`,
    metadata: {
      totalCost: stats.totalCost,
      totalQueries: stats.totalQueries,
      periodDays: days,
      threshold: config.periodCostThresholdUsd,
    },
  });
  logger.warn('Cost alert raised', { userId, alert: alert.id, totalCost: stats.totalCost });
  return alert;
}

/**
 * Compute revenue from completed payments for a user in a period.
 */
async function getUserRevenue(userId: string, start: Date, end: Date): Promise<number> {
  const payments = await DatabaseService.getUserPayments(userId, 500);
  let sum = 0;
  for (const p of payments) {
    if (p.status !== 'completed') continue;
    const at = p.completed_at ? new Date(p.completed_at) : new Date(p.created_at);
    if (at < start || at > end) continue;
    const amount = p.amount - (p.refund_amount ?? 0);
    if (amount > 0) sum += amount;
  }
  return sum;
}

/**
 * Check profitability (revenue vs cost) for a user and optionally emit an alert.
 */
export async function checkProfitabilityAlerts(
  userId: string,
  config: ProfitabilityAlertConfig
): Promise<Alert | null> {
  const days = config.periodDays ?? 30;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const [stats, revenue] = await Promise.all([
    CostTrackingService.getUserCostStats(userId, start, end),
    getUserRevenue(userId, start, end),
  ]);

  const cost = stats.totalCost;
  const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : (cost === 0 ? 100 : 0);

  if (margin >= config.minMarginPercent) return null;

  const existing = alerts.find(
    (a) =>
      a.type === 'profitability' &&
      a.userId === userId &&
      a.metadata?.periodDays === days &&
      !a.acknowledged &&
      a.createdAt > Date.now() - 24 * 60 * 60 * 1000
  );
  if (existing) return existing;

  const alert = addAlert({
    type: 'profitability',
    severity: margin < 0 ? 'critical' : 'warning',
    userId,
    title: 'Profitability below threshold',
    message: `Margin (${margin.toFixed(1)}%) is below ${config.minMarginPercent}% over the last ${days} days. Revenue: $${revenue.toFixed(2)}, Cost: $${cost.toFixed(2)}.`,
    metadata: {
      revenue,
      cost,
      marginPercent: margin,
      periodDays: days,
      minMarginPercent: config.minMarginPercent,
    },
  });
  logger.warn('Profitability alert raised', { userId, alert: alert.id, margin });
  return alert;
}

/**
 * Get active (non-acknowledged) alerts for a user or all.
 */
export function getActiveAlerts(userId?: string): Alert[] {
  const out = alerts.filter((a) => !a.acknowledged);
  if (userId) return out.filter((a) => a.userId === userId);
  return out;
}

/**
 * Get recent alerts, optionally filtered by user.
 */
export function getRecentAlerts(limit: number, userId?: string): Alert[] {
  let list = [...alerts].sort((a, b) => b.createdAt - a.createdAt);
  if (userId) list = list.filter((a) => a.userId === userId);
  return list.slice(0, limit);
}

/**
 * Acknowledge an alert by id.
 */
export function acknowledgeAlert(id: string): boolean {
  const a = alerts.find((x) => x.id === id);
  if (!a) return false;
  a.acknowledged = true;
  return true;
}

/**
 * Run cost and profitability checks for a user (e.g. from a cron job).
 */
export async function runAlertChecks(
  userId: string,
  options?: {
    costThresholdUsd?: number;
    costPeriodDays?: number;
    minMarginPercent?: number;
    profitabilityPeriodDays?: number;
  }
): Promise<Alert[]> {
  const raised: Alert[] = [];

  if (options?.costThresholdUsd != null && options.costThresholdUsd > 0) {
    const a = await checkCostAlerts(userId, {
      periodCostThresholdUsd: options.costThresholdUsd,
      periodDays: options.costPeriodDays ?? 30,
    });
    if (a) raised.push(a);
  }

  if (options?.minMarginPercent != null) {
    const a = await checkProfitabilityAlerts(userId, {
      minMarginPercent: options.minMarginPercent,
      periodDays: options.profitabilityPeriodDays ?? 30,
    });
    if (a) raised.push(a);
  }

  return raised;
}

export default {
  checkCostAlerts,
  checkProfitabilityAlerts,
  getActiveAlerts,
  getRecentAlerts,
  acknowledgeAlert,
  runAlertChecks,
};
