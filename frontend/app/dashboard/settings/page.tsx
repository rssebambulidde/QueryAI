'use client';

import React from 'react';
import Link from 'next/link';
import { User, Search, FileText, Settings as SettingsIcon, CreditCard, Folder, Tag, Users, ShieldCheck, Bell, Key } from 'lucide-react';
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
  requiresEnterprise?: boolean;
  requiresSuperAdmin?: boolean;
}

const settingsItems: SettingsItem[] = [
  { 
    href: '/dashboard/settings/profile', 
    label: 'Profile', 
    description: 'Manage your account information and preferences',
    icon: User 
  },
  { 
    href: '/dashboard/settings/subscription', 
    label: 'Subscription', 
    description: 'Manage your subscription and billing',
    icon: CreditCard 
  },
  { 
    href: '/dashboard/settings/documents', 
    label: 'Documents', 
    description: 'Upload and manage your documents',
    icon: Folder 
  },
  { 
    href: '/dashboard/settings/topics', 
    label: 'Topics', 
    description: 'Organize your research by topics',
    icon: Tag 
  },
  { 
    href: '/dashboard/settings/search', 
    label: 'Search Preferences', 
    description: 'Configure search and web search settings',
    icon: Search 
  },
  { 
    href: '/dashboard/settings/citations', 
    label: 'Citation Preferences', 
    description: 'Customize citation styles and formats',
    icon: FileText 
  },
  { 
    href: '/dashboard/settings/advanced', 
    label: 'Advanced RAG Settings', 
    description: 'Fine-tune document search and retrieval',
    icon: SettingsIcon 
  },
  { 
    href: '/dashboard/settings/api', 
    label: 'API Keys', 
    description: 'Manage your API keys and access tokens',
    icon: Key 
  },
  { 
    href: '/dashboard/settings/notifications', 
    label: 'Notifications', 
    description: 'Configure notification preferences',
    icon: Bell 
  },
  { 
    href: '/dashboard/settings/team', 
    label: 'Team Collaboration', 
    description: 'Manage team members and collaboration settings',
    icon: Users, 
    requiresEnterprise: true 
  },
  { 
    href: '/dashboard/settings/super-admin', 
    label: 'Super Admin', 
    description: 'System administration and configuration',
    icon: ShieldCheck, 
    requiresSuperAdmin: true 
  },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
  const { isMobile } = useMobile();
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'starter' | 'premium' | 'pro' | 'enterprise'>('free');

  // Load subscription tier
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

  // Filter items based on subscription tier and role
  const isEnterprise = subscriptionTier === 'enterprise';
  const visibleItems = settingsItems.filter(item => {
    if (item.requiresSuperAdmin && !isSuperAdmin) return false;
    if (item.requiresEnterprise && !isEnterprise) return false;
    return true;
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account, preferences, and subscription</p>
      </div>

      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
      )}>
        {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group p-4 sm:p-6 bg-white border border-gray-200 rounded-lg",
                  "hover:border-orange-300 hover:shadow-md transition-all",
                  "touch-manipulation min-h-[100px] flex flex-col",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                      {item.label}
                    </h2>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0 self-center">
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-orange-600 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
      </div>

      {visibleItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No settings available</p>
        </div>
      )}
    </>
  );
}
