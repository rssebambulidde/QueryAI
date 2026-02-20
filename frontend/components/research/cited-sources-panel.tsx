'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Globe, FileText, ExternalLink, MessageSquare, TrendingUp, Search, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyticsApi, CitedSource, TopicCitedSource, type Topic } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface CitedSourcesPanelProps {
  selectedTopic?: Topic | null;
  onSourceExplore: (source: CitedSource) => void;
  className?: string;
}

export const CitedSourcesPanel: React.FC<CitedSourcesPanelProps> = ({
  selectedTopic,
  onSourceExplore,
  className,
}) => {
  const [sources, setSources] = useState<CitedSource[]>([]);
  const [topicSources, setTopicSources] = useState<TopicCitedSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { toast } = useToast();

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await analyticsApi.getCitedSources({ limit: 50 });
      if (res.success && res.data) {
        setSources(res.data.sources || []);
      }
    } catch (err: any) {
      toast.error('Failed to load cited sources');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadTopicSources = useCallback(async (topicId: string) => {
    try {
      const res = await analyticsApi.getTopicCitedSources(topicId);
      if (res.success && res.data) {
        setTopicSources(res.data.sources);
      }
    } catch {
      setTopicSources([]);
    }
  }, []);

  useEffect(() => {
    loadSources();
    // Listen for global sourcesUpdated event to reload sources
    const handler = () => loadSources();
    window.addEventListener('sourcesUpdated', handler);
    return () => {
      window.removeEventListener('sourcesUpdated', handler);
    };
  }, [loadSources]);

  useEffect(() => {
    if (selectedTopic?.id) {
      loadTopicSources(selectedTopic.id);
    } else {
      setTopicSources([]);
    }
  }, [selectedTopic?.id, loadTopicSources]);

  const filteredSources = searchQuery
    ? sources.filter(
        (s) =>
          s.source_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.source_domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.source_url?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sources;

  return (
    <div className={cn('py-2', className)}>
      {/* Section header with search toggle */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          My Sources
        </span>
        <button
          onClick={() => {
            setIsSearchOpen(!isSearchOpen);
            if (isSearchOpen) setSearchQuery('');
          }}
          className={cn(
            'p-1 rounded-md transition-colors',
            isSearchOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          )}
          title="Search sources"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search input */}
      {isSearchOpen && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }
              }}
              className="pl-8 pr-8 h-8 text-xs bg-gray-50 border-gray-200 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Topic-specific section */}
      {selectedTopic && topicSources.length > 0 && !searchQuery && (
        <div className="px-3 pb-2">
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-[11px] font-semibold text-orange-700">
                Top in: {selectedTopic.name}
              </span>
            </div>
            <div className="space-y-1">
              {topicSources.slice(0, 5).map((ts) => (
                <button
                  key={ts.id}
                  onClick={() =>
                    onSourceExplore({
                      ...ts,
                      first_cited_at: '',
                      last_cited_at: '',
                      citation_count: ts.total_citation_count,
                      conversation_count: 0,
                    })
                  }
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-orange-100/60 transition-colors text-left group"
                >
                  {ts.source_type === 'web' ? (
                    <Globe className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-gray-800 truncate">
                      {ts.source_title || ts.source_domain || 'Untitled'}
                    </div>
                  </div>
                  <span className="text-[10px] text-orange-600 font-medium flex-shrink-0">
                    {ts.topic_citation_count}×
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full sources list */}
      <div className="px-2">
        {isLoading ? (
          <div className="px-3 py-6 text-center">
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-gray-400">
              {searchQuery
                ? `No sources matching "${searchQuery}"`
                : 'No cited sources yet. Start asking questions to build your source library.'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredSources.map((source) => (
              <SourceItem
                key={source.id}
                source={source}
                onExplore={() => onSourceExplore(source)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Source list item ──────────────────────────────────────────────────

interface SourceItemProps {
  source: CitedSource;
  onExplore: () => void;
}

const SourceItem: React.FC<SourceItemProps> = ({ source, onExplore }) => {
  const displayTitle = source.source_title || source.source_domain || source.source_url || 'Untitled';
  const isWeb = source.source_type === 'web';

  return (
    <button
      onClick={onExplore}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left group"
    >
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
        isWeb ? 'bg-blue-50' : 'bg-emerald-50'
      )}>
        {isWeb ? (
          <Globe className="w-3.5 h-3.5 text-blue-500" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-gray-800 truncate leading-tight">
          {displayTitle}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {source.source_domain && (
            <span className="text-[11px] text-gray-400 truncate">
              {source.source_domain}
            </span>
          )}
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
            <MessageSquare className="w-2.5 h-2.5" />
            {source.conversation_count}
          </span>
          <span className="text-[10px] text-gray-400 flex-shrink-0">
            {source.citation_count}× cited
          </span>
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
    </button>
  );
};
