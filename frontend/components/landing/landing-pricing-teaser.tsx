'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingPricingTeaser() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Start free. Upgrade when you need more.
        </h2>
        <p className="mt-3 text-gray-600">
          Use QueryAI at no cost to get started. Add more capacity as your research grows.
        </p>
        <div className="mt-6">
          <Link href="/signup">
            <Button size="lg" variant="outline" className="min-h-[48px]">
              Get started free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
