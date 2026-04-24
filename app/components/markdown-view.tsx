'use client'

import { useEffect, useRef, useMemo } from 'react'
import { marked } from 'marked'

interface MarkdownViewProps {
  content: string
  className?: string
}

marked.setOptions({ gfm: true, breaks: true } as any)

export function MarkdownView({ content, className = '' }: MarkdownViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mermaidReady = useRef(false)

  const html = useMemo(() => marked.parse(content) as string, [content])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const blocks = container.querySelectorAll<HTMLElement>('code.language-mermaid')
    if (blocks.length === 0) return

    import('mermaid').then((m) => {
      if (!mermaidReady.current) {
        m.default.initialize({ startOnLoad: false, theme: 'dark' })
        mermaidReady.current = true
      }
      blocks.forEach(async (el) => {
        const id = 'mmd-' + Math.random().toString(36).slice(2)
        const source = el.textContent || ''
        try {
          const { svg } = await m.default.render(id, source)
          const wrapper = el.closest('pre') || el
          const div = document.createElement('div')
          div.className = 'overflow-x-auto text-center my-3'
          div.innerHTML = svg
          wrapper.replaceWith(div)
        } catch {
          // leave as code block on parse failure
        }
      })
    })
  }, [html])

  return (
    <div
      ref={containerRef}
      className={`prose prose-invert prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
