'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getConsent, setConsent } from '@/lib/cookies';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const consent = getConsent();
    if (consent === null) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    setConsent('accepted');
    setVisible(false);
  };

  const handleReject = () => {
    setConsent('rejected');
    setVisible(false);
  };

  if (!mounted || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 py-4 bg-white border-t border-gray-200 shadow-lg sm:px-6 lg:px-8"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-gray-700">
          We use cookies to keep you signed in and to remember your preferences. By continuing, you accept our use of cookies.{' '}
          <Link href="/cookie-policy" className="text-orange-600 hover:text-orange-700 underline font-medium">
            Cookie policy
          </Link>
        </p>
        <div className="flex flex-row items-center gap-3 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            className="min-h-[44px] sm:min-h-9 touch-manipulation"
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="min-h-[44px] sm:min-h-9 touch-manipulation"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
