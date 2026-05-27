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

type IndustryGroup = { label: string; items: IndustryEntry[] }

// 大類顯示順序 — 固定優先序，未在此清單的歸「其他」放最後
const INDUSTRY_GROUP_ORDER = ['傳產', '電子上游', '電子中游', '電子下游', '軟體']

function groupIndustries(items: IndustryEntry[]): IndustryGroup[] {
  // 依 industry name 的「-」之前 prefix 分群；組內保留原 items 的順序（= 春燕提及序）
  const buckets = new Map<string, IndustryEntry[]>()
  for (const item of items) {
    const dashIdx = item.name.indexOf('-')
    const label = dashIdx > 0 ? item.name.slice(0, dashIdx) : '其他'
    const arr = buckets.get(label) ?? []
    arr.push(item)
    buckets.set(label, arr)
  }
  const groups: IndustryGroup[] = []
  for (const label of INDUSTRY_GROUP_ORDER) {
    const arr = buckets.get(label)
    if (arr && arr.length > 0) groups.push({ label, items: arr })
    buckets.delete(label)
  }
  // 剩下未在 GROUP_ORDER 的（含「其他」或未來新類別）放最後
  for (const [label, arr] of buckets) {
    if (arr.length > 0) groups.push({ label, items: arr })
  }
  return groups
}

function IndustryChipNav({ items }: { items: IndustryEntry[] }) {
  if (items.length === 0) return null
  const groups = groupIndustries(items)
  return (
    <nav className="industry-chips" aria-label="跳到產業">
      <p className="industry-chips-hint">
        依產業大類分組、組內按
        <span className="hint-tier">春燕提及順序</span>
        （只含 <span className="hint-tier">⚡轉強</span>+
        <span className="hint-tier">🌱低階</span> 個股）
      </p>
      {groups.map((g) => (
        <div key={g.label} className="industry-group">
          <h4 className="industry-group-label">
            {g.label}
            <span className="industry-group-count">{g.items.length}</span>
          </h4>
          <div className="industry-chips-list">
            {g.items.map((i) => {
              // 在分組標題已點明大類，chip 內 name 去掉冗餘 prefix
              const dashIdx = i.name.indexOf('-')
              const displayName =
                dashIdx > 0 ? i.name.slice(dashIdx + 1) : i.name
              return (
                <a
                  key={i.name}
                  href={`#ind-${encodeURIComponent(i.name)}`}
                  className="industry-chip"
                  title={i.name}
                >
                  <span className="industry-chip-name">{displayName}</span>
                  <span className="industry-chip-count">{i.count}</span>
                </a>
              )
            })}
          </div>
        </div>
      ))}
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
