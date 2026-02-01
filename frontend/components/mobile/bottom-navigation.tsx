'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  MessageSquare,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

const navItems: BottomNavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    href: '/dashboard?tab=chat',
  },
  {
    id: 'collections',
    label: 'Collections',
    icon: FileText,
    href: '/dashboard?tab=collections',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/dashboard/settings', // Now points to settings index page
  },
];

function getTierName(tier: string): string {
  switch (tier) {
    case 'enterprise': return 'Enterprise';
    case 'pro': return 'Pro';
    case 'premium': return 'Premium';
    case 'starter': return 'Starter';
    default: return 'Free';
  }
}

interface UserInfo {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface BottomNavigationProps {
  className?: string;
  /** When provided (e.g. on dashboard), show signed-in account and sign out in bottom right */
  user?: UserInfo | null;
  subscriptionTier?: string;
  onSignOut?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  className,
  user,
  subscriptionTier = 'free',
  onSignOut,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useMobile();

  if (!isMobile) {
    return null;
  }

  const getInitials = (): string => {
    if (!user) return '?';
    if (user.full_name) {
      const names = user.full_name.trim().split(/\s+/);
      if (names.length >= 2) return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      return user.full_name.slice(0, 2).toUpperCase();
    }
    if (user.email) return user.email.slice(0, 2).toUpperCase();
    return '?';
  };

  const isActive = (item: BottomNavItem) => {
    if (item.href.includes('settings')) {
      return pathname?.startsWith('/dashboard/settings');
    }
    if (item.href.includes('tab=')) {
      const tab = item.href.split('tab=')[1];
      return pathname === '/dashboard' && new URLSearchParams(window.location.search).get('tab') === tab;
    }
    return pathname === item.href;
  };

  const handleClick = (item: BottomNavItem, e: React.MouseEvent) => {
    e.preventDefault();
    router.push(item.href);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200',
        'safe-area-inset-bottom',
        className
      )}
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-stretch h-14 min-h-[56px]">
        {/* Left: Chat, Collections, Settings */}
        <div className="flex items-center justify-around flex-1 min-w-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <button
                key={item.id}
                onClick={(e) => handleClick(item, e)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full',
                  'min-w-0 px-2 py-1 transition-colors',
                  'touch-manipulation',
                  active ? 'text-orange-600' : 'text-gray-500 hover:text-gray-700'
                )}
                style={{ minHeight: '44px', minWidth: '44px' }}
                aria-label={item.label}
              >
                <div className="relative">
                  <Icon className={cn('w-6 h-6 transition-transform', active && 'scale-110')} />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-orange-600 rounded-full">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={cn('text-xs mt-0.5 font-medium truncate w-full text-center', active ? 'text-orange-600' : 'text-gray-500')}>
                  {item.label}
                </span>
                {active && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-orange-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Account, tier, sign out (mobile only when user provided) */}
        {user && onSignOut && (
          <div
            className="flex items-center gap-2 pl-3 pr-3 border-l border-gray-200 flex-shrink-0 bg-gray-50/80"
            style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
                  {getInitials()}
                </div>
              )}
              <span className="text-xs font-medium text-gray-700 truncate max-w-[72px]" title={user.email || user.full_name || undefined}>
                {getTierName(subscriptionTier)} Plan
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSignOut()}
              className="flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors touch-manipulation"
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
