'use client';

import { DocumentManager } from '@/components/documents/document-manager';

export default function DocumentsSettingsPage() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <DocumentManager />
    </div>
  );
}
