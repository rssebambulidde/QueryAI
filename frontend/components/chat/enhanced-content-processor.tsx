'use client';

import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Source } from '@/lib/api';
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
  /** Message ID used for citation click-through analytics. */
  messageId?: string;
  /** Fired when a user opens a citation source (download / external link). */
  onCitationClick?: (sourceIndex: number, sourceUrl: string | undefined, sourceType: 'document' | 'web') => void;
  /** Called when user flags a citation as not supporting the claim. */
  onFlagCitation?: (sourceUrl: string, sourceTitle: string) => void;
  /** Set of source URLs that have been flagged by the user. */
  flaggedCitationUrls?: Set<string>;
}

/**
 * Single-pass content processor.
 *
 * 1.  parseCitations() resolves every [Web Source N] / [Document N] reference
 *     using type-specific indexing and strips trailing "Sources:" lines.
 * 2.  Placeholders are replaced according to the user's style preference:
 *     - inline  → special markdown links caught by a custom <a> handler
 *     - other   → CitationRenderer text (e.g. "[1]", "¹")
 * 3.  ReactMarkdown renders the result in a single pass.
 */
export const EnhancedContentProcessor: React.FC<EnhancedContentProcessorProps> = ({
  content,
  sources,
  isUser = false,
  useInlineCitations: propUseInlineCitations,
  showFootnotes: propShowFootnotes,
  messageId,
  onCitationClick,
  onFlagCitation,
  flaggedCitationUrls,
}) => {
  const [expandedCitation, setExpandedCitation] = useState<Source | null>(null);
  const { preferences } = useCitationPreferencesStore();
  
  // Use preferences if not overridden by props
  const useInlineCitations = propUseInlineCitations ?? (preferences.style === 'inline');
  const showFootnotes = propShowFootnotes ?? preferences.showFootnotes;

  // ── Single-pass citation processing ──────────────────────────────────
  const { processedContent, citations } = useMemo(() => {
    if (!sources || sources.length === 0) {
      return { processedContent: content, citations: [] as CitationMatch[] };
    }

    const { processedContent: withPlaceholders, citations: parsed } = parseCitations(content, sources);
    const nums = getCitationNumbers(parsed);

    let processed = withPlaceholders;

    if (preferences.style === 'inline' && useInlineCitations) {
      // Inline style: produce special markdown links for the custom <a> handler
      parsed.forEach((citation, idx) => {
        const placeholder = `__CITATION_${idx}__`;
        const source = sources[citation.sourceIndex];
        if (source) {
          const citationNumber = nums.indexOf(citation.number) + 1 || citation.number;
          processed = processed.replace(
            placeholder,
            `[citation:${citationNumber}](${source.url || '#'} "citation:${idx}")`
          );
        }
      });
    } else {
      // Footnote / Numbered style: render as plain text
      parsed.forEach((citation, idx) => {
        const placeholder = `__CITATION_${idx}__`;
        const source = sources[citation.sourceIndex];
        if (source) {
          const citationNumber = nums.indexOf(citation.number) + 1 || citation.number;
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

    return { processedContent: processed, citations: parsed };
  }, [content, sources, useInlineCitations, preferences.style, preferences.format]);

  // Unique citation numbers for footnotes
  const citationNumbers = useMemo(() => getCitationNumbers(citations), [citations]);

  const wrapperClass = 'ai-response-content font-sans text-base leading-[1.72] tracking-[0.01em] text-gray-800 antialiased max-w-none break-words overflow-wrap-anywhere';

  // ── Markdown components (with citation-aware <a> handler) ────────────
  const markdownComponents = useMemo(() => ({
    ...getMarkdownComponents(isUser),
    a: ({ node, href, title, children, ...props }: any) => {
      // Detect citation links injected by the inline-style branch above
      if (title && title.startsWith('citation:') && sources && sources.length > 0) {
        const citationIdx = parseInt(title.replace('citation:', ''), 10);
        const citation = citations[citationIdx];
        if (citation) {
          const source = sources[citation.sourceIndex];
          if (source) {
            const citationNumber = citationNumbers.indexOf(citation.number) + 1 || citation.number;
            if (preferences.style === 'inline') {
              return (
                <InlineCitation
                  source={source}
                  citationNumber={preferences.showInlineNumbers ? citationNumber : 0}
                  totalCitations={citationNumbers.length}
                  isExpanded={expandedCitation === source}
                  onExpand={(src) => setExpandedCitation(src === expandedCitation ? null : src)}
                  sourceIndex={citation.sourceIndex}
                  onCitationClick={onCitationClick}
                  onFlagCitation={onFlagCitation}
                  isFlagged={flaggedCitationUrls?.has(source.url || '') || false}
                />
              );
            }
            // Non-inline fallback: regular link
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isUser, sources, citations, citationNumbers, preferences.style, preferences.showInlineNumbers, expandedCitation, onFlagCitation, flaggedCitationUrls]);

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

