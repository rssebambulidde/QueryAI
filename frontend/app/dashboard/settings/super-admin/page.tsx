'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { ShieldCheck, Activity, Users, MessageSquare, Cpu, DollarSign, SlidersHorizontal, History, Ticket, BarChart3, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Lazy load components for better performance
const HealthMonitoring = dynamic(() => import('@/components/super-admin/health-monitoring'), { ssr: false });
const UserManagement = dynamic(() => import('@/components/super-admin/user-management'), { ssr: false });
const FeedbackDashboard = dynamic(() => import('@/components/super-admin/feedback-dashboard'), { ssr: false });
const LLMSettings = dynamic(() => import('@/components/super-admin/llm-settings'), { ssr: false });
const PricingConfig = dynamic(() => import('@/components/super-admin/pricing-config'), { ssr: false });
const TierLimitsConfig = dynamic(() => import('@/components/super-admin/tier-limits-config'), { ssr: false });
const ConfigAuditLog = dynamic(() => import('@/components/super-admin/config-audit-log'), { ssr: false });
const PromoCodeManager = dynamic(() => import('@/components/super-admin/promo-code-manager'), { ssr: false });
const PaymentAnalyticsDashboard = dynamic(() => import('@/components/super-admin/payment-analytics-dashboard'), { ssr: false });
const UsageAlertsConfig = dynamic(() => import('@/components/super-admin/usage-alerts-config'), { ssr: false });

type TabId = 'health' | 'users' | 'feedback' | 'llm' | 'pricing' | 'tier-limits' | 'audit-log' | 'promo-codes' | 'payment-analytics' | 'usage-alerts';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'tier-limits', label: 'Tier Limits', icon: SlidersHorizontal },
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'llm', label: 'LLM', icon: Cpu },
  { id: 'audit-log', label: 'Audit Log', icon: History },
  { id: 'promo-codes', label: 'Promo Codes', icon: Ticket },
  { id: 'payment-analytics', label: 'Revenue', icon: BarChart3 },
  { id: 'usage-alerts', label: 'Usage Alerts', icon: Bell },
];

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState<TabId>('feedback');

  // Layout already hides this nav item for non-super-admins.
  // Belt-and-suspenders redirect for direct URL access.
  if (!isLoading && (!isAuthenticated || !isSuperAdmin)) {
    router.push('/dashboard');
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'health':
        return <HealthMonitoring />;
      case 'users':
        return <UserManagement />;
      case 'feedback':
        return <FeedbackDashboard />;
      case 'llm':
        return <LLMSettings />;
      case 'pricing':
        return <PricingConfig />;
      case 'tier-limits':
        return <TierLimitsConfig />;
      case 'audit-log':
        return <ConfigAuditLog />;
      case 'promo-codes':
        return <PromoCodeManager />;
      case 'payment-analytics':
        return <PaymentAnalyticsDashboard />;
      case 'usage-alerts':
        return <UsageAlertsConfig />;
      default:
        return <FeedbackDashboard />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-6 h-6 text-orange-600" />
          <h2 className="text-2xl font-bold text-gray-900">Super Admin</h2>
        </div>
        <p className="text-sm text-gray-500">
          System administration and monitoring tools (Super Admin only)
        </p>
      </div>

      {/* Tabs + Content */}
      <div className="flex gap-6">
        <nav className="flex flex-col gap-1 min-w-[160px] flex-shrink-0 border-r border-gray-200 pr-4" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 py-2 px-3 rounded-lg font-medium text-sm whitespace-nowrap text-left transition-colors',
                  activeTab === tab.id
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
