import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { OPENCLAW_AGENTS_DIR } from '@/lib/openclaw-paths'

export const dynamic = 'force-dynamic'

/** Minimal markdown → HTML, pure Node.js, zero deps. */
function miniMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code class="lj-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="lj-link">$1</a>')

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
        out.push(`<pre class="lj-mermaid">${esc(code)}</pre>`)
      } else {
        out.push(`<pre class="lj-pre"><code>${esc(code)}</code></pre>`)
      }
      i++; continue
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^[|\s:-]+$/.test(lines[i + 1])) {
      const headers = line.split('|').filter((_, j, a) => j > 0 && j < a.length - 1)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').filter((_, j, a) => j > 0 && j < a.length - 1))
        i++
      }
      out.push('<div class="lj-table-wrap"><table class="lj-table">')
      out.push('<thead><tr>' + headers.map(h => `<th>${inline(h.trim())}</th>`).join('') + '</tr></thead>')
      out.push('<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${inline(c.trim())}</td>`).join('') + '</tr>').join('') + '</tbody>')
      out.push('</table></div>')
      continue
    }

    // Headings
    const hm = line.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const lvl = hm[1].length
      out.push(`<h${lvl} class="lj-h${lvl}">${inline(hm[2])}</h${lvl}>`)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      out.push(`<blockquote class="lj-bq">${inline(line.slice(2))}</blockquote>`)
      i++; continue
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      out.push('<hr class="lj-hr" />')
      i++; continue
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      out.push('<ul class="lj-ul">')
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^[-*]\s/, ''))}</li>`)
        i++
      }
      out.push('</ul>')
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      out.push('<ol class="lj-ol">')
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\.\s/, ''))}</li>`)
        i++
      }
      out.push('</ol>')
      continue
    }

    // Blank line / paragraph
    if (line.trim() === '') { i++; continue }
    out.push(`<p class="lj-p">${inline(line)}</p>`)
    i++
  }
  return out.join('\n')
}

export interface LastJobEntry {
  agentId: string
  html: string
  updatedAt: number
}

export async function GET() {
  const results: LastJobEntry[] = []

  let agentDirs: string[] = []
  try { agentDirs = fs.readdirSync(OPENCLAW_AGENTS_DIR) } catch { return NextResponse.json({ jobs: [] }) }

  for (const agentId of agentDirs) {
    const filePath = path.join(OPENCLAW_AGENTS_DIR, agentId, 'last-job.md')
    try {
      const stat = fs.statSync(filePath)
      const md = fs.readFileSync(filePath, 'utf-8').trim()
      if (md) results.push({ agentId, html: miniMarkdown(md), updatedAt: stat.mtimeMs })
    } catch { /* skip */ }
  }

  results.sort((a, b) => b.updatedAt - a.updatedAt)
  return NextResponse.json({ jobs: results })
}
