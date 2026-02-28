/**
 * Shared markdown rendering components for react-markdown.
 *
 * These are used by EnhancedContentProcessor and can be re-used by any
 * component that renders AI-generated markdown content.
 */

import React from 'react';

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
  const codeText = React.useMemo(
    () => extractText(children).replace(/\n$/, ''),
    [children],
  );
  const language = (className || '').replace('language-', '').trim() || 'code';

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
    <div className="relative my-3 group/code">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-500/40 bg-gray-800/90 text-gray-100 hover:bg-gray-700 transition-colors"
        aria-label={`Copy ${language} code`}
        title={copied ? 'Copied' : `Copy ${language} code`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto max-w-full pr-16 rounded-lg">
        <code className={`block p-3 rounded-lg text-sm font-mono bg-gray-900 text-gray-100 whitespace-pre min-w-max ${className || ''}`} {...codeProps}>
          {children}
        </code>
      </pre>
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
        <code className="bg-gray-100 text-orange-600 px-1.5 py-0.5 rounded text-sm font-mono align-baseline break-words" {...props}>
          {children}
        </code>
      );
    }
    return <MarkdownCodeBlock className={className} children={children} codeProps={props} />;
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
