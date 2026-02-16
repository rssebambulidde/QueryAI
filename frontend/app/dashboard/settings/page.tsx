'use client';

import React from 'react';
import Link from 'next/link';
import {
  User,
  Search,
  FileText,
  Settings as SettingsIcon,
  CreditCard,
  Folder,
  Tag,
  Users,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { subscriptionApi } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useMobile } from '@/lib/hooks/use-mobile';

interface SettingsItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'account' | 'research' | 'advanced' | 'admin';
  requiresEnterprise?: boolean;
  requiresSuperAdmin?: boolean;
}

const settingsItems: SettingsItem[] = [
  {
    href: '/dashboard/settings/profile',
    label: 'Profile',
    description: 'Manage your account information and preferences',
    icon: User,
    group: 'account',
  },
  {
    href: '/dashboard/settings/subscription',
    label: 'Subscription',
    description: 'Manage your subscription and billing',
    icon: CreditCard,
    group: 'account',
  },
  {
    href: '/dashboard/settings/documents',
    label: 'Documents',
    description: 'Upload and manage your documents',
    icon: Folder,
    group: 'research',
  },
  {
    href: '/dashboard/settings/topics',
    label: 'Topics',
    description: 'Organize your research by topics',
    icon: Tag,
    group: 'research',
  },
  {
    href: '/dashboard/settings/search',
    label: 'Search Preferences',
    description: 'Configure search and web search settings',
    icon: Search,
    group: 'research',
  },
  {
    href: '/dashboard/settings/citations',
    label: 'Citation Preferences',
    description: 'Customize citation styles and formats',
    icon: FileText,
    group: 'research',
  },
  {
    href: '/dashboard/settings/advanced',
    label: 'Advanced RAG',
    description: 'Fine-tune document search and retrieval',
    icon: SettingsIcon,
    group: 'advanced',
  },
  {
    href: '/dashboard/settings/team',
    label: 'Team Collaboration',
    description: 'Manage team members and collaboration settings',
    icon: Users,
    group: 'admin',
    requiresEnterprise: true,
  },
  {
    href: '/dashboard/settings/super-admin',
    label: 'Super Admin',
    description: 'System administration and configuration',
    icon: ShieldCheck,
    group: 'admin',
    requiresSuperAdmin: true,
  },
];

const groupConfig: Record<string, { label: string; description: string }> = {
  account: { label: 'Account', description: 'Your profile and billing' },
  research: { label: 'Research', description: 'Documents, topics, and search' },
  advanced: { label: 'Advanced', description: 'Fine-tune settings' },
  admin: { label: 'Administration', description: 'Team and system management' },
};

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
  const { isMobile } = useMobile();
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'starter' | 'premium' | 'pro' | 'enterprise'>('free');

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const response = await subscriptionApi.get();
        if (response.success && response.data?.subscription?.tier) {
          setSubscriptionTier(response.data.subscription.tier);
        }
      } catch (error) {
        console.error('Failed to load subscription:', error);
      }
    };
    loadSubscription();
  }, []);

  const isEnterprise = subscriptionTier === 'enterprise';
  const visibleItems = settingsItems.filter(item => {
    if (item.requiresSuperAdmin && !isSuperAdmin) return false;
    if (item.requiresEnterprise && !isEnterprise) return false;
    return true;
  });

  // Group items
  const groups = ['account', 'research', 'advanced', 'admin'].map(groupKey => ({
    key: groupKey,
    ...groupConfig[groupKey],
    items: visibleItems.filter(item => item.group === groupKey),
  })).filter(g => g.items.length > 0);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-[14px] text-gray-500">Manage your account, preferences, and subscription</p>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mb-3">
              <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">{group.label}</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors touch-manipulation"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-100 transition-colors">
                      <Icon className="w-[18px] h-[18px] text-gray-500 group-hover:text-gray-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-gray-900 group-hover:text-gray-900">
                        {item.label}
                      </p>
                      <p className="text-[12px] text-gray-400 truncate">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {visibleItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No settings available</p>
        </div>
      )}
    </>
  );
}
