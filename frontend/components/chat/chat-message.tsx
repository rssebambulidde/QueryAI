'use client';

import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import { Copy, Edit2, Check, X, Trash2, BookOpen, RefreshCw, ChevronDown, History, GitCompare, ThumbsUp, ThumbsDown, MessageSquare, Flag, FileText } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { SourceCitation } from './source-citation';
import { FollowUpQuestions } from './follow-up-questions';
import { EnhancedContentProcessor } from './enhanced-content-processor';
import { ChatErrorBoundary } from './chat-error-boundary';
import { SourceBreakdown } from './source-breakdown';
import { Source } from '@/lib/api';
import { MessageAttachments } from './attachment-preview';
import { analyticsApi, feedbackApi } from '@/lib/api';
import type { FlaggedCitation } from '@/lib/api';
import { ResponseTimeIndicator } from '@/components/health/response-time-indicator';
import { ConfidenceBadge } from './confidence-badge';
import { useMobile } from '@/lib/hooks/use-mobile';
import { formatRelativeTime } from '@/lib/utils/relative-time';
import 'highlight.js/styles/github-dark.css';

export interface SearchResult {
  id: string;
  documentId: string;
  title?: string;
  content: string;
  score: number;
}

export interface ChatMessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  followUpQuestions?: string[]; // AI-generated follow-up questions
  isActionResponse?: boolean; // Flag to indicate if this is an action-generated response
  isStreaming?: boolean; // Flag to indicate if message is still streaming
  isRefusal?: boolean; // true when response is an off-topic refusal (11.1)
  responseTime?: number; // Response time in milliseconds
  qualityScore?: number; // Answer quality score (0-1)
  searchResults?: SearchResult[]; // Results from /search command
  /** Ephemeral inline attachments (images / docs) — display only, not persisted */
  attachments?: import('./chat-types').ChatAttachment[];
  /** File names currently being extracted (set during extraction phase, cleared when done) */
  extractingFiles?: string[];
  // Version history
  version?: number;
  parentMessageId?: string | null;
  versions?: MessageVersionSummary[]; // All versions for version indicator
}

/** Minimal version shape for the UI version indicator / compare. */
export interface MessageVersionSummary {
  id: string;
  version: number;
  content: string;
  sources?: Source[];
  metadata?: Record<string, any>;
  created_at: string;
}

// Keep Message as an alias for backward compatibility
export type Message = ChatMessageType;

export interface RegenerateOptions {
  model?: string;
  maxDocumentChunks?: number;
  maxSearchResults?: number;
  enableWebSearch?: boolean;
  enableDocumentSearch?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessageProps {
  message: Message;
  previousResponseTime?: number; // Previous assistant message's response time for trend
  onEdit?: (messageId: string, newContent: string) => void;
  onFollowUpClick?: (question: string) => void;
  userQuestion?: string; // The user's original question for context
  /** Open Perplexity-style sources sidebar with this message's sources and optional query for header */
  onOpenSources?: (sources: Source[], query?: string) => void;
  isStreaming?: boolean; // Whether the message is currently streaming
  onExitResearchMode?: () => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string, options?: RegenerateOptions) => void | Promise<void>;
  onVersionSelect?: (messageId: string, version: MessageVersionSummary) => void;
  onCompareVersions?: (messageId: string, versions: MessageVersionSummary[]) => void;
  /** Conversation ID for citation click-through tracking. */
  conversationId?: string;
  /** Called when user flags a citation from within the message. */
  onFlagCitation?: (messageId: string, sourceUrl: string, sourceTitle: string) => void;
  /** Conversation mode — chat mode hides citations, sources, regenerate. */
  mode?: 'research' | 'chat';
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, previousResponseTime, onEdit, onFollowUpClick, userQuestion, onOpenSources, isStreaming = false, onExitResearchMode, onDelete, onRegenerate, onVersionSelect, onCompareVersions, conversationId, onFlagCitation, mode }) => {
  const { isMobile } = useMobile();
  const isUser = message.role === 'user';
  const isChatMode = mode === 'chat';
  const hasSources = !isChatMode && message.sources && message.sources.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [showRegenerateMenu, setShowRegenerateMenu] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [, setTimeTick] = useState(0);
  const [feedbackRating, setFeedbackRating] = useState<-1 | 1 | null>(null);
  const [showFeedbackComment, setShowFeedbackComment] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [flaggedCitations, setFlaggedCitations] = useState<FlaggedCitation[]>([]);
  const [showFlagMenu, setShowFlagMenu] = useState(false);
  const { toast } = useToast();

  // Re-render every 60s to keep relative timestamps fresh
  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Wrapper that awaits onRegenerate and always resets the spinner
  const handleRegenerate = async (options?: RegenerateOptions) => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(message.id, options);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Close regenerate menu on outside click
  useEffect(() => {
    if (!showRegenerateMenu) return;
    const handler = () => setShowRegenerateMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showRegenerateMenu]);

  // Close flag menu on outside click
  useEffect(() => {
    if (!showFlagMenu) return;
    const handler = () => setShowFlagMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showFlagMenu]);

  // ─── Feedback handler ─────────────────────────────────────────
  const handleFeedback = async (rating: -1 | 1) => {
    // Toggle off if same rating clicked again
    if (feedbackRating === rating) {
      setFeedbackRating(null);
      setShowFeedbackComment(false);
      try {
        await feedbackApi.deleteFeedback(message.id);
      } catch { /* silent */ }
      return;
    }

    setFeedbackRating(rating);
    // Show comment form for both thumbs up and thumbs down
    setShowFeedbackComment(true);
  };

  const submitFeedbackWithComment = async () => {
    if (!feedbackRating) return;
    setFeedbackSubmitting(true);
    try {
      await feedbackApi.submitFeedback({
        messageId: message.id,
        conversationId,
        rating: feedbackRating,
        comment: feedbackComment.trim() || undefined,
        flaggedCitations: flaggedCitations.length > 0 ? flaggedCitations : undefined,
        question: userQuestion,
        answer: message.content,
        sources: message.sources?.map(s => ({ type: s.type, title: s.title, url: s.url, snippet: s.snippet })),
      });
      toast.success(feedbackRating === 1 ? 'Thanks for the feedback!' : 'Feedback submitted — we\'ll review this answer');
      setShowFeedbackComment(false);
    } catch {
      toast.error('Failed to submit feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  /** Called from InlineCitation when user flags a source */
  const handleFlagCitation = (sourceUrl: string, sourceTitle: string) => {
    setFlaggedCitations(prev => {
      const exists = prev.some(c => c.sourceUrl === sourceUrl);
      if (exists) return prev.filter(c => c.sourceUrl !== sourceUrl);
      return [...prev, { sourceUrl, sourceTitle }];
    });
    onFlagCitation?.(message.id, sourceUrl, sourceTitle);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setJustCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setJustCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  // Count unique citation references in the message
  // Prefer structured citedSources from metadata when available (more accurate);
  // fall back to regex for older messages without structured data.
  const citationCount = useMemo(() => {
    if (isUser) return 0;
    const structured = (message as any).metadata?.citedSources;
    if (Array.isArray(structured) && structured.length > 0) return structured.length;
    const matches = message.content.match(/\[(?:Web Source |Document |Source )?\d+\]/g);
    if (!matches) return 0;
    return new Set(matches).size;
  }, [message.content, isUser, (message as any).metadata?.citedSources]);

  // Memoize flagged citation URLs as a Set for O(1) lookup
  const flaggedCitationUrls = useMemo(
    () => new Set(flaggedCitations.map(c => c.sourceUrl)),
    [flaggedCitations]
  );

  return (
    <div
      className={cn(
        'flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn('flex flex-col w-full', isUser ? 'items-end max-w-[92%] sm:max-w-[85%]' : 'items-stretch max-w-full')}>
        {/* Message Bubble */}
        <div
          className={cn(
            'rounded-2xl shadow-sm',
            isUser
              ? 'px-4 py-3 bg-gradient-to-br from-orange-600 to-orange-700 text-white'
              : 'px-4 py-3.5 bg-white border border-gray-200 text-gray-900 w-full'
          )}
        >
          {/* Role Label - hide when assistant is streaming with empty content */}
          {!(!isUser && (isStreaming || message.isStreaming) && !(message.content || '').trim()) && (
            <div
              className={cn(
                'text-xs font-semibold mb-2 uppercase tracking-wide',
                isUser ? 'text-orange-100' : 'text-gray-500'
              )}
            >
              {isUser ? 'You' : 'Query Assistant'}
            </div>
          )}

          {/* Content - full width for assistant so text is well aligned, no gap on right */}
          <div className={cn(
            'max-w-none break-words overflow-wrap-anywhere',
            isUser ? 'prose prose-sm prose-invert max-w-none' : 'min-w-0 w-full text-left prose prose-sm prose-gray max-w-none'
          )}>
            {isUser && isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white resize-none min-h-[44px] text-base sm:text-sm"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 flex items-center gap-1 touch-manipulation min-h-[44px] min-w-[44px]"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1 touch-manipulation min-h-[44px] min-w-[44px]"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : isUser ? (
              <div>
                {/* Inline attachments (images / docs) */}
                {message.attachments && message.attachments.length > 0 && (
                  <MessageAttachments attachments={message.attachments} className="mb-2" />
                )}
                <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</div>
              </div>
            ) : !isUser && (isStreaming || message.isStreaming) && !(message.content || '').trim() ? (
              <div className="flex items-center gap-1.5 text-gray-500">
                {message.extractingFiles && message.extractingFiles.length > 0 ? (
                  <>
                    <FileText className="w-4 h-4 text-orange-400 animate-pulse" />
                    <span className="text-sm">
                      Extracting text from{' '}
                      <span className="font-medium text-gray-700">
                        {message.extractingFiles.length === 1
                          ? message.extractingFiles[0]
                          : `${message.extractingFiles.length} files`}
                      </span>
                      ...
                    </span>
                  </>
                ) : (
                  <span className="text-sm">Query assistant, thinking.</span>
                )}
                <span className="flex gap-0.5" aria-hidden>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            ) : message.searchResults && message.searchResults.length > 0 ? (
              <div>
                <p className="text-sm text-gray-600 mb-3">{message.content}</p>
                <div className="space-y-2">
                  {message.searchResults.map((result, idx) => (
                    <div
                      key={result.id || idx}
                      className="p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50/30 transition-colors cursor-pointer"
                      onClick={() => {
                        if (result.documentId) {
                          onOpenSources?.([{
                            type: 'document',
                            title: result.title || `Document result ${idx + 1}`,
                            snippet: result.content.slice(0, 300),
                            score: result.score,
                            documentId: result.documentId,
                          }], '');
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                          {result.title || `Document result ${idx + 1}`}
                        </h4>
                        <span className={cn(
                          'flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded',
                          result.score >= 0.8 ? 'bg-green-100 text-green-700' : result.score >= 0.6 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        )}>
                          {(result.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-3">{result.content.slice(0, 300)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ChatErrorBoundary
                scope="message"
                rawContent={message.content}
              >
                <EnhancedContentProcessor
                  content={(message.content || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim()}
                  sources={message.sources}
                  isUser={false}
                  messageId={message.id}
                  onCitationClick={(sourceIndex, sourceUrl, sourceType) => {
                    analyticsApi.trackCitationClick({
                      messageId: message.id,
                      conversationId,
                      sourceIndex,
                      sourceUrl,
                      sourceType,
                    }).catch(() => { /* fire-and-forget */ });
                  }}
                  onFlagCitation={handleFlagCitation}
                  flaggedCitationUrls={flaggedCitationUrls}
                />
              </ChatErrorBoundary>
            )}
          </div>

          {/* Source type breakdown (documents vs web) */}
          {!isUser && !isStreaming && !message.isStreaming && hasSources && (
            <SourceBreakdown sources={message.sources || []} className="mt-3" />
          )}

          {/* Timestamp, Response Time, and Actions */}
          <div className="flex items-center justify-between mt-2 flex-wrap gap-y-1 gap-x-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={cn(
                  'text-xs opacity-70',
                  isUser ? 'text-orange-100' : 'text-gray-500'
                )}
                title={message.timestamp.toLocaleString()}
              >
                {formatRelativeTime(message.timestamp)}
              </div>
              {!isUser && message.responseTime !== undefined && (
                <ResponseTimeIndicator
                  responseTime={message.responseTime}
                  previousResponseTime={previousResponseTime}
                  showTrend={true}
                  size="sm"
                />
              )}
              {!isUser && !isStreaming && !message.isStreaming && message.qualityScore !== undefined && (
                <ConfidenceBadge score={message.qualityScore} />
              )}
              {!isUser && !isStreaming && !message.isStreaming && citationCount > 0 && !isChatMode && (
                <button
                  onClick={() => onOpenSources?.(message.sources ?? [], '')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium leading-tight hover:bg-blue-100 transition-colors"
                  title="View cited sources"
                >
                  <BookOpen className="w-3 h-3" />
                  {citationCount} source{citationCount !== 1 ? 's' : ''} cited
                </button>
              )}
            </div>
            <div
              className={cn(
                'flex items-center gap-0.5 sm:gap-1 flex-wrap transition-opacity',
                isMobile ? 'opacity-100' : (isHovered ? 'opacity-100' : 'opacity-0')
              )}
            >
              <button
                onClick={handleCopy}
                className={cn(
                  'rounded hover:bg-opacity-20 transition-colors touch-manipulation',
                  'min-w-[44px] min-h-[44px] flex items-center justify-center',
                  justCopied
                    ? 'text-green-500 p-1.5'
                    : isUser ? 'text-orange-100 hover:bg-white p-1.5' : 'text-gray-400 hover:bg-gray-100 p-1.5'
                )}
                title={justCopied ? 'Copied!' : 'Copy message'}
                aria-label="Copy message"
              >
                {justCopied ? <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
              </button>
              {isUser && onEdit && !isEditing && (
                <button
                  onClick={handleEdit}
                  className={cn(
                    'rounded hover:bg-opacity-20 transition-colors touch-manipulation',
                    'min-w-[44px] min-h-[44px] flex items-center justify-center',
                    'text-orange-100 hover:bg-white p-1.5'
                  )}
                  title="Edit message"
                  aria-label="Edit message"
                >
                  <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              )}
              {onDelete && !showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={cn(
                    'rounded hover:bg-opacity-20 transition-colors touch-manipulation',
                    'min-w-[44px] min-h-[44px] flex items-center justify-center',
                    isUser ? 'text-orange-100 hover:bg-white p-1.5' : 'text-gray-400 hover:bg-red-50 hover:text-red-500 p-1.5'
                  )}
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              )}
              {showDeleteConfirm && (
                <div className="flex items-center gap-1 bg-red-50 rounded-lg px-2 py-1 border border-red-200">
                  <span className="text-xs text-red-600 mr-1">Delete?</span>
                  <button
                    onClick={() => { onDelete?.(message.id); setShowDeleteConfirm(false); }}
                    className="p-1 rounded hover:bg-red-100 text-red-600 touch-manipulation min-w-[36px] min-h-[36px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center"
                    title="Confirm delete"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500 touch-manipulation min-w-[36px] min-h-[36px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Regenerate button for assistant messages — hidden in chat mode */}
              {!isUser && onRegenerate && !isChatMode && !message.isActionResponse && !isStreaming && !message.isStreaming && (
                <div className="relative">
                  <div className="flex items-center">
                    <button
                      onClick={() => handleRegenerate()}
                      disabled={isRegenerating}
                      className={cn(
                        'rounded-l hover:bg-opacity-20 transition-colors touch-manipulation',
                        'min-w-[36px] min-h-[44px] flex items-center justify-center',
                        'text-gray-400 hover:bg-gray-100 hover:text-gray-600 p-1.5',
                        isRegenerating && 'animate-spin'
                      )}
                      title="Regenerate response"
                      aria-label="Regenerate response"
                    >
                      <RefreshCw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowRegenerateMenu(!showRegenerateMenu)}
                      className={cn(
                        'rounded-r hover:bg-opacity-20 transition-colors touch-manipulation',
                        'min-w-[20px] min-h-[44px] flex items-center justify-center',
                        'text-gray-400 hover:bg-gray-100 hover:text-gray-600 p-0.5'
                      )}
                      title="Regenerate options"
                      aria-label="Regenerate options"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  {showRegenerateMenu && (
                    <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
                      <button
                        onClick={() => { setShowRegenerateMenu(false); handleRegenerate({}); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                      </button>
                      <button
                        onClick={() => { setShowRegenerateMenu(false); handleRegenerate({ maxDocumentChunks: 15, maxSearchResults: 12, enableWebSearch: true, enableDocumentSearch: true, temperature: 0.7 }); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        More sources
                      </button>
                      <button
                        onClick={() => { setShowRegenerateMenu(false); handleRegenerate({ temperature: 0.2, maxTokens: 600 }); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="text-xs font-mono w-3.5 h-3.5 flex items-center justify-center">T↓</span>
                        Shorter &amp; precise
                      </button>
                      <button
                        onClick={() => { setShowRegenerateMenu(false); handleRegenerate({ temperature: 1.0, maxTokens: 4096 }); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="text-xs font-mono w-3.5 h-3.5 flex items-center justify-center">T↑</span>
                        Longer &amp; creative
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Version history indicator — only for assistant messages with 2+ versions */}
        {!isUser && message.versions && message.versions.length > 1 && !isStreaming && !message.isStreaming && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <History className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-1 py-0.5">
              {message.versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onVersionSelect?.(message.id, v)}
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    v.version === (message.version ?? 1)
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  )}
                  title={`Version ${v.version} — ${new Date(v.created_at).toLocaleString()}`}
                >
                  v{v.version}
                </button>
              ))}
            </div>
            {message.versions.length >= 2 && onCompareVersions && (
              <button
                onClick={() => onCompareVersions(message.id, message.versions!)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors"
                title="Compare versions side by side"
              >
                <GitCompare className="w-3 h-3" />
                Compare
              </button>
            )}
          </div>
        )}


        {/* Feedback — thumbs up / thumbs down for assistant messages */}
        {!isUser && !isStreaming && !message.isStreaming && message.content.trim() && (
          <div className="mt-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleFeedback(1)}
                disabled={feedbackSubmitting}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                  feedbackRating === 1
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 border border-transparent'
                )}
                title="Helpful answer"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleFeedback(-1)}
                disabled={feedbackSubmitting}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                  feedbackRating === -1
                    ? 'bg-red-100 text-red-700 border border-red-300'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 border border-transparent'
                )}
                title="Not helpful"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
              {flaggedCitations.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                  <Flag className="w-3 h-3" />
                  {flaggedCitations.length} flagged
                </span>
              )}
              {/* Flag citation button — visible when message has sources and not chat mode */}
              {!isChatMode && message.sources && message.sources.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowFlagMenu(!showFlagMenu)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                      showFlagMenu
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 border border-transparent'
                    )}
                    title="Flag a citation"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                  {showFlagMenu && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[200px] sm:min-w-[240px] max-w-[calc(100vw-2rem)] sm:max-w-[320px] max-h-[200px] overflow-y-auto">
                      <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">Flag citations</div>
                      {message.sources.map((src, idx) => {
                        const isFlagged = flaggedCitations.some(c => c.sourceUrl === (src.url || ''));
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              handleFlagCitation(src.url || '', src.title || `Source ${idx + 1}`);
                            }}
                            className={cn(
                              'w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors',
                              isFlagged
                                ? 'bg-amber-50 text-amber-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            <Flag className={cn('w-3 h-3 flex-shrink-0', isFlagged ? 'text-amber-600' : 'text-gray-400')} />
                            <span className="truncate">{src.title || src.url || `Source ${idx + 1}`}</span>
                            {isFlagged && <Check className="w-3 h-3 ml-auto text-amber-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comment form for feedback */}
            {showFeedbackComment && feedbackRating && (
              <div className="mt-2 space-y-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {feedbackRating === 1 ? 'What was helpful? (optional)' : 'What went wrong? (optional)'}
                </div>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder={feedbackRating === 1 ? 'The answer was accurate, well-sourced, etc.' : 'The answer was inaccurate, missing information, etc.'}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg bg-white resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                  rows={2}
                  maxLength={2000}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={submitFeedbackWithComment}
                    disabled={feedbackSubmitting}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {feedbackSubmitting ? 'Submitting…' : 'Submit feedback'}
                  </button>
                  <button
                    onClick={() => { setShowFeedbackComment(false); setFeedbackRating(null); }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Follow-up Questions for Assistant Messages - Show AI-generated questions */}
        {!isUser && onFollowUpClick && message.followUpQuestions && message.followUpQuestions.length > 0 && !message.isActionResponse && (
          <FollowUpQuestions
            questions={message.followUpQuestions}
            onQuestionClick={onFollowUpClick}
            className="mt-3"
          />
        )}

      </div>
    </div>
  );
};

// Follow-up questions are now generated by the backend and included in the API response
// The frontend simply renders what the backend returns in message.followUpQuestions
