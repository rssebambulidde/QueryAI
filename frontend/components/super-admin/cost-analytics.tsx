'use client';

import { CostDashboard } from '@/components/analytics/cost-dashboard';

export default function CostAnalytics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">Cost Analytics</h3>
        <p className="text-sm text-gray-600 mt-1">Platform cost trends and alerts</p>
      </div>

      {/* Cost Dashboard */}
      <CostDashboard />
    </div>
  );
}
