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
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto min-w-[200px] min-h-[48px] text-base">
              Get started free
            </Button>
          </Link>
          <button
            type="button"
            onClick={scrollToHow}
            className="text-gray-600 hover:text-gray-900 font-medium text-base underline underline-offset-2 touch-manipulation min-h-[48px] sm:min-h-0"
          >
            See how it works
          </button>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Free tier · No credit card required
        </p>
      </div>
    </section>
  );
}
