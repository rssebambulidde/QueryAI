'use client';

import React, { useState, useEffect } from 'react';
import { SearchPreferences } from '@/components/settings/search-preferences';
import { documentApi } from '@/lib/api';

export default function SearchSettingsPage() {
  const [documentCount, setDocumentCount] = useState(0);
  const [hasProcessedDocuments, setHasProcessedDocuments] = useState(false);

  useEffect(() => {
    loadDocumentCount();
  }, []);

  const loadDocumentCount = async () => {
    try {
      const response = await documentApi.list();
      if (response.success && response.data) {
        const processed = response.data.filter(
          (doc) => doc.status === 'processed' || doc.status === 'embedded'
        );
        setDocumentCount(response.data.length);
        setHasProcessedDocuments(processed.length > 0);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <SearchPreferences
          documentCount={documentCount}
          hasProcessedDocuments={hasProcessedDocuments}
        />
      </div>
    </div>
  );
}
