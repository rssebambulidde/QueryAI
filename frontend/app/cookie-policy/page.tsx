import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Cookie Policy | QueryAI by SamaBrains',
  description: 'Cookie Policy for QueryAI – how we use cookies for session, preferences, and compliance. Kampala, Uganda.',
  openGraph: {
    title: 'Cookie Policy | QueryAI by SamaBrains',
    description: 'How QueryAI uses cookies for session, preferences, and compliance.',
  },
};

export default function CookiePolicyPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last updated: February 2025 · QueryAI by SamaBrains Solution Company · Kampala, Uganda
        </p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">1. What are cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. QueryAI uses a cookie to remember your cookie consent choice. We also use your browser&apos;s local storage for session and preferences (see section 2). This policy describes the cookies we set and how you can control them, in line with applicable privacy laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">2. Cookies we use</h2>
            <p>
              QueryAI currently sets the following cookie in your browser when you use the consent banner:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>queryai_cookie_consent</strong> — Stores your choice (&quot;accepted&quot; or &quot;rejected&quot;) so we do not show the consent banner again. Stored for one year. Path: /; SameSite: Lax.</li>
            </ul>
            <p className="mt-4">
              If we add analytics or performance cookies in the future, we will only set them if you have accepted non-essential cookies via the consent banner, and we will update this policy.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mt-6 mb-2">Local storage (not cookies)</h3>
            <p>
              Session, sign-in, and preferences are stored in your browser&apos;s <strong>local storage</strong>, not in cookies. This includes:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Session / authentication:</strong> Tokens that keep you signed in (e.g. access and refresh tokens).</li>
              <li><strong>Remember me:</strong> If you choose &quot;Remember me&quot; when signing in, we use local storage to keep you signed in for a longer period.</li>
              <li><strong>Preferences:</strong> Settings such as RAG options, default topic, private mode, and pinned conversations are stored in local storage so we can remember your choices.</li>
            </ul>
            <p className="mt-2">
              You can clear local storage (and sign out) via your browser settings or by signing out in the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">3. Your choices</h2>
            <p>
              When you first visit QueryAI, you can choose to <strong>Accept</strong> or <strong>Reject</strong> non-essential cookies via the cookie consent banner. The consent cookie is the only cookie we set for preferences. You can change your mind by clearing the <strong>queryai_cookie_consent</strong> cookie (e.g. via your browser&apos;s cookie settings) and revisiting the site to see the banner again. You can also block or delete cookies in your browser; blocking the consent cookie will simply show the banner again on your next visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">4. Duration</h2>
            <p>
              The consent cookie (<strong>queryai_cookie_consent</strong>) is stored for one year unless you delete it earlier. Session and preference data in local storage remain until you sign out, clear site data, or remove them in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">5. More information</h2>
            <p>
              For how we collect, use, and protect your data overall, see our{' '}
              <Link href="/privacy" className="text-orange-600 hover:text-orange-700 font-medium underline">
                Privacy Policy
              </Link>
              . If you have questions about cookies, contact us at{' '}
              <a href="mailto:info@samabrain.com" className="text-orange-600 hover:underline">info@samabrain.com</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
          <Link href="/disclaimer" className="text-blue-600 hover:underline">Disclaimer</Link>
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        </div>
      </main>
    </div>
  );
}
