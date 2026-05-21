import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReportIds, getReportMarkdown } from '@/app/lib/reports'

const SECTIONS = [
  { id: 'overview', label: '盤勢概況' },
  { id: 'key-points', label: '重點' },
  { id: 'industries', label: '產業分析' },
  { id: 'stocks', label: '個股提及' },
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
    <main className="mx-auto max-w-3xl px-6 py-8 md:py-10" id="top">
      <nav className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          回到歷史索引
        </Link>
      </nav>

      <nav
        aria-label="章節導航"
        className="sticky top-0 z-10 -mx-2 mb-6 flex flex-wrap items-center gap-2 border-b border-border bg-background/85 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex items-center rounded-full border border-border bg-muted px-3.5 py-1 text-sm text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            {s.label}
          </a>
        ))}
        <a
          href="#top"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          頂部
        </a>
      </nav>

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
