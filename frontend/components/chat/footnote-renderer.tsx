'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { Source } from '@/lib/api';
import { CitationMatch } from './inline-citation';
import { CitationRenderer } from '@/lib/citation-renderer';
import { getMarkdownComponents } from '@/lib/utils/markdown-components';

interface FootnoteRendererProps {
  citations: CitationMatch[];
  sources: Source[];
  citationNumbers: number[];
  style: 'inline' | 'footnote' | 'numbered';
  format: 'html' | 'plain' | 'markdown';
  showFootnotes: boolean;
  isUser?: boolean;
}

/**
 * Renders citation footnotes at the bottom of a message,
 * supporting multiple style + format combinations.
 */
export const FootnoteRenderer: React.FC<FootnoteRendererProps> = ({
  citations,
  sources,
  citationNumbers,
  style,
  format,
  showFootnotes,
  isUser = false,
}) => {
  if (citationNumbers.length === 0) return null;

  // Footnote style
  if (style === 'footnote') {
    if (format === 'html') {
      return (
        <div
          className="mt-6 pt-4 border-t border-gray-200"
          dangerouslySetInnerHTML={{
            __html:
              `<h4 class="text-sm font-semibold text-gray-700 mb-3">Footnotes</h4>` +
              CitationRenderer.renderFootnotes(citations, sources, citationNumbers, format),
          }}
        />
      );
    }

    if (format === 'plain') {
      return (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Footnotes</h4>
          <div className="text-sm text-gray-600 whitespace-pre-line">
            {CitationRenderer.renderFootnotes(citations, sources, citationNumbers, format)}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Footnotes</h4>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeHighlight, rehypeKatex]}
          components={getMarkdownComponents(isUser)}
        >
          {CitationRenderer.renderFootnotes(citations, sources, citationNumbers, format)}
        </ReactMarkdown>
      </div>
    );
  }

  // Inline style with showFootnotes
  if (style === 'inline' && showFootnotes) {
    return (
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Sources</h4>
        <ol className="space-y-2">
          {citationNumbers.map((num) => {
            const citation = citations.find((c) => c.number === num);
            if (!citation) return null;
            const source = sources[citation.sourceIndex];
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
