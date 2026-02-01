'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

export function LandingHeader() {
  const scrollTo = (id: string) => {
    if (typeof document === 'undefined') return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Logo href="/" showName={false} size="md" />
        <nav className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={() => scrollTo('features')}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-md hover:bg-gray-50 touch-manipulation min-h-[44px] sm:min-h-0"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => scrollTo('how-it-works')}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-md hover:bg-gray-50 touch-manipulation min-h-[44px] sm:min-h-0 hidden sm:block"
          >
            How it works
          </button>
          <button
            type="button"
            onClick={() => scrollTo('faq')}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-md hover:bg-gray-50 touch-manipulation min-h-[44px] sm:min-h-0"
          >
            FAQ
          </button>
          <Link
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-md hover:bg-gray-50 touch-manipulation min-h-[44px] sm:min-h-0"
          >
            User guide
          </Link>
          <Link href="/login" className="ml-1 sm:ml-2">
            <Button variant="ghost" size="sm" className="text-gray-600 min-h-[44px] sm:min-h-9">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="min-h-[44px] sm:min-h-9 min-w-[100px]">
              Get started
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
