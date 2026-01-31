'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Search, FileText, Settings as SettingsIcon, CreditCard, Folder, Tag, ArrowLeft, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth-store';
import { subscriptionApi } from '@/lib/api';
import { useEffect, useState } from 'react';

interface SettingsNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresEnterprise?: boolean;
}

const settingsNav: SettingsNavItem[] = [
  { href: '/dashboard/settings/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings/search', label: 'Search', icon: Search },
  { href: '/dashboard/settings/citations', label: 'Citations', icon: FileText },
  { href: '/dashboard/settings/advanced', label: 'Advanced RAG', icon: SettingsIcon },
  { href: '/dashboard/settings/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/dashboard/settings/documents', label: 'Documents', icon: Folder },
  { href: '/dashboard/settings/topics', label: 'Topics', icon: Tag },
  { href: '/dashboard/settings/team', label: 'Team Collaboration', icon: Users, requiresEnterprise: true },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();
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

  // Filter nav items based on subscription tier
  const isEnterprise = subscriptionTier === 'enterprise';
  const visibleNav = settingsNav.filter(item => !item.requiresEnterprise || isEnterprise);

  // Get current page label for breadcrumb
  const currentPage = visibleNav.find(item => item.href === pathname);
  const currentPageLabel = currentPage?.label || 'Settings';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back to Dashboard Button */}
        <div className="mb-6">
          <Link href="/dashboard?tab=chat">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Header with Breadcrumbs */}
        <div className="mb-8">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link
              href="/dashboard?tab=chat"
              className="hover:text-gray-900 transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">Settings</span>
            {currentPage && currentPageLabel !== 'Settings' && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 font-medium">{currentPageLabel}</span>
              </>
            )}
          </nav>

          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
