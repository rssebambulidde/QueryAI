'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/chat/chat-interface';
import { CollectionManager } from '@/components/collections/collection-manager';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { RAGSettings } from '@/components/chat/rag-source-selector';
import { documentApi } from '@/lib/api';
import { useConversationStore } from '@/lib/store/conversation-store';
import { BottomNavigation } from '@/components/mobile/bottom-navigation';
import { MobileSidebar, HamburgerMenu } from '@/components/mobile/mobile-sidebar';
import { useMobile } from '@/lib/hooks/use-mobile';
import { useToast } from '@/lib/hooks/use-toast';

type TabType = 'chat' | 'collections';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isMobile } = useMobile();
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
  const { selectConversation } = useConversationStore();

  // Read tab from URL query parameter on mount and when it changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['chat', 'collections'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    } else if (tabParam === 'documents') {
      // Redirect to settings/documents
      router.replace('/dashboard/settings/documents');
    } else if (tabParam === 'topics') {
      // Redirect to settings/topics
      router.replace('/dashboard/settings/topics');
    } else if (tabParam === 'subscription') {
      // Redirect to settings/subscription
      router.replace('/dashboard/settings/subscription');
    }
  }, [searchParams]);

  // Handle PayPal redirect query params (payment=success | cancelled | failed | error | pending)
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment) return;

    if (payment === 'success') {
      toast.success('Payment completed. Your subscription has been updated.');
      router.replace('/dashboard/settings/subscription', { scroll: false });
      checkAuth().catch(() => {});
    } else if (payment === 'cancelled') {
      toast.info('Payment was cancelled.');
      router.replace('/dashboard', { scroll: false });
    } else if (payment === 'failed') {
      toast.error('Payment failed. Please try again or contact support.');
      router.replace('/dashboard/settings/subscription', { scroll: false });
    } else if (payment === 'error') {
      toast.error('Something went wrong. Please try again or contact support.');
      router.replace('/dashboard/settings/subscription', { scroll: false });
    } else if (payment === 'pending') {
      toast.info('Payment is pending. Your subscription will update when payment completes.');
      router.replace('/dashboard/settings/subscription', { scroll: false });
    }
  }, [searchParams, toast, router, checkAuth]);

  // Listen for navigation to subscription tab from chat errors
  useEffect(() => {
    const handleNavigateToSubscription = () => {
      // Navigate to settings subscription page
      router.push('/dashboard/settings/subscription', { scroll: false });
    };
    
    window.addEventListener('navigateToSubscription', handleNavigateToSubscription);
    return () => {
      window.removeEventListener('navigateToSubscription', handleNavigateToSubscription);
    };
  }, [router]);

  // Check auth on mount - only once to get fresh user data including subscriptionTier
  // Skip if we already have user data from login (to avoid redundant API calls)
  useEffect(() => {
    if (!hasCheckedAuth) {
      // If we already have user data and are authenticated, skip checkAuth
      // Login already provides fresh user data, so we don't need to call checkAuth immediately
      // Only call checkAuth if we don't have user data yet
      if (isAuthenticated && user) {
        // We have user data from login, just mark as checked
        console.log('[Dashboard] User data already available from login, skipping checkAuth');
        setHasCheckedAuth(true);
      } else {
        // No user data yet, call checkAuth to get it
        checkAuth()
          .then(() => {
            // After auth check, verify subscription tier is loaded
            if (typeof window !== 'undefined') {
              console.log('[Dashboard] Auth check complete - User subscription tier:', user?.subscriptionTier);
            }
          })
          .catch(() => {
            // Auth check failed, will redirect below
          })
          .finally(() => {
            setHasCheckedAuth(true);
          });
      }
    }
    // Only run once on mount - don't add dependencies that would cause re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

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
            <div className="flex items-center gap-3">
              {isMobile && (
                <HamburgerMenu onClick={() => setIsMobileSidebarOpen(true)} />
              )}
              <h1 className="text-xl font-bold text-gray-900">QueryAI</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar */}
        {isMobile && (
          <MobileSidebar
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          >
            <AppSidebar
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                setIsMobileSidebarOpen(false);
              }}
              ragSettings={ragSettings}
              onRagSettingsChange={setRagSettings}
              documentCount={documentCount}
              hasProcessedDocuments={hasProcessedDocuments}
              subscriptionTier={user?.subscriptionTier || 'free'}
            />
          </MobileSidebar>
        )}

        {/* Desktop Sidebar */}
        {!isMobile && (
          <AppSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            ragSettings={ragSettings}
            onRagSettingsChange={setRagSettings}
            documentCount={documentCount}
            hasProcessedDocuments={hasProcessedDocuments}
            subscriptionTier={user?.subscriptionTier || 'free'}
          />
        )}

        {/* Main Content Area — chat tab always shows conversation thread (messages + input), not sources */}
        <div className="flex-1 flex flex-col overflow-hidden" style={isMobile ? { paddingBottom: '64px' } : undefined}>
          {activeTab === 'chat' ? (
            <div className="flex-1 overflow-hidden">
              <ChatInterface ragSettings={ragSettings} />
            </div>
          ) : activeTab === 'collections' ? (
             <div className="flex-1 overflow-y-auto p-6">
               <CollectionManager 
                 onConversationSelect={(conversationId) => {
                   // Switch to chat tab and select the conversation
                   setActiveTab('chat');
                   selectConversation(conversationId);
                 }}
               />
             </div>
          ) : null}
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <BottomNavigation />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
