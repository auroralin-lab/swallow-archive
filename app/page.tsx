import Link from 'next/link'
import { Crown, Flame, Zap, Sprout, Eye, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getReports } from './lib/reports'
import type { ReportSummary, TierCounts } from './lib/reports'

type TierKey = keyof TierCounts

const TIERS: Array<{
  key: TierKey
  Icon: typeof Crown
  tone: 'gold' | 'orange' | 'amber' | 'moss' | 'smoke'
}> = [
  { key: '龍頭', Icon: Crown, tone: 'gold' },
  { key: '強勢', Icon: Flame, tone: 'orange' },
  { key: '轉強', Icon: Zap, tone: 'amber' },
  { key: '低階', Icon: Sprout, tone: 'moss' },
  { key: '中性', Icon: Eye, tone: 'smoke' },
]

export default async function Home() {
  const reports = await getReports()

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <header className="mb-10 border-b border-primary/40 pb-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-brown md:text-4xl">
          春燕來了 · 歷史報告
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          每日盤勢摘要時序歸檔
        </p>
      </header>

      {reports.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </ul>
      )}

      <footer className="mt-16 border-t border-border pt-5 text-center text-xs text-muted-foreground">
        共 {reports.length} 篇報告 · 自動化分析 · 內部審閱用
      </footer>
    </main>
  )
}

function ReportCard({ report: r }: { report: ReportSummary }) {
  return (
    <li>
      <Link
        href={`/reports/${r.id}`}
        className="group block focus-visible:outline-none"
      >
        <Card className="group-hover:border-primary/60 group-hover:shadow-paper-lifted group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background">
          <CardContent className="p-5 md:p-6">
            <div className="mb-2 flex items-baseline gap-3">
              <span className="font-mono text-lg font-semibold text-primary">
                {r.date}
              </span>
              <span className="text-sm text-muted-foreground">{r.weekday}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {r.time}
              </span>
              <ArrowRight
                aria-hidden
                className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </div>

            <div className="mb-3 text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {r.stock_count}
              </strong>{' '}
              檔
              <span className="mx-2 text-border">·</span>
              <strong className="font-semibold text-foreground">
                {r.industry_count}
              </strong>{' '}
              產業
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {TIERS.map(({ key, Icon, tone }) => (
                <Badge key={key} tone={tone} title={key}>
                  <Icon aria-hidden className="h-3 w-3" />
                  {r.tiers[key]}
                </Badge>
              ))}
            </div>

            {r.teaser ? (
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {r.teaser}
              </p>
            ) : null}

            {r.top_industries.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">主要產業：</span>
                {r.top_industries.join(' / ')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </Link>
    </li>
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
