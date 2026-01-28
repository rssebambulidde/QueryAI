'use client';

import React, { useState } from 'react';
import { useAlerts, useAlertConfigurations } from '@/lib/hooks/use-health-monitoring';
import { PerformanceAlert } from '@/lib/api-health';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Bell, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

export const AlertSystem: React.FC = () => {
  const { alerts, loading, acknowledgeAlert, resolveAlert, loadAlerts } = useAlerts({
    resolved: false,
  });
  const { configurations } = useAlertConfigurations();
  const [filter, setFilter] = useState<'all' | 'performance' | 'error' | 'component'>('all');
  const [severityFilter, setSeverityFilter] = useState<
    'all' | 'low' | 'medium' | 'high' | 'critical'
  >('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (filter !== 'all' && alert.type !== filter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  const getSeverityIcon = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getTypeColor = (type: PerformanceAlert['type']) => {
    switch (type) {
      case 'performance':
        return 'bg-purple-100 text-purple-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'component':
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">Alerts & Notifications</h2>
          {alerts.length > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Types</option>
            <option value="performance">Performance</option>
            <option value="error">Error</option>
            <option value="component">Component</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">No active alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border-2 rounded-lg ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{alert.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(
                          alert.type
                        )}`}
                      >
                        {alert.type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                          alert.severity
                        )}`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{alert.message}</p>
                    {alert.component && (
                      <p className="text-xs opacity-75 mt-1">
                        Component: {alert.component}
                      </p>
                    )}
                    {alert.metric && alert.value !== undefined && (
                      <p className="text-xs opacity-75 mt-1">
                        {alert.metric}: {alert.value} (threshold: {alert.threshold})
                      </p>
                    )}
                    <p className="text-xs opacity-75 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!alert.acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {!alert.resolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alert Configuration Summary */}
      {configurations.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Alert Configurations ({configurations.length})
          </h3>
          <p className="text-sm text-gray-600">
            {configurations.filter((c) => c.enabled).length} active alert rules configured
          </p>
        </div>
      )}
    </div>
  );
};
