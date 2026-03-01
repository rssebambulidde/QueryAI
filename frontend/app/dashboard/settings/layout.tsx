'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  FileText,
  CreditCard,
  Users,
  ShieldCheck,
  Sparkles,
  Menu,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { subscriptionApi } from '@/lib/api';
import { useMobile } from '@/lib/hooks/use-mobile';
import { MobileSidebar } from '@/components/mobile/mobile-sidebar';
import { useEffect, useState } from 'react';

interface SettingsNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'account' | 'research' | 'advanced' | 'admin';
  requiresEnterprise?: boolean;
  requiresSuperAdmin?: boolean;
}

const settingsNav: SettingsNavItem[] = [
  { href: '/dashboard/settings/profile', label: 'Profile', icon: User, group: 'account' },
  { href: '/dashboard/settings/subscription', label: 'Subscription', icon: CreditCard, group: 'account' },
  { href: '/dashboard/settings/citations', label: 'Citations', icon: FileText, group: 'research' },
  { href: '/dashboard/settings/research-features', label: 'Research Features', icon: Sparkles, group: 'research' },
  { href: '/dashboard/settings/team', label: 'Team', icon: Users, group: 'admin', requiresEnterprise: true },
  { href: '/dashboard/settings/super-admin', label: 'Super Admin', icon: ShieldCheck, group: 'admin', requiresSuperAdmin: true },
];

const groupLabels: Record<string, string> = {
  account: 'Account',
  research: 'Research',
  admin: 'Administration',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
  const { isMobile } = useMobile();
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [sectionsOpen, setSectionsOpen] = useState(false);

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

  useEffect(() => {
    setSectionsOpen(false);
  }, [pathname]);

  const isEnterprise = subscriptionTier === 'enterprise';
  const visibleNav = settingsNav.filter(item => {
    if (item.requiresSuperAdmin && !isSuperAdmin) return false;
    if (item.requiresEnterprise && !isEnterprise) return false;
    return true;
  });

  const currentPage = visibleNav.find(item => item.href === pathname);
  const currentPageLabel = currentPage?.label || 'Settings';
  const isSuperAdminPage = pathname === '/dashboard/settings/super-admin';
  const contentMaxWidth = isSuperAdminPage ? 'max-w-6xl' : 'max-w-3xl';

  // Group navigation items
  const groups = ['account', 'research', 'admin'].map(groupKey => ({
    key: groupKey,
    label: groupLabels[groupKey],
    items: visibleNav.filter(item => item.group === groupKey),
  })).filter(g => g.items.length > 0);

  const navLinks = (
    <nav className="px-2 py-2 overflow-y-auto flex-1">
      {groups.map((group, gi) => (
        <div key={group.key} className={cn(gi > 0 && 'mt-4')}>
          <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSectionsOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 touch-manipulation',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={cn(
                  'w-[18px] h-[18px] flex-shrink-0',
                  isActive ? 'text-gray-700' : 'text-gray-400'
                )} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  // ─── Mobile layout ───────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <MobileSidebar isOpen={sectionsOpen} onClose={() => setSectionsOpen(false)}>
          <div className="flex flex-col h-full bg-white">
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <Link
                href="/dashboard?tab=chat"
                onClick={() => setSectionsOpen(false)}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            </div>
            {navLinks}
          </div>
        </MobileSidebar>

        <header
          className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-30"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          <Link
            href="/dashboard?tab=chat"
            className="touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-gray-500"
            aria-label="Back to Dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <button
            type="button"
            onClick={() => setSectionsOpen(true)}
            className="flex items-center gap-2 flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-gray-50 font-medium touch-manipulation"
            aria-label="Open settings sections"
          >
            <Menu className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span className="truncate text-[14px]">{currentPageLabel}</span>
          </button>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className={cn(contentMaxWidth, 'mx-auto px-4 py-6 pb-[env(safe-area-inset-bottom)]')}>
            {children}
          </div>
        </main>
      </div>
    );
  }

  // ─── Desktop layout ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Settings sidebar */}
      <aside className="w-[240px] border-r border-gray-100 bg-white flex-shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <Link
            href="/dashboard?tab=chat"
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="px-4 py-3 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
        </div>

        {navLinks}
      </aside>

      {/* Content area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className={cn(contentMaxWidth, 'mx-auto px-8 py-8')}>
          {children}
        </div>
      </main>
    </div>
  );
}
