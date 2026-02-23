'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  History,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  config_type: 'pricing_config' | 'tier_limits';
  action: string;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  changed_by: string;
  changed_by_email?: string;
  change_summary: string | null;
  created_at: string;
}

// ── Component ────────────────────────────────────────────────────

export default function ConfigAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const limit = 15;

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filterType !== 'all') params.config_type = filterType;

      const { data } = await apiClient.get('/api/admin/config-audit-log', { params });
      setEntries(data.data.entries);
      setTotal(data.data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const configTypeLabel = (type: string) =>
    type === 'pricing_config' ? 'Pricing' : 'Tier Limits';

  const ConfigTypeIcon = ({ type }: { type: string }) =>
    type === 'pricing_config' ? (
      <DollarSign className="w-4 h-4 text-green-600" />
    ) : (
      <SlidersHorizontal className="w-4 h-4 text-blue-600" />
    );

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Config Audit Log</h3>
          <span className="text-sm text-gray-500">({total} entries)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <option value="all">All types</option>
            <option value="pricing_config">Pricing</option>
            <option value="tier_limits">Tier Limits</option>
          </select>
          <button
            onClick={fetchEntries}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && entries.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No audit log entries found.
        </div>
      )}

      {/* Table */}
      {entries.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Changed By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Summary</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedId === entry.id}
                  onToggle={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                  formatDate={formatDate}
                  configTypeLabel={configTypeLabel}
                  ConfigTypeIcon={ConfigTypeIcon}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table Row (with expand/collapse JSON diff) ───────────────────

function TableRow({
  entry,
  isExpanded,
  onToggle,
  formatDate,
  configTypeLabel,
  ConfigTypeIcon,
}: {
  entry: AuditEntry;
  isExpanded: boolean;
  onToggle: () => void;
  formatDate: (iso: string) => string;
  configTypeLabel: (t: string) => string;
  ConfigTypeIcon: React.ComponentType<{ type: string }>;
}) {
  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
          {formatDate(entry.created_at)}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5">
            <ConfigTypeIcon type={entry.config_type} />
            {configTypeLabel(entry.config_type)}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600">
          {entry.changed_by_email ?? entry.changed_by.slice(0, 8) + '…'}
        </td>
        <td className="px-4 py-3 text-gray-600 max-w-md truncate">
          {entry.change_summary ?? '—'}
        </td>
        <td className="px-4 py-3 text-center">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 inline" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 inline" />
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-gray-50 px-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-gray-700 mb-1">Old Value</p>
                <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-64 text-gray-600">
                  {JSON.stringify(entry.old_value, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">New Value</p>
                <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto max-h-64 text-gray-600">
                  {JSON.stringify(entry.new_value, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
