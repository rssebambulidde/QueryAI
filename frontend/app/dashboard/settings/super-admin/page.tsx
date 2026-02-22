'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { ShieldCheck, Activity, CheckSquare, TestTube, Users, DollarSign, TrendingUp, MessageSquare, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Lazy load components for better performance
const HealthMonitoring = dynamic(() => import('@/components/super-admin/health-monitoring'), { ssr: false });
const ValidationReports = dynamic(() => import('@/components/super-admin/validation-reports'), { ssr: false });
const ABTesting = dynamic(() => import('@/components/super-admin/ab-testing'), { ssr: false });
const UserManagement = dynamic(() => import('@/components/super-admin/user-management'), { ssr: false });
const UsageAnalytics = dynamic(() => import('@/components/super-admin/usage-analytics'), { ssr: false });
const CostAnalytics = dynamic(() => import('@/components/super-admin/cost-analytics'), { ssr: false });
const FeedbackDashboard = dynamic(() => import('@/components/super-admin/feedback-dashboard'), { ssr: false });
const LLMSettings = dynamic(() => import('@/components/super-admin/llm-settings'), { ssr: false });

type TabId = 'health' | 'validation' | 'ab-testing' | 'users' | 'usage' | 'cost' | 'feedback' | 'llm';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'validation', label: 'Validation', icon: CheckSquare },
  { id: 'ab-testing', label: 'A/B Testing', icon: TestTube },
  { id: 'usage', label: 'Usage', icon: TrendingUp },
  { id: 'cost', label: 'Cost', icon: DollarSign },
  { id: 'llm', label: 'LLM', icon: Cpu },
];

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState<TabId>('feedback');

  // Redirect if not super admin
  if (!isLoading && (!isAuthenticated || !isSuperAdmin)) {
    router.push('/dashboard');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
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
      case 'validation':
        return <ValidationReports />;
      case 'ab-testing':
        return <ABTesting />;
      case 'users':
        return <UserManagement />;
      case 'usage':
        return <UsageAnalytics />;
      case 'cost':
        return <CostAnalytics />;
      case 'feedback':
        return <FeedbackDashboard />;
      case 'llm':
        return <LLMSettings />;
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
