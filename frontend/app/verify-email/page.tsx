'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Mail, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function VerifyEmailContent() {
  const router = useRouter();
  const { isMobile } = useMobile();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <Mail className={cn(
            "mx-auto text-orange-600",
            isMobile ? "w-12 h-12" : "w-16 h-16"
          )} />
          <h2 className={cn(
            "mt-6 font-extrabold text-gray-900",
            isMobile ? "text-xl" : "text-3xl"
          )}>
            Check Your Email
          </h2>
          <p className={cn(
            "mt-2 text-gray-600",
            isMobile ? "text-sm" : "text-base"
          )}>
            We sent a verification link to your email address.
            Click the link in the email to confirm your account.
          </p>
          <p className={cn(
            "mt-4 text-gray-500",
            isMobile ? "text-xs" : "text-sm"
          )}>
            {"Didn't receive the email? Check your spam folder or try signing up again."}
          </p>
          <div className={cn(
            "mt-6 flex flex-col gap-2",
          )}>
            <Button
              onClick={() => router.push('/login')}
              className={cn(
                "w-full",
                isMobile && "min-h-[44px] text-base"
              )}
            >
              Go to Login
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/signup')}
              className={cn(
                "w-full",
                isMobile && "min-h-[44px] text-base"
              )}
            >
              Sign Up Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-orange-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
