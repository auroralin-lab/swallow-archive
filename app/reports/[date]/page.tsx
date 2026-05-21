import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getReportIds, getReportMarkdown } from '@/app/lib/reports'

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

      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </article>

      <footer className="page-footer">
        <Link href="/">← 回到歷史索引</Link>
      </footer>
    </main>
  )
}
