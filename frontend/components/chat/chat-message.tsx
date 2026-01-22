'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import { Copy, Edit2, Check, X } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { SourceCitation } from './source-citation';
import { FollowUpQuestions } from './follow-up-questions';
import { EnhancedContentProcessor } from './enhanced-content-processor';
import { Source } from '@/lib/api';
import 'highlight.js/styles/github-dark.css';

export interface ChatMessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

// Keep Message as an alias for backward compatibility
export type Message = ChatMessageType;

interface ChatMessageProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  onFollowUpClick?: (question: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onEdit, onFollowUpClick }) => {
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Copied to clipboard');
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
      <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start', 'max-w-[85%]')}>
        {/* Message Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white'
              : 'bg-white border border-gray-200 text-gray-900'
          )}
        >
          {/* Role Label */}
          <div
            className={cn(
              'text-xs font-semibold mb-2 uppercase tracking-wide',
              isUser ? 'text-orange-100' : 'text-gray-500'
            )}
          >
            {isUser ? 'You' : 'Query Assistant'}
          </div>

          {/* Content */}
          <div className={cn(
            'prose prose-sm max-w-none break-words leading-relaxed',
            isUser ? 'prose-invert' : '',
            !isUser && 'prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-code:text-orange-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100'
          )}>
            {isUser && isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <>
                <EnhancedContentProcessor
                  content={message.content}
                  sources={message.sources}
                  isUser={false}
                />
                {/* Show all sources at the end if they exist */}
                {hasSources && message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Sources:</span>
                      {message.sources.map((source, index) => (
                        <SourceCitation
                          key={index}
                          source={source}
                          index={index}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Timestamp and Actions */}
          <div className="flex items-center justify-between mt-2">
            <div
              className={cn(
                'text-xs opacity-70',
                isUser ? 'text-orange-100' : 'text-gray-500'
              )}
            >
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div
              className={cn(
                'flex items-center gap-1 opacity-0 transition-opacity',
                isHovered && 'opacity-100'
              )}
            >
              <button
                onClick={handleCopy}
                className={cn(
                  'p-1.5 rounded hover:bg-opacity-20 transition-colors',
                  isUser ? 'text-orange-100 hover:bg-white' : 'text-gray-400 hover:bg-gray-100'
                )}
                title="Copy message"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {isUser && onEdit && !isEditing && (
                <button
                  onClick={handleEdit}
                  className={cn(
                    'p-1.5 rounded hover:bg-opacity-20 transition-colors',
                    'text-orange-100 hover:bg-white'
                  )}
                  title="Edit message"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Follow-up Questions for Assistant Messages */}
        {!isUser && onFollowUpClick && (
          <FollowUpQuestions
            questions={generateFollowUpQuestions(message.content, message.sources)}
            onQuestionClick={onFollowUpClick}
            className="mt-3"
          />
        )}
      </div>
    </div>
  );
};

// Generate follow-up questions based on the response content (Perplexity.ai style)
const generateFollowUpQuestions = (content: string, sources?: Source[]): string[] => {
  const questions: string[] = [];
  
  // Extract key entities, topics, and concepts from the content
  const extractKeyTerms = (text: string): string[] => {
    const terms = new Set<string>();
    
    // Extract capitalized phrases (likely entities/topics)
    const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalizedPhrases) {
      capitalizedPhrases.forEach(phrase => {
        if (phrase.length > 3 && phrase.length < 40 && !isCommonWord(phrase)) {
          terms.add(phrase);
        }
      });
    }
    
    // Extract quoted terms
    const quotedTerms = text.match(/"([^"]+)"/g);
    if (quotedTerms) {
      quotedTerms.forEach(term => {
        const clean = term.replace(/"/g, '').trim();
        if (clean.length > 3 && clean.length < 50) {
          terms.add(clean);
        }
      });
    }
    
    // Extract terms after "such as", "including", "like"
    const listPatterns = [
      /(?:such as|including|like|for example|e\.g\.)\s+([^.,!?;]+)/gi,
      /(?:about|regarding|concerning|related to)\s+([^.,!?;]+)/gi,
    ];
    
    listPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const items = match[1].split(/,|and|or/).map(i => i.trim());
        items.forEach(item => {
          if (item.length > 3 && item.length < 40) {
            terms.add(item);
          }
        });
      }
    });
    
    return Array.from(terms).slice(0, 10);
  };
  
  const isCommonWord = (word: string): boolean => {
    const common = ['The', 'This', 'That', 'These', 'Those', 'There', 'Here', 'What', 'Which', 'How', 'When', 'Where', 'Why', 'Who'];
    return common.includes(word);
  };
  
  const keyTerms = extractKeyTerms(content);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  // Extract main topics from first few sentences
  const mainTopics: string[] = [];
  sentences.slice(0, 3).forEach(sentence => {
    const words = sentence.split(/\s+/).filter(w => w.length > 4);
    if (words.length > 0) {
      // Find noun phrases or important terms
      const importantWords = words.filter(w => 
        !['the', 'this', 'that', 'these', 'those', 'there', 'here', 'what', 'which', 'how', 'when', 'where', 'why', 'who', 'can', 'will', 'should', 'could', 'would', 'may', 'might'].includes(w.toLowerCase())
      );
      if (importantWords.length > 0) {
        mainTopics.push(importantWords.slice(0, 3).join(' '));
      }
    }
  });
  
  // Generate context-aware questions based on content analysis
  const contentLower = content.toLowerCase();
  
  // Question 1: Deep dive into main topic
  if (keyTerms.length > 0) {
    const mainTerm = keyTerms[0];
    if (contentLower.includes('explain') || contentLower.includes('describe')) {
      questions.push(`Tell me more about ${mainTerm}`);
    } else if (contentLower.includes('how') || contentLower.includes('process') || contentLower.includes('work')) {
      questions.push(`How does ${mainTerm} work?`);
    } else if (contentLower.includes('what') || contentLower.includes('is') || contentLower.includes('are')) {
      questions.push(`What is ${mainTerm}?`);
    } else {
      questions.push(`Tell me more about ${mainTerm}`);
    }
  } else if (mainTopics.length > 0) {
    questions.push(`Tell me more about ${mainTopics[0]}`);
  }
  
  // Question 2: Related aspects or implications
  if (contentLower.includes('benefit') || contentLower.includes('advantage') || contentLower.includes('pros')) {
    questions.push('What are the disadvantages or challenges?');
  } else if (contentLower.includes('disadvantage') || contentLower.includes('challenge') || contentLower.includes('problem')) {
    questions.push('What are the benefits or solutions?');
  } else if (contentLower.includes('current') || contentLower.includes('now') || contentLower.includes('recent')) {
    questions.push('What is the historical context?');
  } else if (contentLower.includes('history') || contentLower.includes('past') || contentLower.includes('previous')) {
    questions.push('What is the current status?');
  } else if (keyTerms.length > 1) {
    questions.push(`How does ${keyTerms[0]} relate to ${keyTerms[1]}?`);
  } else if (mainTopics.length > 1) {
    questions.push(`What about ${mainTopics[1]}?`);
  }
  
  // Question 3: Source-specific or detailed follow-up
  if (sources && sources.length > 0) {
    const webSources = sources.filter(s => s.type === 'web');
    const docSources = sources.filter(s => s.type === 'document');
    
    if (webSources.length > 0 && keyTerms.length > 0) {
      questions.push(`What are the latest developments regarding ${keyTerms[0]}?`);
    } else if (docSources.length > 0) {
      questions.push('Can you provide more details from the documents?');
    } else {
      questions.push('Can you provide more specific examples?');
    }
  } else if (contentLower.includes('example') || contentLower.includes('instance') || contentLower.includes('case')) {
    questions.push('Are there other examples or use cases?');
  } else {
    questions.push('Can you provide more specific examples?');
  }
  
  // Question 4: Next steps or related topics
  if (contentLower.includes('step') || contentLower.includes('process') || contentLower.includes('procedure')) {
    questions.push('What are the best practices or tips?');
  } else if (contentLower.includes('compare') || contentLower.includes('difference') || contentLower.includes('versus')) {
    questions.push('What are the similarities?');
  } else if (keyTerms.length > 0) {
    questions.push(`What should I know about ${keyTerms[0]}?`);
  } else {
    questions.push('What are the key takeaways?');
  }
  
  // Ensure we have exactly 4 questions, remove duplicates, and limit length
  const uniqueQuestions = Array.from(new Set(questions))
    .filter(q => q.length > 10 && q.length < 100)
    .slice(0, 4);
  
  // Fill remaining slots with generic but relevant questions
  while (uniqueQuestions.length < 4) {
    if (keyTerms.length > 0) {
      uniqueQuestions.push(`Tell me more about ${keyTerms[uniqueQuestions.length % keyTerms.length]}`);
    } else {
      uniqueQuestions.push('Can you elaborate on this?');
    }
  }
  
  return uniqueQuestions.slice(0, 4);
};
