'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Topic } from '@/lib/api';

interface KeywordTopicSuggestionsProps {
  keyword?: string;
  showKeywordSuggestion: boolean;
  matchingTopics: Topic[];
  selectedTopic: Topic | null;
  onSaveKeywordAsTopic: () => void;
  onTopicSelect: (topic: Topic) => void;
}

export const KeywordTopicSuggestions: React.FC<KeywordTopicSuggestionsProps> = ({
  keyword,
  showKeywordSuggestion,
  matchingTopics,
  selectedTopic,
  onSaveKeywordAsTopic,
  onTopicSelect,
}) => (
  <>
    {showKeywordSuggestion && (
      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-900">Save as Topic?</p>
            <p className="text-xs text-amber-700 mt-1">
              Create a topic &quot;{keyword}&quot; to organize conversations and filter documents.
            </p>
            <button
              onClick={onSaveKeywordAsTopic}
              className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium underline"
            >
              Create topic &rarr;
            </button>
          </div>
        </div>
      </div>
    )}

    {matchingTopics.length > 0 && !selectedTopic && (
      <div className="mt-2 space-y-1">
        <p className="text-xs text-gray-600">Did you mean:</p>
        {matchingTopics.slice(0, 3).map((topic) => (
          <button
            key={topic.id}
            onClick={() => onTopicSelect(topic)}
            className="w-full text-left px-2 py-1.5 text-xs bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors"
          >
            <div className="font-medium text-orange-900">{topic.name}</div>
            {topic.description && (
              <div className="text-orange-700 mt-0.5">{topic.description}</div>
            )}
          </button>
        ))}
      </div>
    )}
  </>
);
