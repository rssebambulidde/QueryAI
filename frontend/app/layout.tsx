import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QueryAI - Fact Research Assistant | Find Verified Information Fast",
  description: "QueryAI is a fact research assistant that helps you find accurate, verified information quickly. Research questions using real-time web search and document analysis. Get source-cited answers.",
  keywords: "fact research assistant, research tool, verified information, document research, fact-checking, source-cited research",
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  openGraph: {
    title: "QueryAI - Fact Research Assistant",
    description: "Find accurate, verified information quickly. Research questions using real-time web search and your documents. Get source-cited answers.",
    type: "website",
    images: [
      {
        url: '/apple-icon.svg',
        width: 180,
        height: 180,
        alt: 'QueryAI Logo',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QueryAI - Fact Research Assistant",
    description: "Find accurate, verified information quickly. Research questions using real-time web search and your documents.",
    images: ['/apple-icon.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Structured Data (JSON-LD) for SEO
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://queryai.com";
  
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "QueryAI",
    "description": "Fact Research Assistant - Find accurate, verified information quickly",
    "url": baseUrl,
    "logo": `${baseUrl}/favicon.ico`,
  };

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "QueryAI",
    "applicationCategory": "ResearchApplication",
    "description": "QueryAI is a fact research assistant that helps you find accurate, verified information quickly. Research questions using real-time web search and document analysis. Get source-cited answers.",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "featureList": [
      "Real-time web search integration",
      "Document analysis (PDF, DOCX, images)",
      "Source-cited answers",
      "Topic scoping",
      "Conversation threads",
      "Collections organization"
    ]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "QueryAI",
    "url": baseUrl,
    "description": "Fact Research Assistant - Find accurate, verified information quickly",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${baseUrl}/dashboard?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en">
      <head>
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          {children}
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}
