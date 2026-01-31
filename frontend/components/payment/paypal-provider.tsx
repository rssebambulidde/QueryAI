'use client';

import { PayPalScriptProvider } from '@paypal/react-paypal-js';

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

interface PayPalProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app (or payment UI) with PayPalScriptProvider so PayPal buttons work.
 * Set NEXT_PUBLIC_PAYPAL_CLIENT_ID in env. If not set, children still render but PayPal buttons won't load.
 * 
 * Configured to support international addresses and phone numbers:
 * - locale: 'en_US' but allows all countries
 * - enable-funding: 'card' to enable card payments
 * - data-namespace: PayPal SDK namespace
 */
export function PayPalProvider({ children }: PayPalProviderProps) {
  if (!paypalClientId) {
    return <>{children}</>;
  }

  // Detect user's locale/country for better international support
  const getUserLocale = () => {
    // Try to detect from browser
    if (typeof window === 'undefined') return 'en_US';
    const browserLocale = navigator.language || 'en_US';
    // Convert browser locale to PayPal format (e.g., 'en-US' -> 'en_US')
    return browserLocale.replace('-', '_');
  };

  return (
    <PayPalScriptProvider
      options={{
        clientId: paypalClientId,
        intent: 'capture',
        vault: false,
        components: 'buttons', // Use buttons only - PayPal will redirect for card payments
        currency: 'USD',
        locale: getUserLocale(), // Use browser-detected locale for better country detection
        enableFunding: 'card', // Enable card payments - PayPal will redirect to hosted checkout
        // PayPal's redirect flow properly handles international addresses and country selection
        dataNamespace: 'paypal_sdk',
      }}
    >
      {children}
    </PayPalScriptProvider>
  );
}
