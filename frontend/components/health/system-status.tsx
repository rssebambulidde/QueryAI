'use client';

import React from 'react';
import { SystemHealth, ComponentStatus } from '@/lib/api-health';
import { CheckCircle, AlertCircle, XCircle, HelpCircle } from 'lucide-react';

interface SystemStatusProps {
  systemHealth: SystemHealth;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ systemHealth }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getComponentStatusIcon = (status: ComponentStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'down':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">System Health Status</h2>
        <div className="flex items-center gap-2">
          {getStatusIcon(systemHealth.overall)}
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
              systemHealth.overall
            )}`}
          >
            {systemHealth.overall.charAt(0).toUpperCase() + systemHealth.overall.slice(1)}
          </span>
        </div>
      </div>

      {/* Component Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {systemHealth.components.map((component) => (
          <div
            key={component.name}
            className="p-4 border-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{component.name}</h3>
              {getComponentStatusIcon(component.status)}
            </div>
            <div className="space-y-1">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                  component.status
                )}`}
              >
                {component.status.charAt(0).toUpperCase() + component.status.slice(1)}
              </span>
              {component.latency !== undefined && (
                <p className="text-sm text-gray-600">
                  Latency: {component.latency.toFixed(0)}ms
                </p>
              )}
              {component.errorRate !== undefined && (
                <p className="text-sm text-gray-600">
                  Error Rate: {(component.errorRate * 100).toFixed(2)}%
                </p>
              )}
              <p className="text-xs text-gray-500">
                Last checked: {new Date(component.lastChecked).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t text-sm text-gray-500">
        Last updated: {new Date(systemHealth.timestamp).toLocaleString()}
      </div>
    </div>
  );
};
