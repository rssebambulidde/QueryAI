'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/chat/chat-interface';
import { ConversationList } from '@/components/chat/conversation-list';
import { DocumentManager } from '@/components/documents/document-manager';
import { TopicManager } from '@/components/topics/topic-manager';
import { ApiKeyManager } from '@/components/api-keys/api-key-manager';
import { EmbeddingManager } from '@/components/embeddings/embedding-manager';
import { MessageSquare, FileText, Tag, Key, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RAGSourceSelector, RAGSettings } from '@/components/chat/rag-source-selector';
import { documentApi } from '@/lib/api';

type TabType = 'chat' | 'documents' | 'topics' | 'api-keys' | 'embeddings';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [showSourceSelection, setShowSourceSelection] = useState(false);
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
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
          <nav className="flex-1 px-2 py-4 space-y-1">
            <div>
              <button
                onClick={() => setActiveTab('chat')}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'chat'
                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5" />
                  Query Assistant
                </div>
                {activeTab === 'chat' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSourceSelection(!showSourceSelection);
                    }}
                    className="p-1 hover:bg-orange-100 rounded transition-colors"
                  >
                    {showSourceSelection ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </button>
              
              {/* Collapsible Source Selection */}
              {activeTab === 'chat' && showSourceSelection && (
                <div className="mt-2 ml-11 mr-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-700">Source Selection:</span>
                  </div>
                  <RAGSourceSelector
                    settings={ragSettings}
                    onChange={setRagSettings}
                    documentCount={documentCount}
                    hasProcessedDocuments={hasProcessedDocuments}
                    className="flex-col gap-2"
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => setActiveTab('documents')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'documents'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <FileText className="w-5 h-5" />
              Your Documents
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'topics'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Tag className="w-5 h-5" />
              Topics
            </button>
            <button
              onClick={() => setActiveTab('api-keys')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'api-keys'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Key className="w-5 h-5" />
              API Keys
            </button>
            <button
              onClick={() => setActiveTab('embeddings')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'embeddings'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Bot className="w-5 h-5" />
              Embeddings
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'chat' ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Conversation List Sidebar - Collapsible */}
              <ConversationList />
              {/* Chat Interface */}
              <div className="flex-1 overflow-hidden">
                <ChatInterface ragSettings={ragSettings} />
              </div>
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
