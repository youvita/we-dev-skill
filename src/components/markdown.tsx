import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders a skill guide. Raw HTML is not enabled, so authored content cannot
 * inject markup — the guides are written by skill owners, but that is no reason
 * to hand them a script tag.
 */
export function Markdown({ children }: { children: string }) {
  if (!children.trim()) {
    return <p className="text-sm italic text-faint">This guide is empty.</p>;
  }

  return (
    <div className="max-w-none text-sm leading-relaxed text-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="mb-3 mt-7 text-xl font-semibold tracking-tight text-ink first:mt-0" {...props} />
          ),
          h2: (props) => (
            <h2
              className="mb-2.5 mt-7 border-b border-hair pb-1.5 text-base font-semibold tracking-tight text-ink first:mt-0"
              {...props}
            />
          ),
          h3: (props) => (
            <h3 className="mb-2 mt-5 text-sm font-semibold text-ink first:mt-0" {...props} />
          ),
          p: (props) => <p className="mb-3.5 leading-relaxed" {...props} />,
          ul: (props) => <ul className="mb-3.5 list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="mb-3.5 list-decimal space-y-1 pl-5" {...props} />,
          li: (props) => <li className="leading-relaxed" {...props} />,
          a: (props) => (
            <a className="link font-medium" target="_blank" rel="noreferrer noopener" {...props} />
          ),
          blockquote: (props) => (
            <blockquote
              className="mb-3.5 border-l-2 border-brand-ring bg-wash py-2 pl-3.5 pr-3 text-muted"
              {...props}
            />
          ),
          hr: () => <hr className="my-6 border-line" />,
          strong: (props) => <strong className="font-semibold text-ink" {...props} />,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? '');
            if (isBlock) {
              return (
                <code className="block text-xs leading-relaxed" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded border border-line bg-wash px-1 py-0.5 font-mono text-[0.85em] text-ink"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre
              className="mb-3.5 overflow-x-auto rounded-lg border border-line bg-wash p-3.5 font-mono"
              {...props}
            />
          ),
          table: (props) => (
            <div className="mb-3.5 overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-wash" {...props} />,
          th: (props) => (
            <th
              className="border border-line px-2.5 py-1.5 text-left font-semibold text-ink"
              {...props}
            />
          ),
          td: (props) => <td className="border border-line px-2.5 py-1.5 align-top" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
