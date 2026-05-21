import Link from 'next/link'
import { notFound } from 'next/navigation'
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
    <main className="report">
      <nav className="report-nav">
        <Link href="/">← 回到歷史索引</Link>
      </nav>

      <nav className="toc" aria-label="章節導航">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {md}
        </ReactMarkdown>
      </article>

      <footer className="page-footer">
        <Link href="/">← 回到歷史索引</Link>
      </footer>
    </main>
  )
}
