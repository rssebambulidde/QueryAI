'use client';

import React from 'react';
import { SearchPreferences } from '@/components/settings/search-preferences';

export default function SearchSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <SearchPreferences />
      </div>
    </div>
  );
}
