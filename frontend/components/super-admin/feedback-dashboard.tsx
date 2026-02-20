'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import {
  ThumbsUp,
  ThumbsDown,
  Flag,
  MessageSquare,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────

interface AnalyticsRow {
  period: string;
  total_feedback: number;
  thumbs_up: number;
  thumbs_down: number;
  flagged_count: number;
  avg_rating: number;
}

interface ByModelRow {
  model: string;
  total_feedback: number;
  thumbs_up: number;
  thumbs_down: number;
  flagged_count: number;
  approval_rate: number;
}

interface ByTopicRow {
  topic_id: string;
  topic_name: string;
  total_feedback: number;
  thumbs_up: number;
  thumbs_down: number;
  approval_rate: number;
}

interface FlaggedCitation {
  sourceUrl: string;
  sourceTitle: string;
  reason?: string;
}

interface MessageFeedback {
  id: string;
  user_id: string;
  message_id: string;
  conversation_id: string | null;
  topic_id: string | null;
  rating: -1 | 1;
  comment: string | null;
  flagged_citations: FlaggedCitation[];
  model: string | null;
  created_at: string;
}

type DayOption = 7 | 30 | 90;

// ── Component ────────────────────────────────────────────────────

export default function FeedbackDashboard() {
  const [days, setDays] = useState<DayOption>(30);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [byModel, setByModel] = useState<ByModelRow[]>([]);
  const [byTopic, setByTopic] = useState<ByTopicRow[]>([]);
  const [recent, setRecent] = useState<MessageFeedback[]>([]);
  const [flagged, setFlagged] = useState<MessageFeedback[]>([]);

  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingFlagged, setLoadingFlagged] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedRecent, setExpandedRecent] = useState<Set<string>>(new Set());
  const [expandedFlagged, setExpandedFlagged] = useState<Set<string>>(new Set());

  // ── Fetch helpers ──────────────────────────────────────────

  const fetchAnalytics = useCallback(async (d: number) => {
    try {
      setLoadingAnalytics(true);
      setError(null);

      const [analyticsRes, modelRes, topicRes] = await Promise.all([
        apiClient.get('/api/admin/feedback/analytics', { params: { days: d, groupBy: 'day' } }),
        apiClient.get('/api/admin/feedback/by-model', { params: { days: d } }),
        apiClient.get('/api/admin/feedback/by-topic', { params: { days: d, limit: 20 } }),
      ]);

      if (analyticsRes.data.success) setAnalytics(analyticsRes.data.data.analytics || []);
      if (modelRes.data.success) setByModel(modelRes.data.data.byModel || []);
      if (topicRes.data.success) setByTopic(topicRes.data.data.byTopic || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load feedback analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    try {
      setLoadingRecent(true);
      const res = await apiClient.get('/api/admin/feedback/recent', { params: { limit: 50 } });
      if (res.data.success) setRecent(res.data.data.recent || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load recent feedback');
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const fetchFlagged = useCallback(async () => {
    try {
      setLoadingFlagged(true);
      const res = await apiClient.get('/api/admin/feedback/flagged', { params: { limit: 50 } });
      if (res.data.success) setFlagged(res.data.data.flagged || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load flagged citations');
    } finally {
      setLoadingFlagged(false);
    }
  }, []);

  // ── Effects ────────────────────────────────────────────────

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  useEffect(() => {
    fetchRecent();
    fetchFlagged();
  }, [fetchRecent, fetchFlagged]);

  // ── Derived stats ──────────────────────────────────────────

  const totals = analytics.reduce(
    (acc, r) => ({
      feedback: acc.feedback + Number(r.total_feedback),
      up: acc.up + Number(r.thumbs_up),
      down: acc.down + Number(r.thumbs_down),
      flagged: acc.flagged + Number(r.flagged_count),
    }),
    { feedback: 0, up: 0, down: 0, flagged: 0 }
  );

  const approvalRate = totals.feedback > 0
    ? ((totals.up / totals.feedback) * 100).toFixed(1)
    : '—';

  // ── Toggle expand ──────────────────────────────────────────

  const toggleRecent = (id: string) =>
    setExpandedRecent((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleFlagged = (id: string) =>
    setExpandedFlagged((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Helpers ────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ── Render ─────────────────────────────────────────────────

  if (error && !analytics.length && !recent.length && !flagged.length) {
    return (
      <div className="p-6">
        <Alert variant="error">
          <div>
            <h3 className="font-semibold mb-1">Error</h3>
            <p>{error}</p>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Feedback Dashboard</h3>
          <p className="text-sm text-gray-600 mt-1">Monitor user feedback, ratings and flagged citations</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Day selector */}
          {([7, 30, 90] as DayOption[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                days === d
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {d}d
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchAnalytics(days);
              fetchRecent();
              fetchFlagged();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error">
          <p>{error}</p>
        </Alert>
      )}

      {/* ── Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Feedback"
          value={totals.feedback}
          icon={<MessageSquare className="w-5 h-5 text-blue-600" />}
          loading={loadingAnalytics}
        />
        <SummaryCard
          label="Thumbs Up"
          value={totals.up}
          icon={<ThumbsUp className="w-5 h-5 text-green-600" />}
          loading={loadingAnalytics}
          sub={`${approvalRate}% approval`}
        />
        <SummaryCard
          label="Thumbs Down"
          value={totals.down}
          icon={<ThumbsDown className="w-5 h-5 text-red-500" />}
          loading={loadingAnalytics}
        />
        <SummaryCard
          label="Flagged Citations"
          value={totals.flagged}
          icon={<Flag className="w-5 h-5 text-amber-500" />}
          loading={loadingAnalytics}
        />
      </div>

      {/* ── Ratings Over Time ──────────────────────────────── */}
      <Section title="Ratings Over Time" icon={<BarChart3 className="w-5 h-5 text-gray-500" />}>
        {loadingAnalytics ? (
          <LoadingSpinner />
        ) : analytics.length === 0 ? (
          <EmptyState message="No feedback data for this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium text-right">Total</th>
                  <th className="py-2 pr-4 font-medium text-right">
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> Up</span>
                  </th>
                  <th className="py-2 pr-4 font-medium text-right">
                    <span className="inline-flex items-center gap-1"><ThumbsDown className="w-3.5 h-3.5" /> Down</span>
                  </th>
                  <th className="py-2 pr-4 font-medium text-right">Flagged</th>
                  <th className="py-2 font-medium text-right">Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map((row) => {
                  const rate = Number(row.total_feedback) > 0
                    ? ((Number(row.thumbs_up) / Number(row.total_feedback)) * 100).toFixed(0)
                    : '—';
                  return (
                    <tr key={row.period} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-4">{formatDate(row.period)}</td>
                      <td className="py-2 pr-4 text-right font-medium">{Number(row.total_feedback)}</td>
                      <td className="py-2 pr-4 text-right text-green-600">{Number(row.thumbs_up)}</td>
                      <td className="py-2 pr-4 text-right text-red-500">{Number(row.thumbs_down)}</td>
                      <td className="py-2 pr-4 text-right text-amber-600">{Number(row.flagged_count)}</td>
                      <td className="py-2 text-right">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded text-xs font-medium',
                          Number(row.avg_rating) >= 0.5
                            ? 'bg-green-50 text-green-700'
                            : Number(row.avg_rating) >= 0
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-red-50 text-red-700'
                        )}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── By Model ───────────────────────────────────────── */}
      {byModel.length > 0 && (
        <Section title="By Model" icon={<BarChart3 className="w-5 h-5 text-gray-500" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium text-right">Total</th>
                  <th className="py-2 pr-4 font-medium text-right">Up</th>
                  <th className="py-2 pr-4 font-medium text-right">Down</th>
                  <th className="py-2 pr-4 font-medium text-right">Flagged</th>
                  <th className="py-2 font-medium text-right">Approval</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((row) => (
                  <tr key={row.model} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs">{row.model || '(unknown)'}</td>
                    <td className="py-2 pr-4 text-right font-medium">{Number(row.total_feedback)}</td>
                    <td className="py-2 pr-4 text-right text-green-600">{Number(row.thumbs_up)}</td>
                    <td className="py-2 pr-4 text-right text-red-500">{Number(row.thumbs_down)}</td>
                    <td className="py-2 pr-4 text-right text-amber-600">{Number(row.flagged_count)}</td>
                    <td className="py-2 text-right">
                      <ApprovalBadge rate={Number(row.approval_rate)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── By Topic ───────────────────────────────────────── */}
      {byTopic.length > 0 && (
        <Section title="By Topic" icon={<BarChart3 className="w-5 h-5 text-gray-500" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-4 font-medium">Topic</th>
                  <th className="py-2 pr-4 font-medium text-right">Total</th>
                  <th className="py-2 pr-4 font-medium text-right">Up</th>
                  <th className="py-2 pr-4 font-medium text-right">Down</th>
                  <th className="py-2 font-medium text-right">Approval</th>
                </tr>
              </thead>
              <tbody>
                {byTopic.map((row) => (
                  <tr key={row.topic_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-4">{row.topic_name || '(unknown)'}</td>
                    <td className="py-2 pr-4 text-right font-medium">{Number(row.total_feedback)}</td>
                    <td className="py-2 pr-4 text-right text-green-600">{Number(row.thumbs_up)}</td>
                    <td className="py-2 pr-4 text-right text-red-500">{Number(row.thumbs_down)}</td>
                    <td className="py-2 text-right">
                      <ApprovalBadge rate={Number(row.approval_rate)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Flagged Citations ──────────────────────────────── */}
      <Section
        title={`Flagged Citations (${flagged.length})`}
        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
      >
        {loadingFlagged ? (
          <LoadingSpinner />
        ) : flagged.length === 0 ? (
          <EmptyState message="No flagged citations" />
        ) : (
          <div className="space-y-2">
            {flagged.map((fb) => (
              <FeedbackCard
                key={fb.id}
                feedback={fb}
                expanded={expandedFlagged.has(fb.id)}
                onToggle={() => toggleFlagged(fb.id)}
                showFlaggedCitations
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── Recent Feedback ────────────────────────────────── */}
      <Section
        title={`Recent Feedback (${recent.length})`}
        icon={<Clock className="w-5 h-5 text-gray-500" />}
      >
        {loadingRecent ? (
          <LoadingSpinner />
        ) : recent.length === 0 ? (
          <EmptyState message="No feedback yet" />
        ) : (
          <div className="space-y-2">
            {recent.map((fb) => (
              <FeedbackCard
                key={fb.id}
                feedback={fb}
                expanded={expandedRecent.has(fb.id)}
                onToggle={() => toggleRecent(fb.id)}
                showFlaggedCitations={fb.flagged_citations?.length > 0}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  loading,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        {loading ? (
          <div className="h-7 w-16 animate-pulse bg-gray-200 rounded mt-1" />
        ) : (
          <>
            <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
            {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        {icon}
        <h4 className="text-base font-semibold text-gray-900">{title}</h4>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FeedbackCard({
  feedback,
  expanded,
  onToggle,
  showFlaggedCitations,
}: {
  feedback: MessageFeedback;
  expanded: boolean;
  onToggle: () => void;
  showFlaggedCitations: boolean;
}) {
  const isPositive = feedback.rating === 1;
  const hasComment = !!feedback.comment;
  const hasFlagged = feedback.flagged_citations?.length > 0;
  const dateStr = new Date(feedback.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'border rounded-lg transition-colors',
        isPositive ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
      )}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isPositive ? (
            <ThumbsUp className="w-4 h-4 text-green-600 flex-shrink-0" />
          ) : (
            <ThumbsDown className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
          <span className="text-sm text-gray-700 truncate">
            {hasComment ? feedback.comment : '(no comment)'}
          </span>
          {hasFlagged && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex-shrink-0">
              <Flag className="w-3 h-3" />
              {feedback.flagged_citations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="text-xs text-gray-400">{dateStr}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
            <div>
              <span className="font-medium text-gray-600">User ID:</span>{' '}
              <span className="font-mono">{feedback.user_id.slice(0, 8)}...</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Message:</span>{' '}
              <span className="font-mono">{feedback.message_id.slice(0, 8)}...</span>
            </div>
            {feedback.model && (
              <div>
                <span className="font-medium text-gray-600">Model:</span> {feedback.model}
              </div>
            )}
            {feedback.conversation_id && (
              <div>
                <span className="font-medium text-gray-600">Conversation:</span>{' '}
                <span className="font-mono">{feedback.conversation_id.slice(0, 8)}...</span>
              </div>
            )}
          </div>

          {/* Full comment */}
          {hasComment && (
            <div className="bg-white rounded p-3 text-sm text-gray-700 border border-gray-100">
              <span className="font-medium text-gray-600 text-xs block mb-1">Comment</span>
              {feedback.comment}
            </div>
          )}

          {/* Flagged citations */}
          {showFlaggedCitations && hasFlagged && (
            <div className="space-y-2">
              <span className="font-medium text-gray-600 text-xs">Flagged Citations</span>
              {feedback.flagged_citations.map((fc, i) => (
                <div
                  key={i}
                  className="bg-amber-50 border border-amber-200 rounded p-3 text-sm flex flex-col gap-1"
                >
                  <div className="flex items-start gap-2">
                    <Flag className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{fc.sourceTitle || '(untitled)'}</p>
                      {fc.sourceUrl && (
                        <a
                          href={fc.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate"
                        >
                          {fc.sourceUrl}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      )}
                      {fc.reason && (
                        <p className="text-xs text-gray-500 mt-1">{fc.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovalBadge({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(0);
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 rounded text-xs font-medium',
        rate >= 0.7
          ? 'bg-green-50 text-green-700'
          : rate >= 0.4
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-red-50 text-red-700'
      )}
    >
      {pct}%
    </span>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-sm text-gray-400">{message}</div>
  );
}
