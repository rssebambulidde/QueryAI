'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import Script from 'next/script';
import { LandingHeader } from '@/components/landing/landing-header';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works';
import { LandingUseCases } from '@/components/landing/landing-use-cases';
import { LandingPricingTeaser } from '@/components/landing/landing-pricing-teaser';
import { LandingFaq } from '@/components/landing/landing-faq';
import { LandingFinalCta } from '@/components/landing/landing-final-cta';
import { LandingFooter } from '@/components/landing/landing-footer';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  // If Supabase OAuth redirected to site root with tokens in hash, send to callback to complete sign-in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { pathname, hash } = window.location;
    if (pathname === '/' && hash && hash.includes('access_token')) {
      window.location.replace(`/auth/callback${hash}`);
      return;
    }
  }, []);

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
      {
        '@type': 'Question',
        name: 'How are sources used?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Answers include inline citations to the sources they use—your uploaded documents or web pages. You can click through to read the original and verify.',
        },
      },
      {
        '@type': 'Question',
        name: 'What happens to my data?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Your documents and conversations are stored securely. We use your uploads only to answer your questions and to improve the service within our privacy policy.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I use my own documents?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Upload PDFs, Word docs, and other supported files. QueryAI will search them and cite them in answers alongside web results.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where is QueryAI based?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'QueryAI is built by SamaBrains Solution Company, based in Kampala, Uganda.',
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
        <LandingHeader />
        <main>
          <LandingHero />
          <LandingFeatures />
          <LandingHowItWorks />
          <LandingUseCases />
          <LandingPricingTeaser />
          <LandingFaq />
          <LandingFinalCta />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
