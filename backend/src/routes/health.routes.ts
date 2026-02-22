/**
 * Health Monitoring Routes
 * Provides /api/health/* endpoints consumed by the admin Performance Monitoring dashboard.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/authorization.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { checkDatabaseHealth } from '../config/database';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { LatencyTrackerService, OperationType } from '../services/latency-tracker.service';
import { ErrorTrackerService } from '../services/error-tracker.service';
import logger from '../config/logger';

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────

/** Check a single component and return a standard ComponentHealth object. */
async function probeComponent(
  name: string,
  probeFn: () => Promise<{ ok: boolean; latency?: number; details?: Record<string, any> }>,
): Promise<{
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency?: number;
  errorRate?: number;
  lastChecked: string;
  details?: Record<string, any>;
}> {
  const start = Date.now();
  try {
    const result = await probeFn();
    const latency = result.latency ?? (Date.now() - start);
    return {
      name,
      status: result.ok ? (latency > 2000 ? 'degraded' : 'healthy') : 'down',
      latency,
      lastChecked: new Date().toISOString(),
      details: result.details,
    };
  } catch (err: any) {
    return {
      name,
      status: 'down',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
      details: { error: err.message },
    };
  }
}

/** Derive overall status from component statuses. */
function deriveOverall(
  components: Array<{ status: string }>,
): 'healthy' | 'degraded' | 'down' {
  if (components.every((c) => c.status === 'healthy')) return 'healthy';
  if (components.some((c) => c.status === 'down')) return 'degraded';
  return 'degraded';
}

// ── GET /api/health/metrics  (combined dashboard payload) ──────────────────

router.get(
  '/metrics',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // ── 1. System health (parallel probes) ─────────────────────────────
    const [dbHealth, cacheHealth] = await Promise.all([
      probeComponent('Database', async () => {
        const h = await checkDatabaseHealth();
        return { ok: h.connected };
      }),
      probeComponent('Cache (Redis)', async () => {
        const { RedisCacheService } = await import('../services/redis-cache.service');
        const h = await RedisCacheService.healthCheck();
        return { ok: h.healthy, details: { configured: h.configured } };
      }),
    ]);

    // Circuit breakers → component summaries
    const cbHealth = CircuitBreakerService.healthCheck();
    const cbComponent = {
      name: 'Circuit Breakers',
      status: cbHealth.healthy ? 'healthy' as const : 'degraded' as const,
      lastChecked: now.toISOString(),
      details: cbHealth.circuits,
    };

    const components = [dbHealth, cacheHealth, cbComponent];
    const systemHealth = {
      overall: deriveOverall(components),
      components,
      timestamp: now.toISOString(),
    };

    // ── 2. Latency stats (last 1 h) ───────────────────────────────────
    let responseTime = { current: 0, average: 0, p95: 0, p99: 0, trend: [] as any[] };
    try {
      const stats = await LatencyTrackerService.getLatencyStats({
        startDate: oneHourAgo,
        endDate: now.toISOString(),
      });
      if (stats.length > 0) {
        // Aggregate across operation types
        const totalOps = stats.reduce((s, st) => s + st.count, 0);
        const weightedAvg = totalOps > 0
          ? stats.reduce((s, st) => s + st.averageLatency * st.count, 0) / totalOps
          : 0;
        const maxP95 = Math.max(...stats.map((s) => s.p95 ?? 0), 0);
        const maxP99 = Math.max(...stats.map((s) => s.p99 ?? 0), 0);
        responseTime = {
          current: stats[0]?.averageLatency ?? 0,
          average: Math.round(weightedAvg),
          p95: Math.round(maxP95),
          p99: Math.round(maxP99),
          trend: stats.map((s) => ({
            timestamp: new Date().toISOString(),
            responseTime: s.averageLatency,
            component: s.operationType,
          })),
        };
      }
    } catch (err) {
      logger.warn('Failed to fetch latency stats for health metrics', err);
    }

    // ── 3. Error rate (last 24 h) ─────────────────────────────────────
    let errorRate = { current: 0, average: 0, trend: [] as any[], breakdown: {} as Record<string, number> };
    try {
      const stats = await ErrorTrackerService.getErrorStats({
        startDate: oneDayAgo,
        endDate: now.toISOString(),
      });
      if (stats.length > 0) {
        const totalErrors = stats.reduce((s, st) => s + st.count, 0);
        const avgRate = stats.reduce((s, st) => s + st.errorRate, 0) / stats.length;
        const breakdown: Record<string, number> = {};
        stats.forEach((st) => {
          breakdown[st.errorCategory] = (breakdown[st.errorCategory] || 0) + st.count;
        });
        errorRate = {
          current: stats[0]?.errorRate ?? 0,
          average: Math.round(avgRate * 100) / 100,
          trend: stats.map((st) => ({
            timestamp: new Date().toISOString(),
            errorRate: st.errorRate,
            errorCount: st.count,
            totalRequests: 0,
          })),
          breakdown,
        };
      }
    } catch (err) {
      logger.warn('Failed to fetch error stats for health metrics', err);
    }

    // ── 4. Throughput (stub — real values require request-counter middleware) ─
    const throughput = {
      current: 0,
      average: 0,
      concurrent: 0,
      trend: [] as any[],
    };

    // ── 5. Component performance breakdown ────────────────────────────
    let componentPerformance: any[] = [];
    try {
      const stats = await LatencyTrackerService.getLatencyStats({
        startDate: oneDayAgo,
        endDate: now.toISOString(),
      });
      componentPerformance = stats.map((s) => ({
        component: s.operationType,
        averageLatency: Math.round(s.averageLatency),
        p50Latency: Math.round(s.p50 ?? s.averageLatency),
        p95Latency: Math.round(s.p95 ?? 0),
        p99Latency: Math.round(s.p99 ?? 0),
        errorRate: s.errorRate ?? 0,
        throughput: s.count / 24, // rough req/h → req/s approx
      }));
    } catch (err) {
      logger.warn('Failed to fetch component performance for health metrics', err);
    }

    res.json({
      success: true,
      data: {
        systemHealth,
        responseTime,
        errorRate,
        throughput,
        componentPerformance,
      },
    });
  }),
);

// ── GET /api/health/system ─────────────────────────────────────────────────

router.get(
  '/system',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const dbHealth = await probeComponent('Database', async () => {
      const h = await checkDatabaseHealth();
      return { ok: h.connected };
    });
    const cbHealth = CircuitBreakerService.healthCheck();
    const components = [
      dbHealth,
      {
        name: 'Circuit Breakers',
        status: cbHealth.healthy ? 'healthy' as const : 'degraded' as const,
        lastChecked: new Date().toISOString(),
        details: cbHealth.circuits,
      },
    ];
    res.json({
      success: true,
      data: {
        overall: deriveOverall(components),
        components,
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

// ── Alerts (minimal stub so the UI doesn't 404) ───────────────────────────

router.get(
  '/alerts',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: { alerts: [], total: 0 } });
  }),
);

router.get(
  '/alert-configurations',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: { configurations: [] } });
  }),
);

export default router;
