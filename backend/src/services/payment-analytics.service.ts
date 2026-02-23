import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

// ── Types ────────────────────────────────────────────────────────

export interface MRRBreakdown {
  total: number;
  byTier: { tier: string; mrr: number; count: number }[];
}

export interface ChurnMetrics {
  churnRate: number;          // % of paid subs that cancelled in the period
  churnedCount: number;
  totalPaidStart: number;
}

export interface ARPUMetrics {
  arpu: number;               // average revenue per user (paid users only)
  totalRevenue: number;
  paidUsers: number;
}

export interface RevenueByTier {
  tier: string;
  revenue: number;
  count: number;
}

export interface ConversionFunnel {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  enterpriseUsers: number;
  conversionRate: number;     // % of total who are paid
  trialConversionRate: number; // % of trials that converted
}

export interface FailedPaymentPoint {
  date: string;
  failed: number;
  completed: number;
  failRate: number;
}

export interface RevenueTimePoint {
  date: string;
  revenue: number;
  count: number;
}

export interface PaymentAnalyticsSummary {
  mrr: MRRBreakdown;
  churn: ChurnMetrics;
  arpu: ARPUMetrics;
  revenueByTier: RevenueByTier[];
  conversionFunnel: ConversionFunnel;
  failedPaymentTrends: FailedPaymentPoint[];
  revenueTrend: RevenueTimePoint[];
}

// ── Service ──────────────────────────────────────────────────────

export class PaymentAnalyticsService {

  /**
   * Full dashboard payload — one call for the admin page.
   */
  static async getDashboard(days: number = 30): Promise<PaymentAnalyticsSummary> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const [mrr, churn, arpu, revenueByTier, conversionFunnel, failedPaymentTrends, revenueTrend] =
      await Promise.all([
        this.getMRR(),
        this.getChurn(sinceISO),
        this.getARPU(sinceISO),
        this.getRevenueByTier(sinceISO),
        this.getConversionFunnel(),
        this.getFailedPaymentTrends(sinceISO),
        this.getRevenueTrend(sinceISO),
      ]);

    return { mrr, churn, arpu, revenueByTier, conversionFunnel, failedPaymentTrends, revenueTrend };
  }

  // ── MRR ──────────────────────────────────────────────────────

  static async getMRR(): Promise<MRRBreakdown> {
    try {
      // Active paid subscriptions with their billing info
      const { data: subs, error } = await supabaseAdmin
        .from('subscriptions')
        .select('tier, billing_period, locked_price_monthly, locked_price_annual')
        .in('tier', ['pro', 'enterprise'])
        .eq('status', 'active');

      if (error) throw error;

      // Lazy-import pricing for fallback values
      const { getPricing } = await import('../constants/pricing');

      const byTierMap: Record<string, { mrr: number; count: number }> = {};
      let total = 0;

      for (const s of subs || []) {
        const tier = s.tier as string;
        let monthlyValue: number;

        if (s.billing_period === 'annual') {
          // Annual subscribers: use locked_price_annual / 12, or catalog annual / 12
          const annualPrice = s.locked_price_annual ?? getPricing(tier as 'pro' | 'enterprise', 'annual');
          monthlyValue = Number(annualPrice) / 12;
        } else {
          // Monthly subscribers
          monthlyValue = Number(s.locked_price_monthly ?? getPricing(tier as 'pro' | 'enterprise', 'monthly'));
        }

        total += monthlyValue;
        if (!byTierMap[tier]) byTierMap[tier] = { mrr: 0, count: 0 };
        byTierMap[tier].mrr += monthlyValue;
        byTierMap[tier].count += 1;
      }

      const byTier = Object.entries(byTierMap).map(([tier, v]) => ({
        tier,
        mrr: Math.round(v.mrr * 100) / 100,
        count: v.count,
      }));

      return { total: Math.round(total * 100) / 100, byTier };
    } catch (err) {
      logger.error('PaymentAnalyticsService.getMRR failed', err);
      return { total: 0, byTier: [] };
    }
  }

  // ── Churn ────────────────────────────────────────────────────

  static async getChurn(sinceISO: string): Promise<ChurnMetrics> {
    try {
      // Count cancellations in the period from subscription_history
      const { count: churnedCount, error: e1 } = await supabaseAdmin
        .from('subscription_history')
        .select('*', { count: 'exact', head: true })
        .eq('change_type', 'cancellation')
        .gte('created_at', sinceISO);

      if (e1) throw e1;

      // Total paid subscriptions at the start of the period
      // Approximate: all paid subs created before the period + those still active
      const { count: totalPaidStart, error: e2 } = await supabaseAdmin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('tier', ['pro', 'enterprise']);

      if (e2) throw e2;

      const paidBase = (totalPaidStart || 0) + (churnedCount || 0); // reconstruct start count
      const churnRate = paidBase > 0 ? ((churnedCount || 0) / paidBase) * 100 : 0;

      return {
        churnRate: Math.round(churnRate * 100) / 100,
        churnedCount: churnedCount || 0,
        totalPaidStart: paidBase,
      };
    } catch (err) {
      logger.error('PaymentAnalyticsService.getChurn failed', err);
      return { churnRate: 0, churnedCount: 0, totalPaidStart: 0 };
    }
  }

  // ── ARPU ─────────────────────────────────────────────────────

  static async getARPU(sinceISO: string): Promise<ARPUMetrics> {
    try {
      // Total completed revenue in the period
      const { data: payments, error: e1 } = await supabaseAdmin
        .from('payments')
        .select('amount, user_id')
        .eq('status', 'completed')
        .gte('completed_at', sinceISO);

      if (e1) throw e1;

      const totalRevenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const uniqueUsers = new Set((payments || []).map((p) => p.user_id));
      const paidUsers = uniqueUsers.size;
      const arpu = paidUsers > 0 ? totalRevenue / paidUsers : 0;

      return {
        arpu: Math.round(arpu * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        paidUsers,
      };
    } catch (err) {
      logger.error('PaymentAnalyticsService.getARPU failed', err);
      return { arpu: 0, totalRevenue: 0, paidUsers: 0 };
    }
  }

  // ── Revenue by tier ──────────────────────────────────────────

  static async getRevenueByTier(sinceISO: string): Promise<RevenueByTier[]> {
    try {
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('tier, amount')
        .eq('status', 'completed')
        .gte('completed_at', sinceISO);

      if (error) throw error;

      const map: Record<string, { revenue: number; count: number }> = {};
      for (const p of payments || []) {
        const t = p.tier || 'unknown';
        if (!map[t]) map[t] = { revenue: 0, count: 0 };
        map[t].revenue += Number(p.amount);
        map[t].count += 1;
      }

      return Object.entries(map).map(([tier, v]) => ({
        tier,
        revenue: Math.round(v.revenue * 100) / 100,
        count: v.count,
      }));
    } catch (err) {
      logger.error('PaymentAnalyticsService.getRevenueByTier failed', err);
      return [];
    }
  }

  // ── Conversion funnel ────────────────────────────────────────

  static async getConversionFunnel(): Promise<ConversionFunnel> {
    try {
      const { data: subs, error } = await supabaseAdmin
        .from('subscriptions')
        .select('tier, status, trial_end');

      if (error) throw error;

      const all = subs || [];
      const totalUsers = all.length;
      const freeUsers = all.filter((s) => s.tier === 'free').length;
      const proUsers = all.filter((s) => s.tier === 'pro' && s.status === 'active').length;
      const enterpriseUsers = all.filter((s) => s.tier === 'enterprise' && s.status === 'active').length;
      const paidUsers = proUsers + enterpriseUsers;

      // Trial conversion: users who had a trial_end set and are now paid
      const trialUsers = all.filter((s) => s.trial_end);
      const trialConverted = trialUsers.filter(
        (s) => (s.tier === 'pro' || s.tier === 'enterprise') && s.status === 'active'
      );
      const trialConversionRate =
        trialUsers.length > 0 ? (trialConverted.length / trialUsers.length) * 100 : 0;

      const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

      return {
        totalUsers,
        freeUsers,
        proUsers,
        enterpriseUsers,
        conversionRate: Math.round(conversionRate * 100) / 100,
        trialConversionRate: Math.round(trialConversionRate * 100) / 100,
      };
    } catch (err) {
      logger.error('PaymentAnalyticsService.getConversionFunnel failed', err);
      return {
        totalUsers: 0, freeUsers: 0, proUsers: 0, enterpriseUsers: 0,
        conversionRate: 0, trialConversionRate: 0,
      };
    }
  }

  // ── Failed payment trends ────────────────────────────────────

  static async getFailedPaymentTrends(sinceISO: string): Promise<FailedPaymentPoint[]> {
    try {
      // Get all payments in the window (completed + failed)
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('status, created_at')
        .in('status', ['completed', 'failed'])
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const map: Record<string, { failed: number; completed: number }> = {};
      for (const p of payments || []) {
        const date = p.created_at.slice(0, 10); // YYYY-MM-DD
        if (!map[date]) map[date] = { failed: 0, completed: 0 };
        if (p.status === 'failed') map[date].failed += 1;
        else map[date].completed += 1;
      }

      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          failed: v.failed,
          completed: v.completed,
          failRate: v.failed + v.completed > 0
            ? Math.round((v.failed / (v.failed + v.completed)) * 10000) / 100
            : 0,
        }));
    } catch (err) {
      logger.error('PaymentAnalyticsService.getFailedPaymentTrends failed', err);
      return [];
    }
  }

  // ── Revenue trend (daily) ────────────────────────────────────

  static async getRevenueTrend(sinceISO: string): Promise<RevenueTimePoint[]> {
    try {
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('amount, completed_at')
        .eq('status', 'completed')
        .gte('completed_at', sinceISO)
        .order('completed_at', { ascending: true });

      if (error) throw error;

      const map: Record<string, { revenue: number; count: number }> = {};
      for (const p of payments || []) {
        if (!p.completed_at) continue;
        const date = p.completed_at.slice(0, 10);
        if (!map[date]) map[date] = { revenue: 0, count: 0 };
        map[date].revenue += Number(p.amount);
        map[date].count += 1;
      }

      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          revenue: Math.round(v.revenue * 100) / 100,
          count: v.count,
        }));
    } catch (err) {
      logger.error('PaymentAnalyticsService.getRevenueTrend failed', err);
      return [];
    }
  }
}
