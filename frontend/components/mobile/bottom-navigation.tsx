'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  MessageSquare,
  FileText,
  Tag,
  Settings,
  CreditCard,
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
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    href: '/dashboard?tab=documents',
  },
  {
    id: 'topics',
    label: 'Topics',
    icon: Tag,
    href: '/dashboard?tab=topics',
  },
  {
    id: 'subscription',
    label: 'Subscription',
    icon: CreditCard,
    href: '/dashboard?tab=subscription',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/dashboard/settings/profile',
  },
];

interface BottomNavigationProps {
  className?: string;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  className,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useMobile();

  if (!isMobile) {
    return null;
  }

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
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
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
                'touch-manipulation', // Optimize for touch
                active
                  ? 'text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              style={{ minHeight: '44px', minWidth: '44px' }} // Touch target size
              aria-label={item.label}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-6 h-6 transition-transform',
                    active && 'scale-110'
                  )}
                />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-orange-600 rounded-full">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-0.5 font-medium truncate w-full text-center',
                  active ? 'text-orange-600' : 'text-gray-500'
                )}
              >
                {item.label}
              </span>
              {active && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-orange-600 rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
