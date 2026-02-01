import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/error-boundary";
import { PayPalProvider } from "@/components/payment/paypal-provider";
import { TokenExpiryWarning } from "@/components/auth/token-expiry-warning";
import { CookieConsentBanner } from "@/components/cookies/cookie-consent-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Add this for faster text rendering
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap', // Add this for faster text rendering
  preload: true,
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://queryai.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "QueryAI - Fact Research Assistant | SamaBrains | Kampala, Uganda",
    template: "%s | QueryAI by SamaBrains",
  },
  description: "QueryAI by SamaBrains Solution Company – fact research assistant for accurate, verified information. Real-time web search and document analysis. Source-cited answers. Based in Kampala, Uganda.",
  keywords: "QueryAI, SamaBrains, fact research assistant, research tool, verified information, document research, fact-checking, source-cited research, Kampala, Uganda",
  authors: [{ name: "SamaBrains Solution Company", url: baseUrl }],
  creator: "SamaBrains Solution Company",
  publisher: "SamaBrains Solution Company",
  robots: { index: true, follow: true },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  openGraph: {
    title: "QueryAI - Fact Research Assistant | SamaBrains",
    description: "Find accurate, verified information quickly. QueryAI by SamaBrains Solution Company – Kampala, Uganda.",
    type: "website",
    url: baseUrl,
    siteName: "QueryAI",
    locale: "en_US",
    images: [
      {
        url: '/apple-icon.svg',
        width: 180,
        height: 180,
        alt: 'QueryAI Logo - SamaBrains',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QueryAI - Fact Research Assistant | SamaBrains",
    description: "Find accurate, verified information quickly. QueryAI by SamaBrains – Kampala, Uganda.",
    images: ['/apple-icon.svg'],
  },
  alternates: {
    canonical: baseUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Structured Data (JSON-LD) for SEO
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SamaBrains Solution Company",
    "alternateName": "SamaBrains",
    "description": "QueryAI – Fact Research Assistant. Find accurate, verified information quickly.",
    "url": baseUrl,
    "logo": `${baseUrl}/icon.svg`,
    "email": "info@samabrain.com",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Kampala",
      "addressCountry": "UG",
    },
  };

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "QueryAI",
    "applicationCategory": "ResearchApplication",
    "description": "QueryAI by SamaBrains – fact research assistant for accurate, verified information. Real-time web search and document analysis. Source-cited answers. Kampala, Uganda.",
    "operatingSystem": "Web",
    "publisher": {
      "@type": "Organization",
      "name": "SamaBrains Solution Company",
      "url": baseUrl,
      "email": "info@samabrain.com",
    },
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
    "description": "QueryAI by SamaBrains Solution Company – Fact Research Assistant. Kampala, Uganda.",
    "publisher": {
      "@type": "Organization",
      "name": "SamaBrains Solution Company",
      "url": baseUrl,
      "email": "info@samabrain.com",
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${baseUrl}/dashboard?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  return (
    <html lang="en">
      <head>
        {/* Resource hints for API connection optimization */}
        {apiUrl && (
          <>
            <link rel="preconnect" href={apiUrl} />
            <link rel="dns-prefetch" href={apiUrl} />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Redirect OAuth callback from root to /auth/callback before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=window.location.pathname,h=window.location.hash;if(p==='/'&&h&&h.indexOf('access_token')!==-1){window.location.replace('/auth/callback'+h);}})();`,
          }}
        />
        {/* Structured Data (JSON-LD) for SEO - Scripts are automatically placed in head */}
        <Script
          id="organization-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Script
          id="software-application-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <Script
          id="website-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <ErrorBoundary>
          <PayPalProvider>
            {children}
            <Toaster />
            <TokenExpiryWarning />
            <CookieConsentBanner />
          </PayPalProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
