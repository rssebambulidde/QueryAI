'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  Ticket,
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────

interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discount_percent: number;
  applicable_tiers: string[];
  applicable_periods: string[];
  valid_from: string;
  valid_until?: string | null;
  max_uses?: number | null;
  current_uses: number;
  max_uses_per_user: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PromoForm {
  code: string;
  description: string;
  discount_percent: number;
  applicable_tiers: string[];
  applicable_periods: string[];
  valid_from: string;
  valid_until: string;
  max_uses: string;
  max_uses_per_user: number;
  is_active: boolean;
}

const EMPTY_FORM: PromoForm = {
  code: '',
  description: '',
  discount_percent: 10,
  applicable_tiers: ['pro', 'enterprise'],
  applicable_periods: ['monthly', 'annual'],
  valid_from: new Date().toISOString().slice(0, 16),
  valid_until: '',
  max_uses: '',
  max_uses_per_user: 1,
  is_active: true,
};

// ── Component ────────────────────────────────────────────────────

export default function PromoCodeManager() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPromoCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/api/admin/promo-codes', {
        params: { limit: 50 },
      });
      setPromoCodes(data.data.promoCodes);
      setTotal(data.data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromoCodes();
  }, [fetchPromoCodes]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleEdit = (promo: PromoCode) => {
    setEditingId(promo.id);
    setForm({
      code: promo.code,
      description: promo.description || '',
      discount_percent: promo.discount_percent,
      applicable_tiers: promo.applicable_tiers,
      applicable_periods: promo.applicable_periods,
      valid_from: promo.valid_from ? promo.valid_from.slice(0, 16) : '',
      valid_until: promo.valid_until ? promo.valid_until.slice(0, 16) : '',
      max_uses: promo.max_uses !== null ? String(promo.max_uses) : '',
      max_uses_per_user: promo.max_uses_per_user,
      is_active: promo.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this promo code?')) return;
    try {
      await apiClient.delete(`/api/admin/promo-codes/${id}`);
      fetchPromoCodes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code,
        description: form.description || undefined,
        discount_percent: form.discount_percent,
        applicable_tiers: form.applicable_tiers,
        applicable_periods: form.applicable_periods,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : undefined,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        max_uses_per_user: form.max_uses_per_user,
        is_active: form.is_active,
      };

      if (editingId) {
        await apiClient.put(`/api/admin/promo-codes/${editingId}`, payload);
      } else {
        await apiClient.post('/api/admin/promo-codes', payload);
      }

      setShowForm(false);
      setEditingId(null);
      fetchPromoCodes();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err instanceof Error ? err.message : 'Failed to save');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayValue = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Promo Codes</h3>
          <span className="text-sm text-gray-500">({total})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPromoCodes}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Code
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-5 space-y-4"
        >
          <h4 className="font-semibold text-gray-900">
            {editingId ? 'Edit Promo Code' : 'Create Promo Code'}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER25"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
                disabled={!!editingId}
              />
            </div>

            {/* Discount % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount %
              </label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={form.discount_percent}
                onChange={(e) =>
                  setForm({ ...form, discount_percent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Summer promotion - 25% off"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            {/* Applicable tiers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Applicable Tiers
              </label>
              <div className="flex gap-3">
                {['pro', 'enterprise'].map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.applicable_tiers.includes(t)}
                      onChange={() =>
                        setForm({
                          ...form,
                          applicable_tiers: toggleArrayValue(form.applicable_tiers, t),
                        })
                      }
                    />
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Applicable periods */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Periods
              </label>
              <div className="flex gap-3">
                {['monthly', 'annual'].map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.applicable_periods.includes(p)}
                      onChange={() =>
                        setForm({
                          ...form,
                          applicable_periods: toggleArrayValue(form.applicable_periods, p),
                        })
                      }
                    />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Valid from */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid From
              </label>
              <input
                type="datetime-local"
                value={form.valid_from}
                onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            {/* Valid until */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until (optional)
              </label>
              <input
                type="datetime-local"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            {/* Max uses */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Uses (blank = unlimited)
              </label>
              <input
                type="number"
                min="1"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            {/* Max uses per user */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Uses Per User
              </label>
              <input
                type="number"
                min="1"
                value={form.max_uses_per_user}
                onChange={(e) =>
                  setForm({ ...form, max_uses_per_user: parseInt(e.target.value, 10) || 1 })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            {/* Active toggle */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <span className="font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving || form.applicable_tiers.length === 0 || form.applicable_periods.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loading */}
      {loading && promoCodes.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty */}
      {!loading && promoCodes.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No promo codes yet. Click &quot;New Code&quot; to create one.
        </div>
      )}

      {/* Table */}
      {promoCodes.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Discount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tiers</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Periods</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Valid</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {promoCodes.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                    <span className="inline-flex items-center gap-1.5">
                      {promo.code}
                      <button
                        onClick={() => handleCopyCode(promo.code, promo.id)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy code"
                      >
                        {copiedId === promo.id ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {promo.discount_percent}%
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {promo.applicable_tiers.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {promo.applicable_periods.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {promo.current_uses}
                    {promo.max_uses !== null ? ` / ${promo.max_uses}` : ' / ∞'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(promo.valid_from)}
                    {promo.valid_until ? ` – ${formatDate(promo.valid_until)}` : ' – ∞'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        promo.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {promo.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(promo)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {promo.is_active && (
                        <button
                          onClick={() => handleDelete(promo.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                          title="Deactivate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
