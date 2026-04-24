'use client'

interface JobReportProps {
  html: string
}

export function JobReport({ html }: JobReportProps) {
  return (
    <div
      className="job-report text-sm text-[var(--text)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
