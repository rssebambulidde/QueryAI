'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';
import {
  User,
  Search,
  FileText,
  Settings as SettingsIcon,
  CreditCard,
  Folder,
  Tag,
  Users,
  Keyboard,
  Bell,
  Code,
  Sparkles,
  ArrowUpRight,
  LogOut,
  Shield,
} from 'lucide-react';

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionTier?: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
  anchorRef?: React.RefObject<HTMLElement | HTMLButtonElement | null>;
}

interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  shortcut?: string;
}

const getMenuGroups = (subscriptionTier: string, isEnterprise: boolean): MenuGroup[] => [
  {
    items: [
      { label: 'Profile', icon: User, href: '/dashboard/settings/profile' },
      { label: 'Search', icon: Search, href: '/dashboard/settings/search' },
      { label: 'Citations', icon: FileText, href: '/dashboard/settings/citations' },
      { label: 'Advanced RAG', icon: SettingsIcon, href: '/dashboard/settings/advanced' },
      { label: 'Subscription', icon: CreditCard, href: '/dashboard/settings/subscription' },
      { label: 'Documents', icon: Folder, href: '/dashboard/settings/documents' },
      { label: 'Topics', icon: Tag, href: '/dashboard/settings/topics' },
      ...(isEnterprise ? [{ label: 'Team Collaboration', icon: Users, href: '/dashboard/settings/team' }] : []),
    ],
  },
];

export const AccountDropdown: React.FC<AccountDropdownProps> = ({
  isOpen,
  onClose,
  subscriptionTier = 'free',
  anchorRef,
}) => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [privateMode, setPrivateMode] = useState(false);

  // Load private mode from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('privateMode');
      if (saved === 'true') {
        setPrivateMode(true);
      }
    }
  }, []);

  // Save private mode to localStorage
  const handlePrivateModeToggle = () => {
    const newValue = !privateMode;
    setPrivateMode(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('privateMode', String(newValue));
    }
  };

  // Get user initials for avatar
  const getUserInitials = (): string => {
    if (user?.full_name) {
      const names = user.full_name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.full_name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle menu item click
  const handleMenuItemClick = (href: string) => {
    router.push(href);
    onClose();
  };

  // Handle upgrade
  const handleUpgrade = () => {
    router.push('/dashboard/settings/subscription');
    onClose();
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    router.push('/login');
    onClose();
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'Enterprise';
      case 'pro':
        return 'Pro';
      case 'premium':
        return 'Premium';
      case 'starter':
        return 'Starter';
      default:
        return 'Free';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/5"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-100 w-[340px] min-w-[300px] max-w-[90vw] overflow-hidden"
        style={{
          bottom: '100%',
          left: '0',
          marginBottom: '12px',
        }}
      >
        {/* User Profile Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-orange-100">
          <div className="flex items-center gap-3">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user?.full_name || user?.email || 'User'}
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 flex items-center justify-center text-white text-base font-bold shadow-sm ring-2 ring-white">
                {getUserInitials()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-600 truncate mt-0.5">
                {user?.email}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/80 text-orange-700 border border-orange-200">
                  {getTierName(subscriptionTier)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Private Research Mode */}
        <div className="px-5 py-3.5 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <Shield className={cn(
                  'w-4.5 h-4.5',
                  privateMode ? 'text-orange-600' : 'text-gray-400'
                )} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Private Research Mode</p>
                <p className="text-xs text-gray-500">Hide search history</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">⌘;</span>
              <button
                onClick={handlePrivateModeToggle}
                className={cn(
                  'relative inline-flex h-[22px] w-[38px] items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1',
                  privateMode ? 'bg-orange-500 shadow-sm' : 'bg-gray-300'
                )}
                role="switch"
                aria-checked={privateMode}
              >
                <span
                  className={cn(
                    'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-all duration-200',
                    privateMode ? 'translate-x-[18px]' : 'translate-x-[2px]'
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-2 max-h-[420px] overflow-y-auto custom-scrollbar">
          {(() => {
            const isEnterprise = subscriptionTier === 'enterprise';
            const groups = getMenuGroups(subscriptionTier, isEnterprise);
            return groups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={itemIndex}
                      onClick={() => handleMenuItemClick(item.href)}
                      className="w-full flex items-center gap-3.5 px-5 py-3 text-sm text-gray-700 hover:bg-orange-50/50 transition-colors text-left group"
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                        'bg-gray-50 group-hover:bg-orange-100 border border-gray-100 group-hover:border-orange-200'
                      )}>
                        <Icon className="w-4.5 h-4.5 text-gray-600 group-hover:text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.label}</span>
                          {item.badge && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.shortcut && (
                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.shortcut}
                        </span>
                      )}
                      <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
                {groupIndex < groups.length - 1 && (
                  <div className="mx-5 my-1.5 border-t border-gray-100" />
                )}
              </div>
            ));
          })()}
        </div>

        {/* Upgrade CTA */}
        {/* Only show upgrade button for free, starter, and premium users - hide for pro and enterprise */}
        {subscriptionTier !== 'enterprise' && subscriptionTier !== 'pro' && (
          <>
            <div className="border-t border-gray-100" />
            <div className="px-5 py-4 bg-gradient-to-r from-orange-50 to-orange-100/30">
              <button
                onClick={handleUpgrade}
                className="w-full flex items-center justify-between p-3.5 bg-white border-2 border-orange-200 rounded-lg hover:border-orange-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">Upgrade Plan</p>
                    <p className="text-xs text-gray-600">
                      {subscriptionTier === 'free' && 'Unlock premium features'}
                      {subscriptionTier === 'starter' && 'Upgrade to Premium, Pro, or Enterprise'}
                      {subscriptionTier === 'premium' && 'Upgrade to Pro or Enterprise'}
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-orange-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </>
        )}

        {/* Logout */}
        <div className="border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-5 py-3.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-100">
              <LogOut className="w-4.5 h-4.5" />
            </div>
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};
