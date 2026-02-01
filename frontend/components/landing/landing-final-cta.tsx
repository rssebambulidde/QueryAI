'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingFinalCta() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Ready to research with sources you can verify?
        </h2>
        <p className="mt-3 text-gray-600">
          Get started in seconds. No credit card required.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto min-w-[200px] min-h-[48px] text-base">
              Get started free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="ghost" className="text-gray-600 min-h-[48px]">
              Sign in
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Free tier · No credit card required
        </p>
      </div>
    </section>
  );
}
