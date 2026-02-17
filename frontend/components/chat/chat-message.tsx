'use client';

import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import { Copy, Edit2, Check, X, Trash2, BookOpen } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { SourceCitation } from './source-citation';
import { FollowUpQuestions } from './follow-up-questions';
import { EnhancedContentProcessor } from './enhanced-content-processor';
import { AIActionButtons } from './ai-action-buttons';
import { Source, aiApi } from '@/lib/api';
import { exportToPdf } from '@/lib/export-pdf';
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
  isTopicChangeMessage?: boolean; // synthetic "Research mode disabled" / "topic now" – hide action buttons
  responseTime?: number; // Response time in milliseconds
  qualityScore?: number; // Answer quality score (0-1)
  searchResults?: SearchResult[]; // Results from /search command
}

// Keep Message as an alias for backward compatibility
export type Message = ChatMessageType;

const REFUSAL_PATTERN = /outside|limited to|disable research mode|research (mode|topic)/i;

interface ChatMessageProps {
  message: Message;
  previousResponseTime?: number; // Previous assistant message's response time for trend
  onEdit?: (messageId: string, newContent: string) => void;
  onFollowUpClick?: (question: string) => void;
  userQuestion?: string; // The user's original question for context
  onActionResponse?: (content: string, actionType?: 'summary' | 'essay' | 'report') => void; // Callback for action responses
  /** Open Perplexity-style sources sidebar with this message's sources and optional query for header */
  onOpenSources?: (sources: Source[], query?: string) => void;
  isStreaming?: boolean; // Whether the message is currently streaming
  selectedTopicName?: string | null; // For refusal hint (11.2)
  onExitResearchMode?: () => void; // For refusal hint "exit research mode" action
  onDelete?: (messageId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, previousResponseTime, onEdit, onFollowUpClick, userQuestion, onActionResponse, onOpenSources, isStreaming = false, selectedTopicName, onExitResearchMode, onDelete }) => {
  const { isMobile } = useMobile();
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [, setTimeTick] = useState(0);
  const { toast } = useToast();

  // Re-render every 60s to keep relative timestamps fresh
  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

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
  const citationCount = useMemo(() => {
    if (isUser) return 0;
    const matches = message.content.match(/\[(?:Web Source |Document |Source )?\d+\]/g);
    if (!matches) return 0;
    return new Set(matches).size;
  }, [message.content, isUser]);

  // Debug: Log quality score and citation count for assistant messages
  useEffect(() => {
    if (!isUser && message.qualityScore !== undefined) {
      console.log('[ChatMessage] Quality score for message:', message.id, '=', message.qualityScore, 'isStreaming:', isStreaming, 'message.isStreaming:', message.isStreaming);
    }
    if (!isUser && citationCount > 0) {
      console.log('[ChatMessage] Citation count for message:', message.id, '=', citationCount, 'isStreaming:', isStreaming, 'message.isStreaming:', message.isStreaming);
    }
  }, [message.qualityScore, citationCount, isUser, message.id, isStreaming, message.isStreaming]);

  // Replace [Source N] and [Web Source N] patterns with hyperlinks using source titles
  // Also handles "Sources:" lines with multiple citations
  const processContentWithSources = (content: string, sources?: Source[]): string => {
    if (!sources || sources.length === 0) return content;
    
    let processedContent = content;
    
    // First, process "Sources:" lines that contain multiple citations
    // Pattern: "Sources: [Web Source 1](URL), [Document 1], [Web Source 2](URL)"
    const sourcesLinePattern = /Sources:\s*((?:\[(?:Web Source|Document)\s+\d+\](?:\([^)]+\))?(?:\s*,\s*)?)+)/gi;
    processedContent = processedContent.replace(sourcesLinePattern, (match, citations) => {
      // Process each citation in the line
      const citationPattern = /\[(Web Source|Document)\s+(\d+)\](?:\(([^)]+)\))?/gi;
      const citationsList: string[] = [];
      
      let citationMatch;
      let lastIndex = 0;
      while ((citationMatch = citationPattern.exec(citations)) !== null) {
        const [, type, number] = citationMatch;
        const sourceIndex = parseInt(number) - 1;
        
        if (type === 'Web Source') {
          const webSource = sources[sourceIndex] && sources[sourceIndex].type === 'web' 
            ? sources[sourceIndex] 
            : sources.find(s => s.type === 'web' && s.url);
          if (webSource && webSource.url) {
            const linkText = webSource.title || `Web Source ${number}`;
            citationsList.push(`[${linkText}](${webSource.url} "${webSource.title || linkText}")`);
          }
        } else if (type === 'Document') {
          const docSource = sources[sourceIndex] && sources[sourceIndex].type === 'document'
            ? sources[sourceIndex]
            : sources.find(s => s.type === 'document');
          if (docSource) {
            const linkText = docSource.title || `Document ${number}`;
            if (docSource.url) {
              citationsList.push(`[${linkText}](${docSource.url} "${docSource.title || linkText}")`);
            } else {
              citationsList.push(`**${linkText}**`);
            }
          }
        }
      }
      
      return 'Sources: ' + citationsList.join(', ');
    });
    
    // Then process standalone citations (not in Sources: lines)
    // Process web sources
    const webSources = sources.filter(s => s.type === 'web' && s.url);
    webSources.forEach((source, index) => {
      const sourceNumber = index + 1;
      
      // Only replace if not already in a "Sources:" line
      const pattern = new RegExp(`(?!Sources:.*)\\[Web Source ${sourceNumber}\\](?:\\([^)]+\\))?`, 'gi');
      const linkText = source.title || `Web Source ${sourceNumber}`;
      const replacement = `[${linkText}](${source.url} "${source.title || linkText}")`;
      
      processedContent = processedContent.replace(pattern, replacement);
    });
    
    // Process document sources
    const documentSources = sources.filter(s => s.type === 'document');
    documentSources.forEach((source, index) => {
      const sourceNumber = index + 1;
      // Only replace if not already in a "Sources:" line
      const pattern = new RegExp(`(?!Sources:.*)\\[Document ${sourceNumber}\\]`, 'gi');
      
      const linkText = source.title || `Document ${sourceNumber}`;
      
      if (source.url) {
        processedContent = processedContent.replace(
          pattern,
          `[${linkText}](${source.url} "${source.title || linkText}")`
        );
      } else {
        processedContent = processedContent.replace(
          pattern,
          `**${linkText}**`
        );
      }
    });
    
    return processedContent;
  };

  const processedContent = isUser || !hasSources 
    ? message.content 
    : processContentWithSources(message.content, message.sources);

  return (
    <div
      className={cn(
        'flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn('flex flex-col w-full', isUser ? 'items-end max-w-[85%]' : 'items-stretch max-w-full')}>
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
              <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</div>
            ) : !isUser && (isStreaming || message.isStreaming) && !(message.content || '').trim() ? (
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="text-sm">Query assistant, thinking.</span>
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
              <>
                <EnhancedContentProcessor
                  content={(message.content || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim()}
                  sources={message.sources}
                  isUser={false}
                />
              </>
            )}
          </div>

          {/* Timestamp, Response Time, and Actions */}
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
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
              {!isUser && !isStreaming && !message.isStreaming && citationCount > 0 && (
                <button
                  onClick={() => onOpenSources?.(message.sources ?? [], '')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-medium leading-tight hover:bg-blue-100 transition-colors"
                  title="View cited sources"
                >
                  <BookOpen className="w-3 h-3" />
                  {citationCount} source{citationCount !== 1 ? 's' : ''} cited
                </button>
              )}
            </div>
            <div
              className={cn(
                'flex items-center gap-1 transition-opacity',
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
                    className="p-1 rounded hover:bg-red-100 text-red-600 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
                    title="Confirm delete"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Ellipsis menu for assistant messages with actions */}
              {!isUser && onActionResponse && !message.isActionResponse && !message.isTopicChangeMessage && !isStreaming && !message.isStreaming && (
                <AIActionButtons
                  onSummarize={async () => {
                    if (!userQuestion) return;
                    setIsActionLoading(true);
                    try {
                      const response = await aiApi.summarize(
                        message.content.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim(),
                        userQuestion,
                        message.sources
                      );
                      if (response.success && response.data) {
                        onActionResponse(response.data.summary, 'summary');
                      } else {
                        toast.error(response.message || 'Failed to generate summary');
                      }
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to generate summary');
                    } finally {
                      setIsActionLoading(false);
                    }
                  }}
                  onWriteEssay={async () => {
                    if (!userQuestion) return;
                    setIsActionLoading(true);
                    try {
                      const response = await aiApi.writeEssay(
                        message.content.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim(),
                        userQuestion,
                        message.sources
                      );
                      if (response.success && response.data) {
                        onActionResponse(response.data.essay, 'essay');
                      } else {
                        toast.error(response.message || 'Failed to generate essay');
                      }
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to generate essay');
                    } finally {
                      setIsActionLoading(false);
                    }
                  }}
                  onDetailedReport={async () => {
                    if (!userQuestion) return;
                    setIsActionLoading(true);
                    try {
                      const response = await aiApi.generateReport(
                        message.content.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim(),
                        userQuestion,
                        message.sources
                      );
                      if (response.success && response.data) {
                        onActionResponse(response.data.report, 'report');
                      } else {
                        toast.error(response.message || 'Failed to generate report');
                      }
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to generate report');
                    } finally {
                      setIsActionLoading(false);
                    }
                  }}
                  onExport={() => {
                    try {
                      const content = message.content.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim();
                      exportToPdf({
                        question: userQuestion ?? '',
                        answer: content,
                        sources: message.sources ?? [],
                      });
                    } catch {
                      toast.error('Failed to export PDF');
                    }
                  }}
                  isLoading={isActionLoading}
                />
              )}
            </div>
          </div>
        </div>


        {/* Follow-up Questions for Assistant Messages - Show AI-generated questions */}
        {!isUser && onFollowUpClick && message.followUpQuestions && message.followUpQuestions.length > 0 && !message.isActionResponse && (
          <FollowUpQuestions
            questions={message.followUpQuestions}
            onQuestionClick={onFollowUpClick}
            className="mt-3"
          />
        )}

        {/* 11.2 Refusal hint: when message is a refusal and in research mode */}
        {!isUser &&
          selectedTopicName &&
          (message.isRefusal || (REFUSAL_PATTERN.test(message.content || '') && (message.content?.length || 0) < 500)) && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-800">
              This question seems outside <strong>{selectedTopicName}</strong>.{' '}
              {onExitResearchMode ? (
                <>
                  Ask something about {selectedTopicName} or{' '}
                  <button
                    type="button"
                    onClick={onExitResearchMode}
                    className="font-medium underline hover:no-underline"
                  >
                    exit research mode
                  </button>{' '}
                  to ask anything.
                </>
              ) : (
                `Ask something about ${selectedTopicName} or exit research mode to ask anything.`
              )}
            </div>
          )}
      </div>
    </div>
  );
};

// Follow-up questions are now generated by the backend and included in the API response
// The frontend simply renders what the backend returns in message.followUpQuestions