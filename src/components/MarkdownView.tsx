'use client';

import ReactMarkdown from 'react-markdown';

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose-clubar space-y-3 text-base leading-relaxed text-fg-body">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h2 className="mt-5 text-xl font-bold text-fg">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="mt-4 text-lg font-bold text-fg">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-3 text-base font-bold text-fg">{children}</h4>
          ),
          p: ({ children }) => <p className="whitespace-pre-line">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-accent-300 bg-brand-soft/60 px-4 py-2 text-fg-secondary">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-sm text-fg">
              {children}
            </code>
          ),
          a: ({ href, children }) => {
            const safeHref =
              href && /^(https?:|mailto:)/i.test(href) ? href : undefined;
            if (!safeHref) return <span>{children}</span>;
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-soft-fg underline underline-offset-2 hover:text-accent-900"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
