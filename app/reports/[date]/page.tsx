import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReportIds, getReportMarkdown } from '@/app/lib/reports'
import { TableOfContents, type TocSection } from '@/components/toc'

const SECTIONS: TocSection[] = [
  { id: 'overview', label: '盤勢概況', shortLabel: '概況' },
  { id: 'key-points', label: '重點' },
  { id: 'industries', label: '產業分析', shortLabel: '產業' },
  { id: 'stocks', label: '個股提及', shortLabel: '個股' },
]

function headingText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(headingText).join('')
  return ''
}

const components: Components = {
  h2: ({ children, ...props }) => {
    const text = headingText(children).trim()
    const section = SECTIONS.find((s) => text.startsWith(s.label))
    return (
      <h2 id={section?.id} {...props}>
        {children}
      </h2>
    )
  },
  table: ({ children, ...props }) => (
    <div className="markdown-body-table-wrap">
      <table {...props}>{children}</table>
    </div>
  ),
}

export async function generateStaticParams() {
  const ids = await getReportIds()
  return ids.map((date) => ({ date }))
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const md = await getReportMarkdown(date)
  if (md === null) notFound()

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10" id="top">
      <nav className="mb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          回到歷史索引
        </Link>
      </nav>

      <TableOfContents sections={SECTIONS} />

      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {md}
        </ReactMarkdown>
      </article>

      <footer className="mt-16 border-t border-border pt-5 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          回到歷史索引
        </Link>
      </footer>
    </main>
  )
}
