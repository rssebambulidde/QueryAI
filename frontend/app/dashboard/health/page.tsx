'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useHealthMonitoring } from '@/lib/hooks/use-health-monitoring';
import { SystemStatus } from '@/components/health/system-status';
import { ErrorRateDisplay } from '@/components/health/error-rate-display';
import { ThroughputMetrics } from '@/components/health/throughput-metrics';
import { ComponentPerformance } from '@/components/health/component-performance';
import { AlertSystem } from '@/components/health/alert-system';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { RefreshCw, Activity } from 'lucide-react';

export default function HealthPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { healthMetrics, systemHealth, loading, error, loadHealthMetrics } = useHealthMonitoring(true, 5000);

  // Check if user is admin/internal (pro tier or admin role)
  const isAdmin =
    user?.subscriptionTier === 'pro' ||
    user?.email?.includes('@admin') ||
    user?.email?.includes('@internal');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, isAdmin, router]);

  if (isLoading && !healthMetrics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading health metrics...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Performance Monitoring</h1>
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
    </div>
  );
}
