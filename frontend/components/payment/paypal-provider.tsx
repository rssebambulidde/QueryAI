'use client';

import { PayPalScriptProvider } from '@paypal/react-paypal-js';

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

interface PayPalProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app (or payment UI) with PayPalScriptProvider so PayPal buttons work.
 * Set NEXT_PUBLIC_PAYPAL_CLIENT_ID in env. If not set, children still render but PayPal buttons won't load.
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
        components: 'buttons',
        currency: 'USD',
      }}
    >
      {children}
    </PayPalScriptProvider>
  );
}
