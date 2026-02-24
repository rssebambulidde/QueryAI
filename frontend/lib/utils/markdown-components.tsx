/**
 * Shared markdown rendering components for react-markdown.
 *
 * These are used by EnhancedContentProcessor and can be re-used by any
 * component that renders AI-generated markdown content.
 */

import React from 'react';

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
    return (
      <pre className="overflow-x-auto max-w-full my-3">
        <code className={`block p-3 rounded-lg text-sm font-mono bg-gray-900 text-gray-100 ${className || ''}`} {...props}>
          {children}
        </code>
      </pre>
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
