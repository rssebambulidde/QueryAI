import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Privacy Policy | QueryAI by SamaBrains',
  description: 'Privacy Policy for QueryAI – how SamaBrains Solution Company collects, uses, and protects your data. Kampala, Uganda.',
  openGraph: {
    title: 'Privacy Policy | QueryAI by SamaBrains',
    description: 'Privacy Policy for QueryAI – how we collect, use, and protect your data.',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Logo href="/" showName size="sm" />
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Back to Home</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last updated: January 2025 · QueryAI by SamaBrains Solution Company · Kampala, Uganda
        </p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">1. Introduction</h2>
            <p>
              SamaBrains Solution Company (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates QueryAI, a fact research assistant. We are based in Kampala, Uganda. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. Contact us at <a href="mailto:info@samabrain.com" className="text-blue-600 hover:underline">info@samabrain.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">2. Information We Collect</h2>
            <p>We may collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account information (email, name, password hash)</li>
              <li>Usage data (queries, documents uploaded, feature usage)</li>
              <li>Payment and subscription information (processed by third-party providers)</li>
              <li>Device and log data (IP address, browser type, timestamps)</li>
              <li>Cookies and similar technologies for session and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve QueryAI</li>
              <li>Process subscriptions and communicate about your account</li>
              <li>Send service-related and optional marketing communications (with your consent)</li>
              <li>Analyze usage to improve product and security</li>
              <li>Comply with applicable laws and protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">4. Data Sharing and Disclosure</h2>
            <p>
              We may share data with service providers (hosting, payment, analytics, AI/search providers) under contracts that protect your data. We do not sell your personal information. We may disclose data if required by law or to protect our rights and safety.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">5. Data Retention and Security</h2>
            <p>
              We retain your data as long as your account is active or as needed for legal and operational purposes. We implement appropriate technical and organizational measures to protect your data. No system is completely secure; we encourage strong passwords and secure use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">6. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, delete, or port your data, and to object to or restrict certain processing. To exercise these rights or ask questions, contact us at <a href="mailto:info@samabrain.com" className="text-blue-600 hover:underline">info@samabrain.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">7. International Transfers</h2>
            <p>
              We operate from Uganda. If you access QueryAI from outside Uganda, your data may be transferred to and processed in Uganda or other countries where our service providers operate. We ensure appropriate safeguards where required.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">8. Children</h2>
            <p>
              QueryAI is not intended for users under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such data, please contact us at <a href="mailto:info@samabrain.com" className="text-blue-600 hover:underline">info@samabrain.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated policy on this page and update the &quot;Last updated&quot; date. Continued use of QueryAI after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">10. Contact</h2>
            <p>
              SamaBrains Solution Company<br />
              Kampala, Uganda<br />
              Email: <a href="mailto:info@samabrain.com" className="text-blue-600 hover:underline">info@samabrain.com</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
          <Link href="/disclaimer" className="text-blue-600 hover:underline">Disclaimer</Link>
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        </div>
      </main>
    </div>
  );
}
