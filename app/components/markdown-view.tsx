'use client'

import { useEffect, useRef } from 'react'

interface Props {
  content: string
  className?: string
}

/** Minimal markdown → HTML, no external deps. Handles: headings, tables,
 *  fenced code (incl. mermaid), bold, italic, inline code, blockquote,
 *  unordered/ordered lists, horizontal rules, links. */
function miniMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded text-xs font-mono bg-black/30 border border-white/10 text-purple-300">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-[var(--text)]">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic text-[var(--text-muted)]">$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[var(--accent)] hover:underline">$1</a>')

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      const code = codeLines.join('\n')
      if (lang === 'mermaid') {
        out.push(`<div class="mermaid-src" style="display:none">${esc(code)}</div><div class="mermaid-out my-3 overflow-x-auto text-center text-[var(--text-muted)] text-xs italic">Loading diagram…</div>`)
      } else {
        out.push(`<pre class="my-2 rounded-lg bg-black/30 border border-white/10 p-3 overflow-x-auto text-xs font-mono text-[var(--text)]"><code>${esc(code)}</code></pre>`)
      }
      i++
      continue
    }

    // Table (line with | chars and next line is separator)
    if (line.includes('|') && i + 1 < lines.length && /^[|\s:-]+$/.test(lines[i + 1])) {
      const headers = line.split('|').filter((_, j, a) => j > 0 && j < a.length - 1)
      i += 2 // skip separator
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').filter((_, j, a) => j > 0 && j < a.length - 1))
        i++
      }
      out.push('<div class="overflow-x-auto mb-3"><table class="w-full text-xs border-collapse border border-[var(--border)] rounded">')
      out.push('<thead class="bg-[var(--bg)]"><tr>' + headers.map(h => `<th class="px-3 py-1.5 text-left font-semibold text-[var(--text)] border border-[var(--border)]">${inline(h.trim())}</th>`).join('') + '</tr></thead>')
      out.push('<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td class="px-3 py-1.5 text-[var(--text-muted)] border border-[var(--border)]">${inline(c.trim())}</td>`).join('') + '</tr>').join('') + '</tbody>')
      out.push('</table></div>')
      continue
    }

    // Headings
    const hm = line.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const level = hm[1].length
      const cls = level === 1
        ? 'text-base font-bold text-[var(--text)] mt-4 mb-2 border-b border-[var(--border)] pb-1'
        : level === 2
        ? 'text-sm font-bold text-[var(--text)] mt-3 mb-1.5'
        : 'text-sm font-semibold text-[var(--text)] mt-2 mb-1'
      out.push(`<h${level} class="${cls}">${inline(hm[2])}</h${level}>`)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      out.push(`<blockquote class="border-l-4 border-[var(--accent)] pl-3 my-2 text-[var(--text-muted)] text-sm italic">${inline(line.slice(2))}</blockquote>`)
      i++; continue
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      out.push('<hr class="my-3 border-[var(--border)]" />')
      i++; continue
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      out.push('<ul class="list-disc list-inside text-sm text-[var(--text)] mb-2 space-y-0.5 pl-2">')
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^[-*]\s/, ''))}</li>`)
        i++
      }
      out.push('</ul>')
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      out.push('<ol class="list-decimal list-inside text-sm text-[var(--text)] mb-2 space-y-0.5 pl-2">')
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\.\s/, ''))}</li>`)
        i++
      }
      out.push('</ol>')
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++; continue
    }

    // Paragraph
    out.push(`<p class="text-sm text-[var(--text)] leading-relaxed mb-2">${inline(line)}</p>`)
    i++
  }

  return out.join('\n')
}

export function MarkdownView({ content, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const html = miniMarkdown(content)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const srcs = container.querySelectorAll<HTMLElement>('.mermaid-src')
    if (srcs.length === 0) return

    import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, theme: 'dark' })
      srcs.forEach(async (srcEl) => {
        const outEl = srcEl.nextElementSibling as HTMLElement | null
        if (!outEl) return
        const id = 'mmd-' + Math.random().toString(36).slice(2)
        try {
          const { svg } = await m.default.render(id, srcEl.textContent || '')
          outEl.innerHTML = svg
          outEl.classList.remove('italic', 'text-xs', 'text-[var(--text-muted)]')
        } catch {
          outEl.textContent = '(diagram parse error)'
        }
      })
    }).catch(() => {})
  }, [html])

  return (
    <div
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
