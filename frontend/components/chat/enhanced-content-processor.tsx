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
import { getMarkdownComponents } from '@/lib/utils/markdown-components';
import { FootnoteRenderer } from './footnote-renderer';

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

  const wrapperClass = 'ai-response-content font-sans text-[15px] leading-[1.72] tracking-[0.01em] text-gray-800 antialiased max-w-none break-words overflow-wrap-anywhere';

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
        // Check if this is a citation link (from parseCitations)
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
        
        // Detect citation patterns in link text (e.g., "Web Source 4", "Document 2")
        // This handles citations that were converted to markdown links by processContentWithSources
        if (sources && sources.length > 0) {
          const linkText = typeof children === 'string' ? children : 
                          (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string' ? children[0] : '');
          
          if (linkText) {
            // First, try to match explicit citation patterns like "Web Source 4" or "Document 2"
            const citationMatch = linkText.match(/^(Web Source|Document)\s+(\d+)$/i);
            if (citationMatch) {
              const [, type, number] = citationMatch;
              const sourceIndex = parseInt(number) - 1;
              
              // Find the matching source
              let source: Source | undefined;
              if (type.toLowerCase() === 'web source') {
                const webSources = sources.filter(s => s.type === 'web');
                source = webSources[sourceIndex];
              } else if (type.toLowerCase() === 'document') {
                const docSources = sources.filter(s => s.type === 'document');
                source = docSources[sourceIndex];
              }
              
              if (source) {
                // Always render as InlineCitation component with hover tooltip
                return (
                  <InlineCitation
                    source={source}
                    citationNumber={parseInt(number)}
                    totalCitations={sources.length}
                    isExpanded={expandedCitation === source}
                    onExpand={(src) => setExpandedCitation(src === expandedCitation ? null : src)}
                  />
                );
              }
            }
            
            // Second, try to match by URL (for links that were converted to source titles)
            // This handles cases where processContentWithSources replaced "Web Source 4" with the actual source title
            // Only match if URL exactly matches a source URL to avoid false positives
            if (href && href !== '#') {
              const matchingSource = sources.find(s => s.url && s.url === href);
              
              if (matchingSource) {
                // Find the citation number for this source
                // For web sources, count only web sources; for documents, count only documents
                const sameTypeSources = sources.filter(s => s.type === matchingSource.type);
                const sourceIndex = sameTypeSources.indexOf(matchingSource);
                const citationNumber = sourceIndex + 1;
                
                // Always render as InlineCitation component with hover tooltip
                return (
                  <InlineCitation
                    source={matchingSource}
                    citationNumber={citationNumber}
                    totalCitations={sameTypeSources.length}
                    isExpanded={expandedCitation === matchingSource}
                    onExpand={(src) => setExpandedCitation(src === expandedCitation ? null : src)}
                  />
                );
              }
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

    return (
      <div className={wrapperClass}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {processedContent}
        </ReactMarkdown>
        <FootnoteRenderer
          citations={citations}
          sources={sources!}
          citationNumbers={citationNumbers}
          style={preferences.style}
          format={preferences.format}
          showFootnotes={showFootnotes}
          isUser={isUser}
        />
      </div>
    );
  };

  return renderContentWithInlineCitations();
};

