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

  return (
    <PayPalScriptProvider
      options={{
        clientId: paypalClientId,
        intent: 'capture',
        vault: false,
        components: 'buttons,card-fields',
        currency: 'USD',
        locale: 'en_US', // Base locale, but PayPal will detect user's country
        enableFunding: 'card', // Enable card payments
        // Allow international addresses - PayPal will show country selector
        dataNamespace: 'paypal_sdk',
      }}
    >
      {children}
    </PayPalScriptProvider>
  );
}
