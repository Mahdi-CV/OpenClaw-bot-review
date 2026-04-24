'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewProps {
  content: string
  className?: string
}

export function MarkdownView({ content, className = '' }: MarkdownViewProps) {
  const mermaidRef = useRef(false)

  useEffect(() => {
    // Lazy-init mermaid once per page load
    if (typeof window === 'undefined') return
    const mermaidBlocks = document.querySelectorAll('.mermaid-pending')
    if (mermaidBlocks.length === 0) return

    import('mermaid').then((m) => {
      if (!mermaidRef.current) {
        m.default.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: { background: 'transparent', primaryColor: '#4f46e5' },
        })
        mermaidRef.current = true
      }
      mermaidBlocks.forEach(async (el) => {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        try {
          const { svg } = await m.default.render(id, el.textContent || '')
          el.innerHTML = svg
          el.classList.remove('mermaid-pending')
        } catch {
          // leave as code block if parse fails
        }
      })
    })
  }, [content])

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks: detect mermaid language
          code({ node, className: cls, children, ...props }: any) {
            const lang = /language-(\w+)/.exec(cls || '')?.[1]
            const raw = String(children).replace(/\n$/, '')
            if (lang === 'mermaid') {
              return (
                <div
                  className="mermaid-pending my-3 overflow-x-auto text-center text-[var(--text)]"
                  suppressHydrationWarning
                >
                  {raw}
                </div>
              )
            }
            const isBlock = !props.ref && raw.includes('\n')
            if (isBlock) {
              return (
                <pre className="my-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] p-3 overflow-x-auto text-xs font-mono text-[var(--text)]">
                  <code>{raw}</code>
                </pre>
              )
            }
            return (
              <code className="px-1 py-0.5 rounded text-xs font-mono bg-[var(--bg)] border border-[var(--border)] text-[var(--accent)]">
                {children}
              </code>
            )
          },
          // Headings
          h1: ({ children }: any) => <h1 className="text-lg font-bold text-[var(--text)] mt-4 mb-2 border-b border-[var(--border)] pb-1">{children}</h1>,
          h2: ({ children }: any) => <h2 className="text-base font-bold text-[var(--text)] mt-3 mb-1.5">{children}</h2>,
          h3: ({ children }: any) => <h3 className="text-sm font-semibold text-[var(--text)] mt-2 mb-1">{children}</h3>,
          // Paragraphs
          p: ({ children }: any) => <p className="text-sm text-[var(--text)] leading-relaxed mb-2">{children}</p>,
          // Lists
          ul: ({ children }: any) => <ul className="list-disc list-inside text-sm text-[var(--text)] mb-2 space-y-0.5 pl-2">{children}</ul>,
          ol: ({ children }: any) => <ol className="list-decimal list-inside text-sm text-[var(--text)] mb-2 space-y-0.5 pl-2">{children}</ol>,
          li: ({ children }: any) => <li className="text-sm text-[var(--text)]">{children}</li>,
          // Tables
          table: ({ children }: any) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse border border-[var(--border)] rounded">{children}</table>
            </div>
          ),
          thead: ({ children }: any) => <thead className="bg-[var(--bg)]">{children}</thead>,
          th: ({ children }: any) => <th className="px-3 py-1.5 text-left font-semibold text-[var(--text)] border border-[var(--border)]">{children}</th>,
          td: ({ children }: any) => <td className="px-3 py-1.5 text-[var(--text-muted)] border border-[var(--border)]">{children}</td>,
          // Blockquote
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-[var(--accent)] pl-3 my-2 text-[var(--text-muted)] text-sm italic">{children}</blockquote>
          ),
          // HR
          hr: () => <hr className="my-3 border-[var(--border)]" />,
          // Links
          a: ({ href, children }: any) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{children}</a>
          ),
          // Strong / em
          strong: ({ children }: any) => <strong className="font-semibold text-[var(--text)]">{children}</strong>,
          em: ({ children }: any) => <em className="italic text-[var(--text-muted)]">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
