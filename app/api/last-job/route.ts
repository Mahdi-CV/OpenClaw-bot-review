import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { OPENCLAW_AGENTS_DIR } from '@/lib/openclaw-paths'

export const dynamic = 'force-dynamic'

export interface LastJobEntry {
  agentId: string
  content: string      // raw markdown
  updatedAt: number    // mtime epoch ms
}

export async function GET() {
  const results: LastJobEntry[] = []

  let agentDirs: string[] = []
  try {
    agentDirs = fs.readdirSync(OPENCLAW_AGENTS_DIR)
  } catch {
    return NextResponse.json({ jobs: [] })
  }

  for (const agentId of agentDirs) {
    const filePath = path.join(OPENCLAW_AGENTS_DIR, agentId, 'last-job.md')
    try {
      const stat = fs.statSync(filePath)
      const content = fs.readFileSync(filePath, 'utf-8').trim()
      if (content) {
        results.push({ agentId, content, updatedAt: stat.mtimeMs })
      }
    } catch {
      // file doesn't exist for this agent — skip
    }
  }

  // Sort newest first
  results.sort((a, b) => b.updatedAt - a.updatedAt)

  return NextResponse.json({ jobs: results })
}
