'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white py-8 sm:py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-2">
            <Logo href="/" showName={false} size="sm" />
            <span className="text-sm text-gray-500">SamaBrains Solutions · Kampala, Uganda</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <Link href="/privacy" className="text-gray-500 hover:text-gray-900">
              Privacy
            </Link>
            <Link href="/cookie-policy" className="text-gray-500 hover:text-gray-900">
              Cookies
            </Link>
            <Link href="/terms" className="text-gray-500 hover:text-gray-900">
              Terms
            </Link>
            <Link href="/disclaimer" className="text-gray-500 hover:text-gray-900">
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
