'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Script from 'next/script';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    // Check auth status on mount (load from persisted storage)
    checkAuth().catch(() => {
      // Auth check failed, user not authenticated - stay on home page
    });
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // FAQ Schema for SEO
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is QueryAI?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "QueryAI is a fact research assistant that helps you find accurate, verified information quickly. It combines real-time web search with document analysis to deliver comprehensive, source-cited answers to your research questions."
        }
      },
      {
        "@type": "Question",
        "name": "How does QueryAI verify information?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "QueryAI searches multiple sources including the web and your uploaded documents, then combines and verifies information from these sources. Every answer includes source citations so you can verify the facts yourself."
        }
      },
      {
        "@type": "Question",
        "name": "What file types can I upload?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can upload PDFs, DOCX files, and images. QueryAI will analyze these documents and allow you to ask research questions about their content."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a free tier?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! QueryAI offers a free tier so you can start researching immediately. No credit card required."
        }
      },
      {
        "@type": "Question",
        "name": "Can I deploy QueryAI to my website?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, QueryAI can be embedded into your website as a research assistant widget using iframe or JavaScript integration. Perfect for providing research capabilities to your users."
        }
      },
      {
        "@type": "Question",
        "name": "How accurate are the research results?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "QueryAI provides source-cited answers by combining information from multiple verified sources. Every answer includes citations so you can verify the information yourself. The accuracy depends on the quality of the sources found."
        }
      }
    ]
  };

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">QueryAI</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
            Your Fact Research Assistant
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Find accurate, verified information quickly. Research questions using real-time web search and your documents. Get source-cited answers.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Watch Demo
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <span>✓ No credit card required</span>
            <span>✓ Free tier available</span>
            <span>✓ Source-cited research</span>
          </div>
        </div>

        {/* Value Proposition Section */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Why Choose QueryAI?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Real-Time Research
              </h3>
              <p className="text-gray-600">
                Get up-to-date, verified information from current sources with live web search integration.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Document Research
              </h3>
              <p className="text-gray-600">
                Find facts and verify information in your PDFs, DOCX, and images. Research your own documents.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
              <div className="text-4xl mb-4">✓</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Source Citations
              </h3>
              <p className="text-gray-600">
                Every answer includes source citations for verification. Trust the facts you find.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            How QueryAI Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ask</h3>
              <p className="text-gray-600 text-sm">
                Type your research question in natural language
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Search</h3>
              <p className="text-gray-600 text-sm">
                Searches web and your documents for relevant information
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Verify</h3>
              <p className="text-gray-600 text-sm">
                Combines sources and verifies facts for accuracy
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">4</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Answer</h3>
              <p className="text-gray-600 text-sm">
                Get comprehensive, source-cited answers
              </p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Powerful Research Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Source-Cited Answers
              </h3>
              <p className="text-gray-600 text-sm">
                Verified information with citations for every answer
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Document Research
              </h3>
              <p className="text-gray-600 text-sm">
                PDF, DOCX, image analysis and research
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Topic Scoping
              </h3>
              <p className="text-gray-600 text-sm">
                Focus research on specific domains
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Conversation Threads
              </h3>
              <p className="text-gray-600 text-sm">
                Organize research questions and findings
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Collections
              </h3>
              <p className="text-gray-600 text-sm">
                Group related research topics
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Analytics Dashboard
              </h3>
              <p className="text-gray-600 text-sm">
                Track research activity (Premium)
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Perfect for Research and Fact-Checking
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Research Teams
              </h3>
              <p className="text-gray-600 text-sm">
                Quick fact verification and document research
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Content Creators
              </h3>
              <p className="text-gray-600 text-sm">
                Fact-checking and source verification
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Journalists
              </h3>
              <p className="text-gray-600 text-sm">
                Verify information and find sources
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Students
              </h3>
              <p className="text-gray-600 text-sm">
                Research assistant for papers and studies
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Businesses
              </h3>
              <p className="text-gray-600 text-sm">
                Verify information and research documents
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Developers
              </h3>
              <p className="text-gray-600 text-sm">
                API integration for research features
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 text-lg cursor-pointer">
                What is QueryAI?
              </summary>
              <p className="mt-4 text-gray-600">
                QueryAI is a fact research assistant that helps you find accurate, verified information quickly. It combines real-time web search with document analysis to deliver comprehensive, source-cited answers to your research questions.
              </p>
            </details>
            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 text-lg cursor-pointer">
                How does QueryAI verify information?
              </summary>
              <p className="mt-4 text-gray-600">
                QueryAI searches multiple sources including the web and your uploaded documents, then combines and verifies information from these sources. Every answer includes source citations so you can verify the facts yourself.
              </p>
            </details>
            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 text-lg cursor-pointer">
                What file types can I upload?
              </summary>
              <p className="mt-4 text-gray-600">
                You can upload PDFs, DOCX files, and images. QueryAI will analyze these documents and allow you to ask research questions about their content.
              </p>
            </details>
            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 text-lg cursor-pointer">
                Is there a free tier?
              </summary>
              <p className="mt-4 text-gray-600">
                Yes! QueryAI offers a free tier so you can start researching immediately. No credit card required.
              </p>
            </details>
            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 text-lg cursor-pointer">
                Can I deploy QueryAI to my website?
              </summary>
              <p className="mt-4 text-gray-600">
                Yes, QueryAI can be embedded into your website as a research assistant widget using iframe or JavaScript integration. Perfect for providing research capabilities to your users.
              </p>
            </details>
            <details className="bg-white rounded-lg shadow-md p-6 cursor-pointer">
              <summary className="font-semibold text-gray-900 text-lg cursor-pointer">
                How accurate are the research results?
              </summary>
              <p className="mt-4 text-gray-600">
                QueryAI provides source-cited answers by combining information from multiple verified sources. Every answer includes citations so you can verify the information yourself. The accuracy depends on the quality of the sources found.
              </p>
            </details>
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="mt-20 text-center bg-gradient-to-br from-blue-600 via-blue-500 to-orange-500 rounded-2xl p-12 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Start researching facts and verifying information today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" variant="outline" className="bg-white text-blue-600 border-white hover:bg-gray-100">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="ghost" className="text-white border-white hover:bg-white/10">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}
