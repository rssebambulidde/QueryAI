'use client';

import { useEffect, useState } from 'react';
import { usageApi, UsageStats, UsageWarnings } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp, Zap, FileText, Folder, ArrowUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UsageDisplayProps {
  compact?: boolean;
  showWarnings?: boolean;
}

export function UsageDisplay({ compact = false, showWarnings = true }: UsageDisplayProps) {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [warnings, setWarnings] = useState<UsageWarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsage();
    if (showWarnings) {
      loadWarnings();
    }
  }, [showWarnings]);

  const loadUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await usageApi.getCurrent();
      if (response.success && response.data) {
        setUsage(response.data.usage);
      } else {
        setError(response.error?.message || 'Failed to load usage data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const loadWarnings = async () => {
    try {
      const response = await usageApi.getWarnings();
      if (response.success && response.data) {
        setWarnings(response.data);
      }
    } catch (err) {
      console.error('Failed to load usage warnings:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </Alert>
    );
  }

  if (!usage) {
    return null;
  }

  const formatLimit = (limit: number | null): string => {
    if (limit === null) return 'Unlimited';
    return limit.toLocaleString();
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage === -1) return 'bg-green-500'; // Unlimited
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const UsageItem = ({
    label,
    icon: Icon,
    used,
    limit,
    remaining,
    percentage,
    onUpgrade,
  }: {
    label: string;
    icon: React.ElementType;
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
    onUpgrade?: () => void;
  }) => {
    const isUnlimited = limit === null;
    const isNearLimit = percentage >= 80 && percentage !== -1;
    const isAtLimit = percentage >= 100 && percentage !== -1;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </div>
          <div className="text-sm text-gray-600">
            {used.toLocaleString()} / {formatLimit(limit)}
          </div>
        </div>
        {!isUnlimited && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getProgressColor(percentage)}`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {isUnlimited
                  ? 'Unlimited'
                  : `${remaining !== null ? remaining.toLocaleString() : 0} remaining`}
              </span>
              {isNearLimit && !isAtLimit && (
                <span className="text-yellow-600 font-medium">
                  {percentage.toFixed(0)}% used
                </span>
              )}
              {isAtLimit && (
                <span className="text-red-600 font-medium">Limit reached</span>
              )}
            </div>
          </div>
        )}
        {isAtLimit && onUpgrade && (
          <Button
            size="sm"
            variant="outline"
            onClick={onUpgrade}
            className="w-full mt-2"
          >
            <ArrowUp className="h-3 w-3 mr-1" />
            Upgrade to increase limit
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {showWarnings && warnings?.approaching && (
        <Alert variant="default" className="border-yellow-500 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <div className="ml-2">
            <div className="font-medium text-yellow-800">Approaching Usage Limits</div>
            <div className="text-sm text-yellow-700 mt-1">
              {warnings.warnings.map((w, i) => (
                <span key={i}>
                  {w.type === 'queries' && 'Queries'}
                  {w.type === 'documentUploads' && 'Document uploads'}
                  {w.type === 'topics' && 'Topics'} ({w.percentage}% used)
                  {i < warnings.warnings.length - 1 && ', '}
                </span>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => router.push('/dashboard?tab=subscription')}
            >
              Upgrade Plan
            </Button>
          </div>
        </Alert>
      )}

      <div className={`space-y-${compact ? '3' : '4'}`}>
        <UsageItem
          label="Queries"
          icon={Zap}
          used={usage.queries.used}
          limit={usage.queries.limit}
          remaining={usage.queries.remaining}
          percentage={usage.queries.percentage}
          onUpgrade={
            usage.queries.percentage >= 100
              ? () => router.push('/dashboard?tab=subscription')
              : undefined
          }
        />

        <UsageItem
          label="Document Uploads"
          icon={FileText}
          used={usage.documentUploads.used}
          limit={usage.documentUploads.limit}
          remaining={usage.documentUploads.remaining}
          percentage={usage.documentUploads.percentage}
          onUpgrade={
            usage.documentUploads.percentage >= 100
              ? () => router.push('/dashboard?tab=subscription')
              : undefined
          }
        />

        <UsageItem
          label="Topics"
          icon={Folder}
          used={usage.topics.used}
          limit={usage.topics.limit}
          remaining={usage.topics.remaining}
          percentage={usage.topics.percentage}
          onUpgrade={
            usage.topics.percentage >= 100
              ? () => router.push('/dashboard?tab=subscription')
              : undefined
          }
        />
      </div>

      {!compact && (
        <div className="text-xs text-gray-500 pt-2 border-t">
          Current period: {new Date(usage.periodStart).toLocaleDateString()} -{' '}
          {new Date(usage.periodEnd).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
