'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import Script from 'next/script';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth().catch(() => {});
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is QueryAI?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'QueryAI is a fact research assistant that helps you find accurate, verified information quickly. It combines real-time web search with document analysis to deliver comprehensive, source-cited answers.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is there a free tier?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. QueryAI offers a free tier so you can start researching immediately. No credit card required.',
        },
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Logo href="/" showName={false} size="md" />
            <nav className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-gray-600">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
              Research with sources you can verify
            </h1>
            <p className="mt-3 text-gray-600 text-base">
              Ask questions. Get answers backed by your documents and the web, with citations.
            </p>
            <div className="mt-8">
              <Link href="/signup">
                <Button size="lg" className="min-w-[180px]">
                  Get started free
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Free tier · No credit card required
            </p>
          </div>
        </main>

        <footer className="border-t border-gray-100 py-6">
          <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo href="/" showName={false} size="sm" />
              <span className="text-sm text-gray-500">SamaBrains Solutions · Kampala, Uganda</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-gray-900">
                Privacy
              </Link>
              <Link href="/terms" className="text-gray-500 hover:text-gray-900">
                Terms
              </Link>
              <Link href="/disclaimer" className="text-gray-500 hover:text-gray-900">
                Disclaimer
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
