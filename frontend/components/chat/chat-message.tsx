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
import { AIActionButtons } from './ai-action-buttons';
import { Source, aiApi } from '@/lib/api';
import 'highlight.js/styles/github-dark.css';

export interface ChatMessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  followUpQuestions?: string[]; // AI-generated follow-up questions
}

// Keep Message as an alias for backward compatibility
export type Message = ChatMessageType;

interface ChatMessageProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  onFollowUpClick?: (question: string) => void;
  userQuestion?: string; // The user's original question for context
  onActionResponse?: (content: string) => void; // Callback for action responses
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onEdit, onFollowUpClick, userQuestion, onActionResponse }) => {
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
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
                  content={message.content.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim()}
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

        {/* Follow-up Questions for Assistant Messages - Only show AI-generated questions */}
        {!isUser && onFollowUpClick && message.followUpQuestions && message.followUpQuestions.length > 0 && (
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

// Generate follow-up questions based on the response content (Perplexity.ai style)
const generateFollowUpQuestions = (content: string, sources?: Source[], userQuestion?: string): string[] => {
  const questions: string[] = [];
  
  // Section headings to ignore (common in AI responses)
  const sectionHeadings = new Set([
    'summary', 'key points', 'sources', 'conclusion', 'introduction', 
    'overview', 'details', 'examples', 'benefits', 'advantages', 
    'disadvantages', 'features', 'specifications', 'requirements',
    'description', 'definition', 'explanation', 'background', 'context'
  ]);
  
  // Extract key entities, topics, and concepts from the content
  const extractKeyTerms = (text: string, excludeHeadings: boolean = true): string[] => {
    const terms = new Set<string>();
    
    // First, try to extract from user's question if available
    if (userQuestion) {
      const userLower = userQuestion.toLowerCase();
      // Extract main topic from user question (usually the first significant word/phrase)
      const userWords = userQuestion.split(/\s+/).filter(w => w.length > 2);
      if (userWords.length > 0) {
        // Take first 1-3 words as potential topic
        const potentialTopic = userWords.slice(0, 3).join(' ').trim();
        if (potentialTopic.length > 2 && potentialTopic.length < 50) {
          terms.add(potentialTopic);
        }
      }
    }
    
    // Extract from first sentence (usually contains the main topic)
    const firstSentence = text.split(/[.!?]+/)[0]?.trim();
    if (firstSentence) {
      // Extract capitalized phrases from first sentence (likely the main topic)
      const firstSentenceCaps = firstSentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
      if (firstSentenceCaps) {
        firstSentenceCaps.forEach(phrase => {
          const phraseLower = phrase.toLowerCase();
          if (phrase.length > 2 && phrase.length < 40 && 
              !isCommonWord(phrase) && 
              (!excludeHeadings || !sectionHeadings.has(phraseLower))) {
            terms.add(phrase);
          }
        });
      }
    }
    
    // Extract capitalized phrases (likely entities/topics) - but skip section headings
    const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalizedPhrases) {
      capitalizedPhrases.forEach(phrase => {
        const phraseLower = phrase.toLowerCase();
        if (phrase.length > 2 && phrase.length < 40 && 
            !isCommonWord(phrase) && 
            (!excludeHeadings || !sectionHeadings.has(phraseLower))) {
          terms.add(phrase);
        }
      });
    }
    
    // Extract quoted terms
    const quotedTerms = text.match(/"([^"]+)"/g);
    if (quotedTerms) {
      quotedTerms.forEach(term => {
        const clean = term.replace(/"/g, '').trim();
        const cleanLower = clean.toLowerCase();
        if (clean.length > 2 && clean.length < 50 && 
            (!excludeHeadings || !sectionHeadings.has(cleanLower))) {
          terms.add(clean);
        }
      });
    }
    
    // Extract terms after "such as", "including", "like" - but only if not section headings
    const listPatterns = [
      /(?:such as|including|like|for example|e\.g\.)\s+([^.,!?;]+)/gi,
      /(?:about|regarding|concerning|related to)\s+([^.,!?;]+)/gi,
    ];
    
    listPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const items = match[1].split(/,|and|or/).map(i => i.trim());
        items.forEach(item => {
          const itemLower = item.toLowerCase();
          if (item.length > 2 && item.length < 40 && 
              (!excludeHeadings || !sectionHeadings.has(itemLower))) {
            terms.add(item);
          }
        });
      }
    });
    
    return Array.from(terms).slice(0, 10);
  };
  
  const isCommonWord = (word: string): boolean => {
    const common = ['The', 'This', 'That', 'These', 'Those', 'There', 'Here', 'What', 'Which', 'How', 'When', 'Where', 'Why', 'Who', 'Summary', 'Key', 'Points', 'Sources'];
    return common.includes(word);
  };
  
  const keyTerms = extractKeyTerms(content, true);
  const contentLower = content.toLowerCase();
  
  // Get the main topic - prioritize user question, then first key term
  let mainTopic = '';
  if (userQuestion) {
    // Extract main topic from user question
    const userWords = userQuestion.trim().split(/\s+/);
    // Remove question words and common words
    const topicWords = userWords.filter(w => {
      const wLower = w.toLowerCase();
      return !['what', 'is', 'are', 'how', 'does', 'do', 'can', 'will', 'should', 'could', 'would', 'tell', 'me', 'about', 'explain', 'describe'].includes(wLower) && w.length > 2;
    });
    if (topicWords.length > 0) {
      mainTopic = topicWords.slice(0, 3).join(' ');
    }
  }
  
  // Fallback to first key term if no topic from user question
  if (!mainTopic && keyTerms.length > 0) {
    mainTopic = keyTerms[0];
  }
  
  // If still no topic, try to extract from first sentence
  if (!mainTopic) {
    const firstSentence = content.split(/[.!?]+/)[0]?.trim();
    if (firstSentence) {
      // Look for the subject (usually after "is", "are", "refers to", etc.)
      const subjectMatch = firstSentence.match(/(?:is|are|refers to|means|stands for)\s+([^.,!?]+)/i);
      if (subjectMatch) {
        mainTopic = subjectMatch[1].trim().split(/\s+/).slice(0, 3).join(' ');
      } else {
        // Take first significant capitalized phrase
        const caps = firstSentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/);
        if (caps && !sectionHeadings.has(caps[0].toLowerCase())) {
          mainTopic = caps[0];
        }
      }
    }
  }
  
  // Generate context-aware questions based on content analysis
  const userQuestionLower = userQuestion?.toLowerCase() || '';
  
  // Question 1: Deep dive into main topic
  if (mainTopic) {
    if (userQuestionLower.includes('what') || userQuestionLower.includes('is') || userQuestionLower.includes('are')) {
      questions.push(`How does ${mainTopic} work?`);
    } else if (userQuestionLower.includes('how')) {
      questions.push(`What is ${mainTopic}?`);
    } else if (userQuestionLower.includes('explain') || userQuestionLower.includes('tell me')) {
      questions.push(`What are the key features of ${mainTopic}?`);
    } else {
      questions.push(`Tell me more about ${mainTopic}`);
    }
  } else {
    questions.push('Can you explain this in more detail?');
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
  } else if (mainTopic && keyTerms.length > 1) {
    questions.push(`How does ${mainTopic} relate to ${keyTerms[1]}?`);
  } else if (mainTopic) {
    questions.push(`What are the use cases for ${mainTopic}?`);
  } else {
    questions.push('What are the related topics?');
  }
  
  // Question 3: Source-specific or detailed follow-up
  if (sources && sources.length > 0) {
    const webSources = sources.filter(s => s.type === 'web');
    const docSources = sources.filter(s => s.type === 'document');
    
    if (webSources.length > 0 && mainTopic) {
      questions.push(`What are the latest developments regarding ${mainTopic}?`);
    } else if (docSources.length > 0 && mainTopic) {
      questions.push(`Can you provide more details about ${mainTopic} from the documents?`);
    } else if (mainTopic) {
      questions.push(`Can you provide more specific examples of ${mainTopic}?`);
    } else {
      questions.push('Can you provide more specific examples?');
    }
  } else if (contentLower.includes('example') || contentLower.includes('instance') || contentLower.includes('case')) {
    if (mainTopic) {
      questions.push(`Are there other examples of ${mainTopic}?`);
    } else {
      questions.push('Are there other examples or use cases?');
    }
  } else if (mainTopic) {
    questions.push(`Can you provide examples of ${mainTopic}?`);
  } else {
    questions.push('Can you provide more specific examples?');
  }
  
  // Question 4: Next steps or related topics
  if (contentLower.includes('step') || contentLower.includes('process') || contentLower.includes('procedure')) {
    if (mainTopic) {
      questions.push(`What are the best practices for ${mainTopic}?`);
    } else {
      questions.push('What are the best practices or tips?');
    }
  } else if (contentLower.includes('compare') || contentLower.includes('difference') || contentLower.includes('versus')) {
    questions.push('What are the similarities?');
  } else if (mainTopic) {
    questions.push(`What should I know about ${mainTopic}?`);
  } else {
    questions.push('What are the key takeaways?');
  }
  
  // Ensure we have exactly 4 questions, remove duplicates, and limit length
  const uniqueQuestions = Array.from(new Set(questions))
    .filter(q => q.length > 10 && q.length < 100)
    .slice(0, 4);
  
  // Fill remaining slots with generic but relevant questions
  while (uniqueQuestions.length < 4) {
    if (mainTopic) {
      uniqueQuestions.push(`Tell me more about ${mainTopic}`);
    } else if (keyTerms.length > 0) {
      uniqueQuestions.push(`Tell me more about ${keyTerms[uniqueQuestions.length % keyTerms.length]}`);
    } else {
      uniqueQuestions.push('Can you elaborate on this?');
    }
  }
  
  return uniqueQuestions.slice(0, 4);
};
