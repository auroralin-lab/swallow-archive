import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { getReports } from './lib/reports'
import type { ReportSummary } from './lib/reports'
import {
  getReportData,
  partitionStocks,
  pickTierCounts,
  PICK_TIER_ORDER,
  DISPLAY_TIER_META,
  type DisplayTier,
} from './lib/report-data'

// 首頁卡片：用「精確分區」而非 manifest 原始階數，確保與報告頁的「選股 N」一致
type ArchiveItem = {
  r: ReportSummary
  pickTotal: number
  counts: Record<DisplayTier, number>
  neutral: number
  pending: number
}

function yearMonth(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})/)
  if (!m) return date
  return `${m[1]} 年 ${Number(m[2])} 月`
}

export default async function Home() {
  const reports = await getReports()

  // 逐篇讀 JSON 精確分區（SSG，14 篇成本可忽略），與 /reports/[date] 同一套 partitionStocks
  const items: ArchiveItem[] = await Promise.all(
    reports.map(async (r) => {
      const data = await getReportData(r.id)
      const part = data
        ? partitionStocks(data.stocks)
        : { picks: [], neutral: [], pending: [] }
      return {
        r,
        pickTotal: part.picks.length,
        counts: pickTierCounts(part.picks),
        neutral: part.neutral.length,
        pending: part.pending.length,
      }
    }),
  )

  // 依年月分組（items 已是新到舊）
  const groups: Array<{ label: string; items: ArchiveItem[] }> = []
  for (const it of items) {
    const label = yearMonth(it.r.date)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(it)
    else groups.push({ label, items: [it] })
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 md:py-14">
      <header className="masthead">
        <span className="masthead-eyebrow">春燕來了</span>
        <div className="masthead-title">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-brown md:text-4xl">
            每日盤勢摘要 · 歷史報告
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          每日直播的盤勢與選股，逐日結構化歸檔。共{' '}
          <b className="tnum font-semibold text-foreground">{reports.length}</b>{' '}
          篇。
        </p>
      </header>

      {reports.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {groups.map((g) => (
            <section key={g.label}>
              <div className="archive-month">{g.label}</div>
              <ul className="grid gap-3">
                {g.items.map((it) => (
                  <li key={it.r.id}>
                    <Link
                      href={`/reports/${it.r.id}`}
                      className="archive-row block"
                    >
                      <ArchiveRow item={it} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-16 border-t border-border pt-5 text-center text-xs text-muted-foreground">
        自動化轉錄 · 結構化分析 · 內部審閱用
      </footer>
    </main>
  )
}

function TierChip({ tier, count }: { tier: DisplayTier; count: number }) {
  const m = DISPLAY_TIER_META[tier]
  return (
    <span
      className={`tier-badge tone-${m.tone}`}
      title={`${m.label}：${m.blurb}`}
      aria-label={`${m.label} ${count} 檔`}
    >
      <span className="t-emoji" aria-hidden>
        {m.emoji}
      </span>
      <span>{m.label}</span>
      <span className="t-count">{count}</span>
    </span>
  )
}

function ArchiveRow({ item }: { item: ArchiveItem }) {
  const { r, counts, pickTotal, neutral, pending } = item
  const presentTiers = PICK_TIER_ORDER.filter((t) => counts[t] > 0)
  return (
    <>
      <div className="archive-row-top">
        <span className="archive-date">{r.date}</span>
        <span className="archive-weekday">{r.weekday}</span>
        <span className="archive-time">{r.time}</span>
        <span className="archive-counts">
          選股 <b>{pickTotal}</b> · <b>{r.industry_count}</b> 產業
        </span>
      </div>

      {presentTiers.length > 0 ? (
        <div className="archive-tiers">
          {presentTiers.map((t) => (
            <TierChip key={t} tier={t} count={counts[t]} />
          ))}
          {neutral > 0 ? (
            <span className="archive-aside-count">順帶 {neutral}</span>
          ) : null}
          {pending > 0 ? (
            <span className="archive-aside-count">待校 {pending}</span>
          ) : null}
        </div>
      ) : null}

      {r.teaser ? <p className="archive-teaser">{r.teaser}</p> : null}

      {r.top_industries.length > 0 ? (
        <p className="archive-inds">
          <b>主要類股：</b>
          {r.top_industries.join('、')}
        </p>
      ) : null}
    </>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <p className="text-muted-foreground">還沒有發布任何報告。</p>
        <p className="mt-2 text-sm text-muted-foreground">
          從 mediapost-test 跑{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-brand-brown">
            publish.ps1
          </code>{' '}
          把報告推上來。
        </p>
      </CardContent>
    </Card>
  )
}
