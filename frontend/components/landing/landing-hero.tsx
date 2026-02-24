'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingHero() {
  const scrollToHow = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
          Research with sources you can verify
        </h1>
        <p className="mt-4 sm:mt-5 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
          Ask questions. Get answers backed by your documents and the web, with citations.
        </p>
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/">
            <Button size="lg" className="w-full sm:w-auto min-w-[200px] min-h-[48px] text-base">
              Try it free — no sign-up
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px] min-h-[48px] text-base">
              Create an account
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Try instantly · No sign-up required
        </p>
      </div>
    </section>
  );
}
