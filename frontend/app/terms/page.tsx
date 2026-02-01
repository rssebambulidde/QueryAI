import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Terms of Service | QueryAI by SamaBrains',
  description: 'Terms of Service for QueryAI – usage terms and conditions. SamaBrains Solution Company, Kampala, Uganda.',
  openGraph: {
    title: 'Terms of Service | QueryAI by SamaBrains',
    description: 'Terms of Service for QueryAI – usage terms and conditions.',
  },
};

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last updated: January 2025 · QueryAI by SamaBrains Solution Company · Kampala, Uganda
        </p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">1. Agreement to Terms</h2>
            <p>
              By accessing or using QueryAI (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. The Service is provided by SamaBrains Solution Company, based in Kampala, Uganda. Contact: <a href="mailto:info@samabrain.com" className="text-blue-600 hover:underline">info@samabrain.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">2. Description of Service</h2>
            <p>
              QueryAI is a fact research assistant that combines web search and document analysis to deliver source-cited answers. Features, availability, and limits may change. We do not guarantee uninterrupted or error-free service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">3. Account and Eligibility</h2>
            <p>
              You must be at least 13 years old and capable of forming a binding contract. You are responsible for maintaining the confidentiality of your account and for all activity under your account. You must provide accurate and complete registration information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any illegal purpose or in violation of applicable laws</li>
              <li>Upload content that infringes others&apos; intellectual property or privacy</li>
              <li>Attempt to gain unauthorized access to the Service, other accounts, or our systems</li>
              <li>Use automated means to scrape or overload the Service without permission</li>
              <li>Resell or redistribute the Service except as permitted by your plan</li>
              <li>Use the Service to generate harmful, misleading, or abusive content</li>
            </ul>
            <p>We may suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">5. Subscriptions and Payment</h2>
            <p>
              Paid plans are billed according to the selected cycle (e.g., monthly or annually). Fees are non-refundable except as required by law or as stated in our refund policy. We may change pricing with reasonable notice. You are responsible for applicable taxes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">6. Intellectual Property</h2>
            <p>
              We own or license the QueryAI software, design, and branding. You retain ownership of content you upload. By using the Service, you grant us a limited license to process and store your content as necessary to provide the Service. You may not copy, modify, or reverse-engineer our Service without permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">7. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND. We do not warrant that results are complete, accurate, or suitable for any particular purpose. See our <Link href="/disclaimer" className="text-blue-600 hover:underline">Disclaimer</Link> for more information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SAMABRAINS SOLUTION COMPANY AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA, OR USE, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless SamaBrains Solution Company and its officers, directors, and employees from any claims, damages, or expenses (including legal fees) arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">10. Termination</h2>
            <p>
              You may close your account at any time. We may suspend or terminate your access for breach of these Terms, non-payment, or for operational or legal reasons, with notice where practicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Uganda. Any disputes shall be subject to the exclusive jurisdiction of the courts of Kampala, Uganda, unless otherwise required by mandatory law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">12. Changes</h2>
            <p>
              We may modify these Terms from time to time. We will post the updated Terms on this page and update the &quot;Last updated&quot; date. Material changes may be communicated by email or in-app notice. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">13. Contact</h2>
            <p>
              SamaBrains Solution Company<br />
              Kampala, Uganda<br />
              Email: <a href="mailto:info@samabrain.com" className="text-blue-600 hover:underline">info@samabrain.com</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          <Link href="/cookie-policy" className="text-blue-600 hover:underline">Cookies</Link>
          <Link href="/disclaimer" className="text-blue-600 hover:underline">Disclaimer</Link>
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        </div>
      </main>
    </div>
  );
}
