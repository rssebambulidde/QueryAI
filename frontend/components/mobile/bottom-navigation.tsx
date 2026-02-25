'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  User,
  X,
  ArrowUpCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';
import { Button } from '@/components/ui/button';

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
];

function getTierName(tier: string): string {
  switch (tier) {
    case 'enterprise': return 'Enterprise';
    case 'pro': return 'Pro';
    default: return 'Free';
  }
}

/** Next tier for upgrade: free->Pro, pro->Enterprise. */
function getNextTier(current: string): { tier: string; label: string } | null {
  switch (current) {
    case 'free': return { tier: 'pro', label: 'Pro' };
    case 'pro': return { tier: 'enterprise', label: 'Enterprise' };
    default: return null;
  }
}

interface UserInfo {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface BottomNavigationProps {
  className?: string;
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
  const [accountModalOpen, setAccountModalOpen] = useState(false);

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

  const nextTier = getNextTier(subscriptionTier);

  const handleUpgrade = () => {
    setAccountModalOpen(false);
    router.push('/dashboard/settings/subscription');
  };

  const handleLogout = () => {
    setAccountModalOpen(false);
    onSignOut?.();
  };

  return (
    <>
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200',
          'safe-area-inset-bottom',
          className
        )}
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch h-14 min-h-[56px]">
          {/* Left: Account icon only (opens modal), then Chat, Collections */}
          {user && onSignOut && (
            <div
              className="flex items-center justify-center flex-shrink-0 border-r border-gray-200 pl-2 pr-1"
              style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))' }}
            >
              <button
                type="button"
                onClick={() => setAccountModalOpen(true)}
                className="flex items-center justify-center w-12 h-12 rounded-lg text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-colors touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
                aria-label="Account"
              >
                <User className="w-6 h-6" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-around flex-1 min-w-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <button
                  key={item.id}
                  onClick={(e) => handleClick(item, e)}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 h-full relative',
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
        </div>
      </nav>

      {/* Account modal: user details, plan, upgrade, logout */}
      {user && onSignOut && accountModalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
          onClick={() => setAccountModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Account"
        >
          <div
            className={cn(
              'w-full bg-white rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[85vh]',
              'border border-gray-200'
            )}
            style={{
              paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold">
                    {getInitials()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {user.full_name || 'User'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{user.email || '—'}</p>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Current plan</p>
                <p className="font-medium text-gray-900">{getTierName(subscriptionTier)}</p>
              </div>
              <button
                onClick={() => {
                  setAccountModalOpen(false);
                  router.push('/dashboard/settings');
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left touch-manipulation"
                style={{ minHeight: '44px' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <Settings className="w-4.5 h-4.5 text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-900">Settings</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              {nextTier && (
                <Button
                  onClick={handleUpgrade}
                  className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  style={{ minHeight: '44px' }}
                >
                  <ArrowUpCircle className="w-5 h-5" />
                  Upgrade to {nextTier.label}
                </Button>
              )}
            </div>
            <div className="p-4 pt-0">
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                style={{ minHeight: '44px' }}
              >
                <LogOut className="w-5 h-5" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
