'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';
import {
  Sparkles,
  ArrowUpRight,
  LogOut,
  Shield,
  Settings,
  ChevronRight,
} from 'lucide-react';

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  anchorRef?: React.RefObject<HTMLElement | HTMLButtonElement | null>;
}

export const AccountDropdown: React.FC<AccountDropdownProps> = ({
  isOpen,
  onClose,
  subscriptionTier = 'free',
  anchorRef,
}) => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { isMobile } = useMobile();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [privateMode, setPrivateMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('privateMode');
      if (saved === 'true') setPrivateMode(true);
    }
  }, []);

  const handlePrivateModeToggle = () => {
    const newValue = !privateMode;
    setPrivateMode(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('privateMode', String(newValue));
    }
  };

  const getUserInitials = (): string => {
    if (user?.full_name) {
      const names = user.full_name.split(' ');
      if (names.length >= 2) return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      return user.full_name.substring(0, 2).toUpperCase();
    }
    if (user?.email) return user.email.substring(0, 2).toUpperCase();
    return 'U';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        anchorRef?.current && !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorRef]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
    onClose();
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'Enterprise';
      case 'pro': return 'Pro';
      default: return 'Free';
    }
  };

  const getUpgradeText = () => {
    switch (subscriptionTier) {
      case 'free': return 'Upgrade to Pro or Enterprise';
      case 'pro': return 'Upgrade to Enterprise';
      default: return '';
    }
  };

  const hasHigherTier = subscriptionTier !== 'enterprise';

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
        className={cn(
          "absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200/80 overflow-hidden",
          isMobile ? "w-[90vw] max-w-[90vw] min-w-0" : "w-[280px] min-w-[260px] max-w-[90vw]"
        )}
        style={{
          bottom: '100%',
          left: isMobile ? '0' : '0',
          right: isMobile ? '0' : 'auto',
          marginBottom: '8px',
        }}
      >
        {/* User Profile Header */}
        <div className="px-4 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-sm font-bold">
                {getUserInitials()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 flex-shrink-0">
              {getTierName(subscriptionTier)}
            </span>
          </div>
        </div>

        {/* Private Research Mode */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className={cn(
                'w-4 h-4',
                privateMode ? 'text-orange-600' : 'text-gray-400'
              )} />
              <div>
                <p className="text-sm font-medium text-gray-900">Private Mode</p>
                <p className="text-xs text-gray-400">Hide search history</p>
              </div>
            </div>
            <button
              onClick={handlePrivateModeToggle}
              className={cn(
                'relative inline-flex items-center rounded-full transition-all duration-200 focus:outline-none touch-manipulation',
                isMobile ? 'h-7 w-12' : 'h-[22px] w-[38px]',
                privateMode ? 'bg-orange-500' : 'bg-gray-300'
              )}
              role="switch"
              aria-checked={privateMode}
            >
              <span
                className={cn(
                  'inline-block rounded-full bg-white shadow-sm transition-all duration-200',
                  isMobile ? 'h-6 w-6' : 'h-[18px] w-[18px]',
                  privateMode ? 'translate-x-[18px]' : 'translate-x-[2px]'
                )}
              />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          {/* Settings */}
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left touch-manipulation"
          >
            <Settings className="w-4 h-4 text-gray-400" />
            <span className="flex-1 font-medium">Settings</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          </button>

          {/* Upgrade — show when any higher tier exists */}
          {hasHigherTier && (
            <button
              onClick={() => navigate('/dashboard/settings/subscription')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left touch-manipulation"
            >
              <Sparkles className="w-4 h-4 text-orange-500" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">Upgrade</span>
                <p className="text-xs text-gray-400 truncate">{getUpgradeText()}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
            </button>
          )}
        </div>

        {/* Sign Out */}
        <div className="border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50/50 transition-colors text-left touch-manipulation"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};
