'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/chat/chat-interface';
import { CollectionManager } from '@/components/collections/collection-manager';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { RAGSettings } from '@/components/chat/rag-source-selector';
import { useConversationStore } from '@/lib/store/conversation-store';
import { BottomNavigation } from '@/components/mobile/bottom-navigation';
import { MobileSidebar, HamburgerMenu } from '@/components/mobile/mobile-sidebar';
import { useMobile } from '@/lib/hooks/use-mobile';
import { useToast } from '@/lib/hooks/use-toast';
import { UsageWarningBanner } from '@/components/notifications/usage-warning-banner';
// import { RoleDebug } from '@/components/debug/role-debug'; // Uncomment to debug role issues

type TabType = 'chat' | 'collections';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();
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
  const { selectConversation } = useConversationStore();

  // Read tab from URL query parameter on mount and when it changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['chat', 'collections'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
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
      // Sync subscription from PayPal (handles case where callback didn't run, e.g. Auto return OFF)
      import('@/lib/api').then(({ paymentApi }) => {
        paymentApi.syncSubscription().then((r) => {
          if (r.success && r.data?.synced) {
            checkAuth().catch(() => {});
          }
        }).catch(() => {});
      });
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
      const reason = searchParams.get('reason');
      if (reason === 'payment_not_found') {
        toast.error(
          "We couldn't find your payment record. Click 'Sync billing status' in Subscription settings to retry, or contact support.",
          { duration: 8000 } // Longer duration for this important message
        );
      } else {
        toast.error('Something went wrong. Please try again or contact support.');
      }
      router.replace('/dashboard/settings/subscription', { scroll: false });
    } else if (payment === 'pending') {
      // Try syncing - sometimes callback doesn't run but PayPal has activated the subscription
      import('@/lib/api').then(({ paymentApi }) => {
        paymentApi.syncSubscription().then((r) => {
          if (r.success && r.data?.synced) {
            toast.success('Subscription synced. Your plan has been updated.');
            checkAuth().catch(() => {});
          }
        }).catch(() => {});
      });
      toast.info('Payment is pending. Syncing with PayPal...');
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
      checkAuth()
        .then(() => {
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

  // Save RAG settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings]);



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto" />
            <div className="h-6 bg-gray-100 rounded w-1/3 mx-auto" />
            <div className="h-40 bg-gray-100 rounded" />
            <div className="h-6 bg-gray-100 rounded w-1/4 mx-auto" />
            <div className="h-6 bg-gray-100 rounded w-1/4 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Fixed Hamburger Menu for Mobile - Always Visible */}
      {isMobile && (
        <HamburgerMenu 
          onClick={() => setIsMobileSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 bg-white shadow-lg rounded-lg p-2 border border-gray-200"
        />
      )}
      
      {/* Top nav — only visible on mobile where sidebar is hidden */}
      {isMobile && (
        <nav className="bg-white flex-shrink-0 border-b border-gray-100">
          <div className="px-4">
            <div className="flex items-center h-12">
              <h1 className="text-base font-semibold text-gray-900">QueryAI</h1>
            </div>
          </div>
        </nav>
      )}

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
              subscriptionTier={user?.subscriptionTier || 'free'}
            />
          </MobileSidebar>
        )}

        {/* Desktop Sidebar */}
        {!isMobile && (
          <AppSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            subscriptionTier={user?.subscriptionTier || 'free'}
          />
        )}

        {/* Main Content Area — chat tab always shows conversation thread (messages + input), not sources */}
        <div className="flex-1 flex flex-col overflow-hidden" style={isMobile ? { paddingBottom: '64px' } : undefined}>
          {/* Usage warning banner */}
          <UsageWarningBanner />

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

      {/* Bottom Navigation (Mobile Only) — account + tier + sign out in bottom right when signed in */}
      <BottomNavigation
        user={user}
        subscriptionTier={user?.subscriptionTier || 'free'}
        onSignOut={async () => {
          await logout();
          router.push('/login');
        }}
      />
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
