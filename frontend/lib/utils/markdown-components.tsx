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
  const language = (className || '').replace('language-', '').trim() || 'code';
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
    <div className="my-3 rounded-lg overflow-hidden border border-gray-700/50">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700/50">
        <span className="text-xs font-mono text-gray-400 select-none">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="px-2 py-0.5 text-[11px] font-medium rounded border border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
          aria-label={`Copy ${language} code`}
          title={copied ? 'Copied' : `Copy ${language} code`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Code area */}
      <div className={`relative ${isCollapsed ? 'max-h-[360px] overflow-hidden' : ''}`}>
        <div className="overflow-x-auto">
          <pre className="max-w-full m-0">
            <code className={`block text-sm font-mono bg-gray-900 text-gray-100 whitespace-pre ${showLineNumbers ? 'pl-0' : 'p-4'} ${className || ''}`} {...codeProps}>
              {showLineNumbers ? (
                <table className="border-collapse w-full">
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="leading-relaxed">
                        <td className="select-none text-right pr-4 pl-3 text-gray-500 text-xs font-mono align-top w-[1%] whitespace-nowrap border-r border-gray-700/50">{i + 1}</td>
                        <td className="pl-4 pr-4 whitespace-pre">{line || '\n'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span className="block p-4">{children}</span>
              )}
            </code>
          </pre>
        </div>
        {/* Collapse gradient overlay */}
        {isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
        )}
      </div>
      {/* Collapse/expand toggle */}
      {isCollapsible && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 bg-gray-800/80 border-t border-gray-700/50 transition-colors text-center"
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
