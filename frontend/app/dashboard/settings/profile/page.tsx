'use client';

import React from 'react';
import { ProfileEditor } from '@/components/settings/profile-editor';

export default function ProfileSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ProfileEditor />
      </div>
    </div>
  );
}
