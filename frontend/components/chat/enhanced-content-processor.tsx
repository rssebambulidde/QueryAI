'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Source } from '@/lib/api';
import { SourceCitation } from './source-citation';

interface EnhancedContentProcessorProps {
  content: string;
  sources?: Source[];
  isUser?: boolean;
}

/**
 * Processes content to add inline source citations after each relevant section
 * and formats the content with proper markdown rendering
 */
export const EnhancedContentProcessor: React.FC<EnhancedContentProcessorProps> = ({
  content,
  sources,
  isUser = false,
}) => {
  // Process content to add inline citations
  const processedContent = useMemo(() => {
    if (!sources || sources.length === 0) return content;
    
    let processed = content;
    
    // Pattern to match citations like [Web Source 1], [Document 2], etc.
    const citationPattern = /\[(Web Source|Document)\s+(\d+)\](?:\(([^)]+)\))?/gi;
    
    // Replace citations with React components will be done in render
    // For now, we'll enhance the markdown links
    const webSources = sources.filter(s => s.type === 'web');
    const docSources = sources.filter(s => s.type === 'document');
    
    // Replace [Web Source N] with better formatted links
    webSources.forEach((source, index) => {
      const sourceNumber = index + 1;
      const pattern = new RegExp(`\\[Web Source ${sourceNumber}\\](?:\\([^)]+\\))?`, 'gi');
      const url = source.url || '#';
      const title = source.title || `Web Source ${sourceNumber}`;
      try {
        const urlObj = new URL(url);
        const displayName = urlObj.hostname.replace('www.', '');
        processed = processed.replace(pattern, `[${displayName}](${url} "${title}")`);
      } catch {
        processed = processed.replace(pattern, `[${title}](${url} "${title}")`);
      }
    });
    
    // Replace [Document N] with better formatted links
    docSources.forEach((source, index) => {
      const sourceNumber = index + 1;
      const pattern = new RegExp(`\\[Document ${sourceNumber}\\]`, 'gi');
      const title = source.title || `Document ${sourceNumber}`;
      if (source.url) {
        processed = processed.replace(pattern, `[${title}](${source.url} "${title}")`);
      } else {
        processed = processed.replace(pattern, `**${title}**`);
      }
    });
    
    return processed;
  }, [content, sources]);

  const wrapperClass = 'ai-response-content font-sans text-[15px] leading-[1.72] tracking-[0.01em] text-gray-800 antialiased max-w-none';

  const renderContentWithInlineCitations = () => {
    if (!sources || sources.length === 0) {
      return (
        <div className={wrapperClass}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={getMarkdownComponents(isUser)}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      );
    }

    // Split content by paragraphs and process each
    const paragraphs = processedContent.split(/\n\n+/);
    const result: React.ReactNode[] = [];

    paragraphs.forEach((paragraph, index) => {
      // Check if this paragraph contains citations
      const citationMatches = paragraph.match(/\[(Web Source|Document)\s+(\d+)\](?:\([^)]+\))?/gi);
      
      if (citationMatches && citationMatches.length > 0) {
        // Extract source indices from citations
        const sourceIndices = new Set<number>();
        citationMatches.forEach((match) => {
          const numMatch = match.match(/(\d+)/);
          if (numMatch) {
            const sourceIndex = parseInt(numMatch[1]) - 1;
            if (sourceIndex >= 0 && sourceIndex < sources.length && sources[sourceIndex]) {
              sourceIndices.add(sourceIndex);
            }
          }
        });

        // Render paragraph with markdown
        result.push(
          <ReactMarkdown
            key={`para-${index}`}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={getMarkdownComponents(isUser)}
          >
            {paragraph}
          </ReactMarkdown>
        );

        // Add inline citations after the paragraph
        if (sourceIndices.size > 0) {
          result.push(
            <div key={`citations-${index}`} className="flex flex-wrap items-center gap-2 mt-2 mb-3">
              {Array.from(sourceIndices).map((sourceIdx) => (
                <SourceCitation
                  key={sourceIdx}
                  source={sources[sourceIdx]}
                  index={sourceIdx}
                />
              ))}
            </div>
          );
        }
      } else {
        // Regular paragraph without citations
        result.push(
          <ReactMarkdown
            key={`para-${index}`}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={getMarkdownComponents(isUser)}
          >
            {paragraph}
          </ReactMarkdown>
        );
      }
    });

    return <div className={wrapperClass}>{result}</div>;
  };

  return renderContentWithInlineCitations();
};

// Markdown components: neat, well-aligned AI response typography
const getMarkdownComponents = (isUser: boolean) => ({
  h1: ({ node, ...props }: any) => (
    <h1 className="text-xl font-bold mt-5 mb-2.5 first:mt-0 text-gray-900 text-left" {...props} />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0 text-gray-900 text-left" {...props} />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 className="text-base font-semibold mt-3 mb-1.5 first:mt-0 text-gray-900 text-left" {...props} />
  ),
  h4: ({ node, ...props }: any) => (
    <h4 className="text-[15px] font-semibold mt-2.5 mb-1 first:mt-0 text-gray-900 text-left" {...props} />
  ),
  ul: ({ node, ...props }: any) => (
    <ul className="list-disc list-outside ml-4 my-3 space-y-1.5 text-left" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="list-decimal list-outside ml-4 my-3 space-y-1.5 text-left" {...props} />
  ),
  li: ({ node, ...props }: any) => (
    <li className="pl-1 [&>p]:my-0.5" {...props} />
  ),
  p: ({ node, ...props }: any) => (
    <p className="my-3 first:mt-0 last:mb-0 text-left text-justify" {...props} />
  ),
  code: ({ node, inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="bg-gray-100 text-orange-600 px-1.5 py-0.5 rounded text-sm font-mono align-baseline" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={`block p-3 rounded-lg overflow-x-auto text-sm font-mono my-3 bg-gray-900 text-gray-100 ${className || ''}`} {...props}>
        {children}
      </code>
    );
  },
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-600 text-left" {...props} />
  ),
  a: ({ node, href, title, children, ...props }: any) => (
    <a
      className="text-orange-600 hover:text-orange-700 underline underline-offset-2 font-medium"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ node, ...props }: any) => <strong className="font-semibold text-gray-900" {...props} />,
  em: ({ node, ...props }: any) => <em className="italic" {...props} />,
  hr: ({ node, ...props }: any) => <hr className="my-4 border-gray-200" {...props} />,
});
