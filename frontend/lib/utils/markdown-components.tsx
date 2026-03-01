/**
 * Shared markdown rendering components for react-markdown.
 *
 * These are used by EnhancedContentProcessor and can be re-used by any
 * component that renders AI-generated markdown content.
 */

import React from 'react';

const COLLAPSE_THRESHOLD = 30;
const COLLAPSE_VISIBLE_LINES = 15;
const LINE_NUMBER_THRESHOLD = 10;

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return '';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function MarkdownCodeBlock({
  className,
  children,
  codeProps,
}: {
  className?: string;
  children: React.ReactNode;
  codeProps: Record<string, any>;
}) {
  const [copied, setCopied] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(true);
  const codeText = React.useMemo(
    () => extractText(children).replace(/\n$/, ''),
    [children],
  );
  const language = (className || '').split(/\s+/).find(c => c.startsWith('language-'))?.replace('language-', '') || '';
  const hasLanguage = language !== '';
  const displayLanguage = hasLanguage ? capitalize(language) : '';
  const lines = codeText.split('\n');
  const lineCount = lines.length;
  const showLineNumbers = lineCount > LINE_NUMBER_THRESHOLD;
  const isCollapsible = lineCount > COLLAPSE_THRESHOLD;
  const isCollapsed = isCollapsible && collapsed;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeText);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = codeText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // no-op: avoid breaking rendering for clipboard failures
    }
  };

  return (
    <div className={`my-3 rounded-xl overflow-hidden bg-gray-50 ${hasLanguage ? 'border border-gray-200' : ''}`}>
      {/* Header bar — only shown for recognized languages */}
      {hasLanguage && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
          <div className="flex items-center gap-1.5 select-none">
            <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 12 1 8 5 4" />
              <polyline points="11 4 15 8 11 12" />
            </svg>
            <span className="text-xs font-semibold text-gray-700">{displayLanguage}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={`Copy ${language} code`}
            title={copied ? 'Copied' : `Copy ${language} code`}
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="9" height="9" rx="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
              </svg>
            )}
          </button>
        </div>
      )}
      {/* Code area */}
      <div className={`relative ${isCollapsed ? 'max-h-[360px] overflow-hidden' : ''}`}>
        <div className="overflow-x-auto">
          <pre className="max-w-full m-0">
            <code className={`block text-sm font-mono !bg-gray-50 text-gray-800 whitespace-pre ${showLineNumbers ? 'pl-0 py-3' : 'p-4'} ${className || ''}`} {...codeProps}>
              {showLineNumbers ? (
                <table className="border-collapse w-full">
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="leading-relaxed">
                        <td className="select-none text-right pr-3 pl-4 py-0 text-gray-400 text-xs font-mono align-top w-[1%] whitespace-nowrap">{i + 1}</td>
                        <td className="pl-3 pr-4 py-0 whitespace-pre">{line || '\n'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span className="block px-4">{children}</span>
              )}
            </code>
          </pre>
        </div>
        {/* Collapse gradient overlay */}
        {isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />
        )}
      </div>
      {/* Collapse/expand toggle */}
      {isCollapsible && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors text-center ${hasLanguage ? 'border-t border-gray-200' : ''}`}
        >
          {collapsed ? `Show ${lineCount - COLLAPSE_VISIBLE_LINES} more lines` : 'Collapse'}
        </button>
      )}
    </div>
  );
}

export const getMarkdownComponents = (isUser: boolean) => ({
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
    <h4 className="text-base font-semibold mt-2.5 mb-1 first:mt-0 text-gray-900 text-left" {...props} />
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
        <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-sm font-mono align-baseline break-words" {...props}>
          {children}
        </code>
      );
    }
    return <MarkdownCodeBlock className={className} children={children} codeProps={props} />;
  },
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-600 text-left" {...props} />
  ),
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead className="bg-gray-50" {...props} />
  ),
  tbody: ({ node, ...props }: any) => (
    <tbody className="divide-y divide-gray-200" {...props} />
  ),
  tr: ({ node, ...props }: any) => (
    <tr className="hover:bg-gray-50/50" {...props} />
  ),
  th: ({ node, ...props }: any) => (
    <th className="px-3 py-2 text-left font-semibold text-gray-900 border-b-2 border-gray-200 whitespace-nowrap" {...props} />
  ),
  td: ({ node, ...props }: any) => (
    <td className="px-3 py-2 text-gray-700 border-b border-gray-100" {...props} />
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
