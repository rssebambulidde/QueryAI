'use client';

import { useState } from 'react';
import { useHealthMonitoring } from '@/lib/hooks/use-health-monitoring';
import { SystemStatus } from '@/components/health/system-status';
import { ErrorRateDisplay } from '@/components/health/error-rate-display';
import { ThroughputMetrics } from '@/components/health/throughput-metrics';
import { ComponentPerformance } from '@/components/health/component-performance';
import { AlertSystem } from '@/components/health/alert-system';
import { LLMProviderHealth } from '@/components/health/llm-provider-health';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { RefreshCw } from 'lucide-react';

export default function HealthMonitoring() {
  const { healthMetrics, systemHealth, loading, error, loadHealthMetrics } = useHealthMonitoring(true, 5000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Performance Monitoring</h3>
          <p className="text-sm text-gray-600 mt-1">System Health & Performance Metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadHealthMetrics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <div>
            <h3 className="font-semibold mb-1">Error</h3>
            <p>{error}</p>
          </div>
        </Alert>
      )}

      {/* System Status */}
      {systemHealth && (
        <SystemStatus systemHealth={systemHealth} />
      )}

      {/* LLM Provider Health */}
      <LLMProviderHealth loading={loading} />

      {/* Main Metrics Grid */}
      {healthMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Error Rate */}
          <ErrorRateDisplay
            errorRate={healthMetrics.errorRate}
            loading={loading}
          />

          {/* Throughput Metrics */}
          <ThroughputMetrics
            throughput={healthMetrics.throughput}
            loading={loading}
          />
        </div>
      )}

      {/* Component Performance */}
      {healthMetrics && (
        <ComponentPerformance
          performance={healthMetrics.componentPerformance}
          loading={loading}
        />
      )}

      {/* Alerts */}
      <AlertSystem />
    </div>
  );
}
