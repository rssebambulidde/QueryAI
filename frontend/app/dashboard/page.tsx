'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/chat/chat-interface';
import { DocumentManager } from '@/components/documents/document-manager';
import { TopicManager } from '@/components/topics/topic-manager';
import { ApiKeyManager } from '@/components/api-keys/api-key-manager';
import { EmbeddingManager } from '@/components/embeddings/embedding-manager';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { RAGSettings } from '@/components/chat/rag-source-selector';
import { documentApi } from '@/lib/api';

type TabType = 'chat' | 'documents' | 'topics' | 'api-keys' | 'embeddings';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [ragSettings, setRagSettings] = useState<RAGSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ragSettings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return {
      enableDocumentSearch: true,
      enableWebSearch: true,
      maxDocumentChunks: 5,
      minScore: 0.5,
      maxWebResults: 5,
    };
  });
  const [documentCount, setDocumentCount] = useState(0);
  const [hasProcessedDocuments, setHasProcessedDocuments] = useState(false);

  // Check auth on mount
  useEffect(() => {
    if (!hasCheckedAuth) {
      checkAuth()
        .catch(() => {
          // Auth check failed, will redirect below
        })
        .finally(() => {
          setHasCheckedAuth(true);
        });
    }
  }, [hasCheckedAuth, checkAuth]);

  // Redirect if not authenticated (wait for loading and auth check to finish)
  useEffect(() => {
    if (hasCheckedAuth && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, hasCheckedAuth]); // router is stable, no need to include

  // Load document count when chat tab is active
  useEffect(() => {
    if (activeTab === 'chat') {
      const loadDocumentCount = async () => {
        try {
          const response = await documentApi.list();
          if (response.success && response.data) {
            const processedDocs = response.data.filter(
              (doc) => doc.status === 'processed' || doc.status === 'embedded'
            );
            setDocumentCount(processedDocs.length);
            setHasProcessedDocuments(processedDocs.length > 0);
          }
        } catch (err) {
          console.warn('Failed to load document count:', err);
        }
      };
      loadDocumentCount();
    }
  }, [activeTab]);

  // Save RAG settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <nav className="bg-white shadow-sm flex-shrink-0 border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">QueryAI</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.full_name || user.email}
              </span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Unified Sidebar with Navigation, Source Selection, and Conversations */}
        <AppSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ragSettings={ragSettings}
          onRagSettingsChange={setRagSettings}
          documentCount={documentCount}
          hasProcessedDocuments={hasProcessedDocuments}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'chat' ? (
            <div className="flex-1 overflow-hidden">
              {/* Chat Interface - Full width now */}
              <ChatInterface ragSettings={ragSettings} />
            </div>
          ) : activeTab === 'documents' ? (
            <div className="flex-1 overflow-y-auto p-6">
              <DocumentManager />
            </div>
          ) : activeTab === 'topics' ? (
            <div className="flex-1 overflow-y-auto p-6">
              <TopicManager />
            </div>
          ) : activeTab === 'api-keys' ? (
            <div className="flex-1 overflow-y-auto p-6">
              <ApiKeyManager />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <EmbeddingManager />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
