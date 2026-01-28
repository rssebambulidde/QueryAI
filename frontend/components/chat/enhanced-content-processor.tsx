'use client';

import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Source } from '@/lib/api';
import { SourceCitation } from './source-citation';
import { InlineCitation, CitationMatch } from './inline-citation';
import { parseCitations, getCitationNumbers } from '@/lib/citation-parser';
import { useCitationPreferencesStore } from '@/lib/store/citation-preferences-store';
import { CitationRenderer } from '@/lib/citation-renderer';

interface EnhancedContentProcessorProps {
  content: string;
  sources?: Source[];
  isUser?: boolean;
  useInlineCitations?: boolean; // Enable inline citation rendering
  showFootnotes?: boolean; // Show footnote-style citations at bottom
}

/**
 * Processes content to add inline source citations after each relevant section
 * and formats the content with proper markdown rendering
 */
export const EnhancedContentProcessor: React.FC<EnhancedContentProcessorProps> = ({
  content,
  sources,
  isUser = false,
  useInlineCitations: propUseInlineCitations,
  showFootnotes: propShowFootnotes,
}) => {
  const [expandedCitation, setExpandedCitation] = useState<Source | null>(null);
  const { preferences } = useCitationPreferencesStore();
  
  // Use preferences if not overridden by props
  const useInlineCitations = propUseInlineCitations ?? (preferences.style === 'inline');
  const showFootnotes = propShowFootnotes ?? preferences.showFootnotes;

  // Parse citations and replace based on style preference
  const { processedContent: contentWithCitationLinks, citations } = useMemo(() => {
    if (!sources || sources.length === 0) {
      return { processedContent: content, citations: [] };
    }
    const { processedContent, citations: parsedCitations } = parseCitations(content, sources);
    
    // Get citation numbers for rendering
    const citationNumbers = getCitationNumbers(parsedCitations);
    
    // Replace citation placeholders based on style
    let processed = processedContent;
    
    if (preferences.style === 'inline' && useInlineCitations) {
      // Inline style: use special markdown links for React component rendering
      parsedCitations.forEach((citation, idx) => {
        const placeholder = `__CITATION_${idx}__`;
        const source = sources[citation.sourceIndex];
        if (source) {
          const citationNumber = citationNumbers.indexOf(citation.number) + 1 || citation.number;
          const citationLink = `[citation:${citationNumber}](${source.url || '#'} "citation:${idx}")`;
          processed = processed.replace(placeholder, citationLink);
        }
      });
    } else {
      // Footnote or Numbered style: render as text
      parsedCitations.forEach((citation, idx) => {
        const placeholder = `__CITATION_${idx}__`;
        const source = sources[citation.sourceIndex];
        if (source) {
          const citationNumber = citationNumbers.indexOf(citation.number) + 1 || citation.number;
          const citationText = CitationRenderer.render(
            citation,
            source,
            citationNumber,
            preferences.style,
            preferences.format
          );
          processed = processed.replace(placeholder, citationText);
        }
      });
    }
    
    return { processedContent: processed, citations: parsedCitations };
  }, [content, sources, useInlineCitations, preferences.style, preferences.format]);

  // Get unique citation numbers for footnotes
  const citationNumbers = useMemo(() => {
    return getCitationNumbers(citations);
  }, [citations]);

  // Process content to add inline citations (fallback mode)
  const processedContent = useMemo(() => {
    if (!sources || sources.length === 0) {
      return contentWithCitationLinks;
    }
    
    // If using inline citations with preferences, return processed content
    if (useInlineCitations && preferences.style === 'inline') {
      return contentWithCitationLinks;
    }
    
    // For other styles or fallback, process citations as text
    let processed = contentWithCitationLinks;
    
    // Pattern to match citations like [Web Source 1], [Document 2], etc.
    const citationPattern = /\[(Web Source|Document)\s+(\d+)\](?:\(([^)]+)\))?/gi;
    
    // Replace citations with React components will be done in render
    // For now, we'll enhance the markdown links
    const webSources = sources.filter(s => s.type === 'web');
    const docSources = sources.filter(s => s.type === 'document');
    
    // Replace [Web Source N] with the actual source website title (not generic "Web Source N")
    webSources.forEach((source, index) => {
      const sourceNumber = index + 1;
      const pattern = new RegExp(`\\[Web Source ${sourceNumber}\\](?:\\([^)]+\\))?`, 'gi');
      const url = source.url || '#';
      const title = source.title || `Web Source ${sourceNumber}`;
      const linkText = (source.title || '').trim() || (() => {
        try {
          return new URL(url).hostname.replace('www.', '');
        } catch {
          return `Web Source ${sourceNumber}`;
        }
      })();
      const displayTitle = linkText.length > 80 ? linkText.slice(0, 77) + '...' : linkText;
      processed = processed.replace(pattern, `[${displayTitle}](${url} "${title}")`);
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
  }, [contentWithCitationLinks, sources, useInlineCitations]);

  const wrapperClass = 'ai-response-content font-sans text-[15px] leading-[1.72] tracking-[0.01em] text-gray-800 antialiased max-w-none';

  // Render markdown with inline citations
  const renderContentWithInlineCitations = () => {
    if (!useInlineCitations || citations.length === 0) {
      // Fallback to old rendering method
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

      // Split content by paragraphs and process each (old method)
      const paragraphs = processedContent.split(/\n\n+/);
      const result: React.ReactNode[] = [];

      paragraphs.forEach((paragraph, index) => {
        const citationMatches = paragraph.match(/\[(Web Source|Document)\s+(\d+)\](?:\([^)]+\))?/gi);
        
        if (citationMatches && citationMatches.length > 0) {
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
    }

    // New inline citation rendering - use custom markdown link component
    const markdownComponents = {
      ...getMarkdownComponents(isUser),
      // Custom link renderer that detects citation links
      a: ({ node, href, title, children, ...props }: any) => {
        // Check if this is a citation link
        if (title && title.startsWith('citation:')) {
          const citationIdx = parseInt(title.replace('citation:', ''), 10);
          const citation = citations[citationIdx];
          if (citation) {
            const source = sources![citation.sourceIndex];
            if (source) {
              const citationNumber = citationNumbers.indexOf(citation.number) + 1 || citation.number;
              // Only show inline citation component if inline style is selected
              if (preferences.style === 'inline') {
                return (
                  <InlineCitation
                    source={source}
                    citationNumber={preferences.showInlineNumbers ? citationNumber : 0}
                    totalCitations={citationNumbers.length}
                    isExpanded={expandedCitation === source}
                    onExpand={(src) => setExpandedCitation(src === expandedCitation ? null : src)}
                  />
                );
              }
              // For other styles, render as regular link
              return (
                <a
                  href={source.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 underline underline-offset-2 font-medium"
                  title={source.title}
                >
                  {children}
                </a>
              );
            }
          }
        }
        // Regular link
        return (
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
        );
      },
    };

    // Render footnotes if needed
    const renderFootnotes = () => {
      if (preferences.style === 'footnote' && citationNumbers.length > 0) {
        if (preferences.format === 'html') {
          return (
            <div
              className="mt-6 pt-4 border-t border-gray-200"
              dangerouslySetInnerHTML={{
                __html: `<h4 class="text-sm font-semibold text-gray-700 mb-3">Footnotes</h4>` +
                  CitationRenderer.renderFootnotes(
                    citations,
                    sources!,
                    citationNumbers,
                    preferences.format
                  ),
              }}
            />
          );
        }
        
        if (preferences.format === 'plain') {
          return (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Footnotes</h4>
              <div className="text-sm text-gray-600 whitespace-pre-line">
                {CitationRenderer.renderFootnotes(
                  citations,
                  sources!,
                  citationNumbers,
                  preferences.format
                )}
              </div>
            </div>
          );
        }
        
        // Markdown format
        return (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Footnotes</h4>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={getMarkdownComponents(isUser)}
            >
              {CitationRenderer.renderFootnotes(
                citations,
                sources!,
                citationNumbers,
                preferences.format
              )}
            </ReactMarkdown>
          </div>
        );
      }
      
      // Show footnotes for inline style if enabled
      if (preferences.style === 'inline' && showFootnotes && citationNumbers.length > 0) {
        return (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Sources</h4>
            <ol className="space-y-2">
              {citationNumbers.map((num) => {
                const citation = citations.find(c => c.number === num);
                if (!citation) return null;
                const source = sources![citation.sourceIndex];
                if (!source) return null;
                return (
                  <li key={num} className="text-sm text-gray-600 flex gap-2">
                    <span className="font-medium text-gray-700 flex-shrink-0">{num}.</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{source.title || `Source ${num}`}</div>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-600 hover:text-orange-700 underline"
                        >
                          {source.url}
                        </a>
                      )}
                      {source.snippet && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{source.snippet}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      }
      
      return null;
    };

    return (
      <div className={wrapperClass}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {processedContent}
        </ReactMarkdown>
        {renderFootnotes()}
      </div>
    );
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
