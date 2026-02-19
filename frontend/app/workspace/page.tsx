'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { workspaceApi } from '@/lib/api';
import { ResearchGraph } from '@/components/workspace/research-graph';
import type { WorkspaceGraphData } from '@/components/workspace/research-graph';
import { ArrowLeft, RefreshCw, Loader2, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspacePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [graphData, setGraphData] = useState<WorkspaceGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Auth check ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hasCheckedAuth) {
      if (isAuthenticated && user) {
        setHasCheckedAuth(true);
      } else {
        checkAuth()
          .catch(() => {})
          .finally(() => setHasCheckedAuth(true));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasCheckedAuth && !authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasCheckedAuth, authLoading, isAuthenticated, router]);

  // ── Fetch graph data ─────────────────────────────────────────────
  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await workspaceApi.getGraph();
      if (res.success && res.data) {
        setGraphData(res.data);
      } else {
        setError('Failed to load workspace data');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load workspace data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasCheckedAuth && isAuthenticated) {
      fetchGraph();
    }
  }, [hasCheckedAuth, isAuthenticated, fetchGraph]);

  // ── Navigation handlers ──────────────────────────────────────────
  const handleTopicClick = useCallback(
    (topicId: string) => {
      // Navigate to dashboard with the topic selected
      router.push(`/dashboard?topicId=${topicId}`);
    },
    [router]
  );

  const handleDocumentClick = useCallback(
    (documentId: string) => {
      router.push(`/dashboard/settings/documents?doc=${documentId}`);
    },
    [router]
  );

  // ── Loading / error states ───────────────────────────────────────
  if (!hasCheckedAuth || authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900">Research Workspace</h1>
          </div>
          {graphData && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 ml-4">
              <span>{graphData.topics.length} topics</span>
              <span>·</span>
              <span>{graphData.documents.length} documents</span>
            </div>
          )}
        </div>

        <Button
          onClick={fetchGraph}
          disabled={isLoading}
          variant="outline"
          className="gap-2 text-sm h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 relative overflow-hidden">
        {isLoading && !graphData && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading research workspace…</p>
            </div>
          </div>
        )}

        {error && !graphData && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-sm">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <Button onClick={fetchGraph} variant="outline" className="text-sm">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {graphData && (
          <ResearchGraph
            data={graphData}
            onTopicClick={handleTopicClick}
            onDocumentClick={handleDocumentClick}
          />
        )}
      </main>
    </div>
  );
}
