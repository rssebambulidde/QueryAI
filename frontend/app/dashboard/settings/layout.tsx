'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Search, FileText, Settings as SettingsIcon, CreditCard, Folder, Tag, ArrowLeft, Users, ShieldCheck, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  requiresEnterprise?: boolean;
  requiresSuperAdmin?: boolean;
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
  { href: '/dashboard/settings/super-admin', label: 'Super Admin', icon: ShieldCheck, requiresSuperAdmin: true },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { isSuperAdmin } = useUserRole();
  const { isMobile } = useMobile();
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'starter' | 'premium' | 'pro' | 'enterprise'>('free');
  const [sectionsOpen, setSectionsOpen] = useState(false);

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

  // Close sections drawer on route change (mobile)
  useEffect(() => {
    setSectionsOpen(false);
  }, [pathname]);

  // Filter nav items based on subscription tier and role
  const isEnterprise = subscriptionTier === 'enterprise';
  const visibleNav = settingsNav.filter(item => {
    if (item.requiresSuperAdmin && !isSuperAdmin) return false;
    if (item.requiresEnterprise && !isEnterprise) return false;
    return true;
  });

  const currentPage = visibleNav.find(item => item.href === pathname);
  const currentPageLabel = currentPage?.label || 'Settings';

  const navLinks = (
    <nav className="p-2 overflow-y-auto">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSectionsOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 touch-manipulation',
              isActive
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  // Mobile: full-width content + overlay "Sections" menu (no persistent sidebar)
  if (isMobile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <MobileSidebar isOpen={sectionsOpen} onClose={() => setSectionsOpen(false)}>
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-gray-200 flex-shrink-0">
              <Link href="/dashboard?tab=chat" onClick={() => setSectionsOpen(false)}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900 w-full justify-start touch-manipulation min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            {navLinks}
          </div>
        </MobileSidebar>

        <header
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-30"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          <Link href="/dashboard?tab=chat" className="touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-gray-600" aria-label="Back to Dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <button
            type="button"
            onClick={() => setSectionsOpen(true)}
            className="flex items-center gap-2 flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-gray-50 font-medium touch-manipulation"
            aria-label="Open settings sections"
          >
            <Menu className="w-5 h-5 flex-shrink-0 text-gray-500" />
            <span className="truncate">{currentPageLabel}</span>
          </button>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-[env(safe-area-inset-bottom)]">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Desktop: sidebar + main content
  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-64 border-r border-gray-200 bg-white flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <Link href="/dashboard?tab=chat">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900 w-full justify-start"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        {navLinks}
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
