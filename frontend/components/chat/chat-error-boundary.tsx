'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Eye, EyeOff, RotateCcw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatErrorBoundaryProps {
  children: ReactNode;
  /** Optional raw markdown to show in the "View raw text" toggle */
  rawContent?: string;
  /** Contextual label shown in the fallback UI (e.g. "this message" vs "the chat") */
  scope?: 'message' | 'chat';
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showRaw: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * React class-component error boundary for chat rendering.
 *
 * Two usage modes:
 *   1. **Per-message** — wraps a single `<EnhancedContentProcessor>`.
 *      Pass `rawContent` so the user can toggle raw markdown on failure.
 *   2. **List-level** — wraps the entire `<ChatMessageList>`.
 *      Provides a generic retry/fallback when an unknown rendering error
 *      propagates past individual message boundaries.
 */
export class ChatErrorBoundary extends Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showRaw: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ChatErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const scope = this.props.scope ?? 'message';

    // Structured error payload — picked up by any log aggregator watching
    // the browser console, or can be forwarded to the backend error endpoint.
    console.error('[ChatErrorBoundary] Rendering failure', {
      scope,
      errorMessage: error.message,
      errorName: error.name,
      componentStack: errorInfo.componentStack,
      rawContentLength: this.props.rawContent?.length,
      timestamp: new Date().toISOString(),
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showRaw: false });
  };

  private toggleRaw = () => {
    this.setState((prev) => ({ showRaw: !prev.showRaw }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const scope = this.props.scope ?? 'message';
    const isMessage = scope === 'message';

    return (
      <div
        className={
          isMessage
            ? 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm'
            : 'flex flex-1 items-center justify-center p-8'
        }
      >
        <div className={isMessage ? '' : 'max-w-md text-center'}>
          {/* Header */}
          <div
            className={`flex items-center gap-2 text-amber-700 ${
              isMessage ? '' : 'justify-center'
            }`}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">
              {isMessage
                ? 'Something went wrong rendering this message.'
                : 'Something went wrong rendering the chat.'}
            </span>
          </div>

          {/* Raw text toggle (message scope only) */}
          {isMessage && this.props.rawContent && (
            <div className="mt-2">
              <button
                onClick={this.toggleRaw}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
              >
                {this.state.showRaw ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide raw text
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    View raw text
                  </>
                )}
              </button>

              {this.state.showRaw && (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white/70 p-2 text-xs text-gray-800 border border-amber-100">
                  {this.props.rawContent}
                </pre>
              )}
            </div>
          )}

          {/* Retry button */}
          <button
            onClick={this.handleRetry}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isMessage
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </button>

          {/* Error detail (dev only) */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <p className="mt-2 text-xs text-gray-500 break-all">
              {this.state.error.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
