import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Radio, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  getReportIds,
  getReportMarkdown,
  getReportMeta,
} from '@/app/lib/reports'
import { TableOfContents, type TocSection } from '@/components/toc'

const SECTIONS: TocSection[] = [
  { id: 'overview', label: '盤勢概況', shortLabel: '概況' },
  { id: 'key-points', label: '重點' },
  { id: 'industries', label: '產業分析', shortLabel: '產業' },
  { id: 'stocks', label: '提及個股', shortLabel: '個股' },
]

function headingText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(headingText).join('')
  return ''
}

type IndustryEntry = { name: string; count: number }

// 從 markdown 抓「### 產業名（觀點）— N 檔」這類 h3，組產業導覽用的清單。
// 我們不解析「## 個股提及」之上的 h3（其實也沒有），所以全文 scan 即可。
function parseIndustries(md: string): IndustryEntry[] {
  const out: IndustryEntry[] = []
  const re = /^###\s+(.+?)(?:（[^）]+）)?\s+—\s+(\d+)\s*檔/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    out.push({ name: m[1].trim(), count: Number(m[2]) })
  }
  return out
}

function industrySlugFromHeading(text: string): string | null {
  // text 例: 「傳產-其他（正面）— 4 檔」 或 「電子上游-連接元件 — 3 檔」
  const m = text.match(/^(.+?)(?:（[^）]+）)?\s+—\s+\d+\s*檔/)
  return m ? m[1].trim() : null
}

function IndustryChipNav({ items }: { items: IndustryEntry[] }) {
  if (items.length === 0) return null
  return (
    <nav className="industry-chips" aria-label="跳到產業">
      <p className="industry-chips-hint">
        依<span className="hint-tier">春燕提及順序</span>排列
        （只含 <span className="hint-tier">⚡轉強</span>+
        <span className="hint-tier">🌱低階</span> 個股）
      </p>
      <div className="industry-chips-list">
        {items.map((i) => (
          <a
            key={i.name}
            href={`#ind-${encodeURIComponent(i.name)}`}
            className="industry-chip"
          >
            <span className="industry-chip-name">{i.name}</span>
            <span className="industry-chip-count">{i.count}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}

function buildComponents(industries: IndustryEntry[]): Components {
  return {
    h2: ({ children, ...props }) => {
      const text = headingText(children).trim()
      const section = SECTIONS.find((s) => text.startsWith(s.label))
      const isStocksHeading = text.startsWith('提及個股')
      return (
        <>
          <h2 id={section?.id} {...props}>
            {children}
          </h2>
          {isStocksHeading ? <IndustryChipNav items={industries} /> : null}
        </>
      )
    },
    h3: ({ children, ...props }) => {
      const text = headingText(children).trim()
      const slug = industrySlugFromHeading(text)
      return (
        <h3 id={slug ? `ind-${slug}` : undefined} {...props}>
          {children}
        </h3>
      )
    },
    table: ({ children, ...props }) => (
      <div className="markdown-body-table-wrap">
        <table {...props}>{children}</table>
      </div>
    ),
  }
}

export async function generateStaticParams() {
  const ids = await getReportIds()
  return ids.map((date) => ({ date }))
}

function formatGenerated(iso: string | null): string | null {
  if (!iso) return null
  // ISO 8601 with offset, ex: 2026-05-25T22:08:33+08:00
  // 顯示成「05-25 22:08」這種短格式
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return iso
  const [, , mo, d, hh, mm] = m
  return `${mo}-${d} ${hh}:${mm}`
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const [md, meta] = await Promise.all([
    getReportMarkdown(date),
    getReportMeta(date),
  ])
  if (md === null || meta === null) notFound()

  const generatedShort = formatGenerated(meta.generated_at)
  const industries = parseIndustries(md)
  const components = buildComponents(industries)

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

      <header className="mb-6 rounded-md border border-border bg-card px-4 py-3 shadow-paper">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
          <span className="inline-flex items-baseline gap-2">
            <Radio
              aria-hidden
              className="h-4 w-4 shrink-0 translate-y-[2px] text-primary"
            />
            <span className="font-mono text-base font-semibold text-primary sm:text-lg">
              {meta.date}
            </span>
            <span className="text-sm text-muted-foreground">
              {meta.weekday}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              {meta.time}
            </span>
          </span>
          {generatedShort ? (
            <span className="ml-auto inline-flex items-baseline gap-1.5 text-xs text-muted-foreground">
              <FileText
                aria-hidden
                className="h-3 w-3 shrink-0 translate-y-[1px]"
              />
              <span>轉錄</span>
              <span className="font-mono">{generatedShort}</span>
            </span>
          ) : null}
        </div>
      </header>

      <TableOfContents sections={SECTIONS} />

      <article className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
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
