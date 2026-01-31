'use client';

import { SubscriptionManager } from '@/components/subscription/subscription-manager';

export default function SubscriptionSettingsPage() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <SubscriptionManager />
    </div>
  );
}
