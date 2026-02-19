'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Globe, FileText, MessageSquare, ExternalLink, ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyticsApi, CitedSource, SourceConversation } from '@/lib/api';
import { useConversationStore } from '@/lib/store/conversation-store';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/lib/hooks/use-mobile';

interface SourceExplorerModalProps {
  source: CitedSource;
  isOpen: boolean;
  onClose: () => void;
}

export const SourceExplorerModal: React.FC<SourceExplorerModalProps> = ({
  source,
  isOpen,
  onClose,
}) => {
  const { isMobile } = useMobile();
  const [conversations, setConversations] = useState<SourceConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { selectConversation } = useConversationStore();
  const { toast } = useToast();

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await analyticsApi.getSourceConversations(source.id);
      if (res.success && res.data) {
        setConversations(res.data.conversations);
      }
    } catch {
      toast.error('Failed to load source conversations');
    } finally {
      setIsLoading(false);
    }
  }, [source.id, toast]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  if (!isOpen) return null;

  const isWeb = source.source_type === 'web';
  const displayTitle = source.source_title || source.source_domain || source.source_url || 'Untitled Source';

  const handleNavigate = (conversationId: string) => {
    selectConversation(conversationId);
    onClose();
  };

  const handleOpenUrl = () => {
    if (source.source_url) {
      window.open(source.source_url, '_blank');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white shadow-xl flex flex-col',
          isMobile
            ? 'w-full h-full rounded-none'
            : 'rounded-lg max-w-lg w-full mx-4 max-h-[80vh]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          'flex items-start justify-between border-b border-gray-200 flex-shrink-0',
          isMobile ? 'px-4 py-3' : 'px-5 py-4'
        )}>
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
              isWeb ? 'bg-blue-50' : 'bg-emerald-50'
            )}>
              {isWeb ? (
                <Globe className="w-4.5 h-4.5 text-blue-500" />
              ) : (
                <FileText className="w-4.5 h-4.5 text-emerald-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">
                {displayTitle}
              </h2>
              {source.source_domain && (
                <p className="text-xs text-gray-400 mt-0.5">{source.source_domain}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-gray-500">
                  {source.citation_count}× cited
                </span>
                <span className="text-[11px] text-gray-500">
                  {source.conversation_count} conversation{source.conversation_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source URL link */}
        {source.source_url && (
          <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <button
              onClick={handleOpenUrl}
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="truncate">{source.source_url}</span>
            </button>
          </div>
        )}

        {/* Conversations list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-5 py-3">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Cited in conversations
            </h3>
          </div>

          {isLoading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-5 pb-4 text-center py-8">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No conversations found</p>
            </div>
          ) : (
            <div className="px-3 pb-4 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={`${conv.conversation_id}-${conv.message_id}`}
                  onClick={() => handleNavigate(conv.conversation_id)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                >
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-gray-800 truncate leading-tight">
                      {conv.conversation_title || 'Untitled Conversation'}
                    </div>
                    {conv.snippet && (
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {conv.snippet}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {conv.topic_name && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {conv.topic_name}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDate(conv.cited_at)}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          'flex items-center justify-end border-t border-gray-200 bg-gray-50 flex-shrink-0',
          isMobile ? 'px-4 py-3' : 'px-5 py-3'
        )}>
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
