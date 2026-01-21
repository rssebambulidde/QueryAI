'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import 'highlight.js/styles/github-dark.css';

export interface Source {
  type?: 'document' | 'web';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;

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
    >
      <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start', 'max-w-[85%]')}>
        {/* Message Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
              : 'bg-white border border-gray-200 text-gray-900'
          )}
        >
          {/* Role Label */}
          <div
            className={cn(
              'text-xs font-semibold mb-2 uppercase tracking-wide',
              isUser ? 'text-blue-100' : 'text-gray-500'
            )}
          >
            {isUser ? 'You' : 'AI Assistant'}
          </div>

          {/* Content */}
          <div className={cn(
            'prose prose-sm max-w-none break-words leading-relaxed',
            isUser ? 'prose-invert' : '',
            !isUser && 'prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-code:text-blue-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100'
          )}>
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  // Customize heading styles
                  h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-base font-bold mt-3 mb-2 first:mt-0" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-sm font-bold mt-2 mb-1 first:mt-0" {...props} />,
                  // Customize list styles
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
                  li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                  // Customize paragraph
                  p: ({ node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
                  // Customize code blocks
                  code: ({ node, inline, className, children, ...props }: any) => {
                    if (inline) {
                      return (
                        <code className="bg-gray-100 text-blue-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className={cn("block p-3 rounded-lg overflow-x-auto text-sm font-mono my-2", className)} {...props}>
                        {children}
                      </code>
                    );
                  },
                  // Customize blockquotes
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic text-gray-600" {...props} />
                  ),
                  // Customize links - special styling for source links
                  a: ({ node, href, title, children, ...props }: any) => {
                    const isSourceLink = href && message.sources?.some((s, idx) => s.url === href);
                    return (
                      <a 
                        className={cn(
                          "underline hover:opacity-80 transition-opacity",
                          isSourceLink 
                            ? "text-blue-600 font-medium hover:text-blue-800" 
                            : "text-blue-600 hover:text-blue-800"
                        )}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={title}
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                  // Customize strong/bold
                  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                  // Customize emphasis/italic
                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                  // Customize horizontal rule
                  hr: ({ node, ...props }) => <hr className="my-4 border-gray-300" {...props} />,
                }}
              >
                {processedContent}
              </ReactMarkdown>
            )}
          </div>

          {/* Timestamp */}
          <div
            className={cn(
              'text-xs mt-2 opacity-70',
              isUser ? 'text-blue-100' : 'text-gray-500'
            )}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
