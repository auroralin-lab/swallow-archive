import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Radio } from 'lucide-react'
import {
  getReportData,
  groupStocks,
  partitionStocks,
  pickTierCounts,
  sentimentTone,
  parseKeyPoint,
  displayTier,
  hasValidTicker,
  PICK_TIER_ORDER,
  DISPLAY_TIER_META,
  type DisplayTier,
  type Stock,
  type StockGroup,
} from '@/app/lib/report-data'
import { getReportIds, getReportMeta } from '@/app/lib/reports'
import { buildBlogHtml, buildBlogPlain } from '@/app/lib/blog-html'
import { TableOfContents, type TocSection } from '@/components/toc'
import { CopyBlogButton } from './copy-blog-button'

const SECTIONS: TocSection[] = [
  { id: 'overview', label: '盤勢概況', shortLabel: '概況' },
  { id: 'key-points', label: '重點', shortLabel: '重點' },
  { id: 'industries', label: '產業觀點', shortLabel: '產業' },
  { id: 'stocks', label: '個股清單', shortLabel: '個股' },
]

export async function generateStaticParams() {
  const ids = await getReportIds()
  return ids.map((date) => ({ date }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>
}): Promise<Metadata> {
  const { date } = await params
  const meta = await getReportMeta(date)
  if (!meta) return {}
  const data = await getReportData(date)
  const desc = data?.market_overview
    ? data.market_overview.slice(0, 90)
    : '春燕來了每日盤勢摘要'
  return {
    title: `${meta.date}（${meta.weekday}）· 春燕來了`,
    description: desc,
  }
}

function TierBadge({ tier, count }: { tier: DisplayTier; count?: number }) {
  const m = DISPLAY_TIER_META[tier]
  return (
    <span className={`tier-badge tone-${m.tone}`} title={m.blurb}>
      <span className="t-emoji" aria-hidden>
        {m.emoji}
      </span>
      <span>{m.label}</span>
      {typeof count === 'number' ? <span className="t-count">{count}</span> : null}
    </span>
  )
}

// 校正信任訊號
function CorrectedMark({ stock }: { stock: Stock }) {
  if (!stock.original_gemini_name || stock.original_gemini_name === stock.name)
    return null
  return (
    <span
      className="stock-fix"
      title={`聽寫原文「${stock.original_gemini_name}」已校正`}
      aria-label={`聽寫原文「${stock.original_gemini_name}」已校正`}
    >
      <span aria-hidden>✎</span> 校正
    </span>
  )
}

function StockGroupBlock({ group }: { group: StockGroup }) {
  // 大類已在 major-band 點明，組標題去掉冗餘前綴
  const dash = group.industry.indexOf('-')
  const shortName =
    dash > 0 ? group.industry.slice(dash + 1) : group.industry || '未分類'
  return (
    <div className="stock-group" id={`ind-${encodeURIComponent(group.industry)}`}>
      <div className="stock-group-head">
        <span className="stock-group-name">{shortName}</span>
        <span className="stock-group-count">{group.rows.length} 檔</span>
      </div>
      {group.note ? <p className="stock-group-note">{group.note}</p> : null}
      <div className="stock-rows">
        {group.rows.map((row, i) => {
          const s = row.stock
          return (
            <div className="stock-row" key={`${s.ticker || s.name}-${i}`}>
              <TierBadge tier={displayTier(s.tier)} />
              <span className="stock-id">
                <span className="stock-name">{s.name}</span>
                {hasValidTicker(s) ? (
                  <span className="stock-ticker">{s.ticker}</span>
                ) : (
                  <span
                    className="stock-ticker-empty"
                    title="字典查無對應代號（可能是未上市／興櫃，或聽寫待確認）"
                  >
                    代號未對應
                  </span>
                )}
                {row.flag ? (
                  <span
                    className="tier-flag"
                    title={`此檔原列為強勢（${row.flag}），併入轉強供參考`}
                    aria-label={`原列強勢，${row.flag}，併入轉強`}
                  >
                    <span aria-hidden>🔥</span>
                    {row.flag}
                  </span>
                ) : null}
                <CorrectedMark stock={s} />
              </span>
              {row.showMention && s.mention ? (
                <p className="stock-mention">{s.mention}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const [data, meta] = await Promise.all([
    getReportData(date),
    getReportMeta(date),
  ])
  if (data === null || meta === null) notFound()

  // 盤勢概況拆「第一句＝重點」＋其餘脈絡，做出 Axios 式的一句話 takeaway
  const ovMatch = data.market_overview.match(/^([\s\S]*?。)([\s\S]*)$/)
  const ovLead = ovMatch ? ovMatch[1] : data.market_overview
  const ovRest = ovMatch ? ovMatch[2].trim() : ''

  // 雙核心：picks(轉強+低階) 才是選股；neutral(順帶提及) 與 pending(待校) 另列
  const { picks, neutral, pending } = partitionStocks(data.stocks)
  const counts = pickTierCounts(picks)
  const groups = groupStocks(picks)
  const presentTiers = PICK_TIER_ORDER.filter((t) => counts[t] > 0)

  // TOC 只列「實際會渲染」的章節，避免空章節留死連結
  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === 'key-points') return data.key_points.length > 0
    if (s.id === 'industries') return data.industries.length > 0
    return true
  })

  // 「複製到投資網誌」按鈕：用本頁同一份 JSON、同一套整理邏輯組 HTML（CKEditor 安全），
  // 確保複製出去的內容與畫面一致（getReportData 已做過語氣淨化）。
  const blogHtml = buildBlogHtml(data)
  const blogPlain = buildBlogPlain(data)

  let prevMajor: string | null = null

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-9" id="top">
      <nav className="mb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          回到歷史索引
        </Link>
      </nav>

      {/* ===== 報頭 ===== */}
      <header className="masthead">
        <span className="masthead-eyebrow">
          <Radio className="h-3.5 w-3.5" aria-hidden />
          春燕來了 · 每日盤勢摘要
        </span>
        <h1 className="masthead-title">
          <span className="masthead-date">{meta.date}</span>
          <span className="masthead-weekday">{meta.weekday}</span>
          <span className="masthead-time">{meta.time}</span>
        </h1>
      </header>

      {/* ===== 一覽統計列 ===== */}
      <div className="stat-strip">
        <span className="stat-lead">
          選股 <b>{picks.length}</b>
        </span>
        {presentTiers.map((t) => (
          <TierBadge key={t} tier={t} count={counts[t]} />
        ))}
        <span className="stat-sep" />
        <span className="stat-lead">
          產業 <b>{data.industries.length}</b>
        </span>
        {neutral.length > 0 ? (
          <span className="stat-muted">順帶提及 {neutral.length}</span>
        ) : null}
        {pending.length > 0 ? (
          <span className="stat-muted">待校 {pending.length}</span>
        ) : null}
      </div>

      <div className="mb-6 flex justify-end">
        {blogHtml && blogPlain ? (
          <CopyBlogButton html={blogHtml} plainFallback={blogPlain} />
        ) : null}
      </div>

      <TableOfContents sections={visibleSections} />

      {/* ===== 盤勢概況 ===== */}
      <section className="report-section" id="overview">
        <h2>
          <span className="sec-no">01</span>盤勢概況
        </h2>
        <div className="lead measure">
          <strong className="lead-tldr">{ovLead}</strong>
          {ovRest ? <span className="lead-rest">{ovRest}</span> : null}
        </div>
      </section>

      {/* ===== 重點 ===== */}
      {data.key_points.length > 0 ? (
        <section className="report-section" id="key-points">
          <h2>
            <span className="sec-no">02</span>重點
          </h2>
          <ul className="kp-list measure">
            {data.key_points.map((raw, i) => {
              const kp = parseKeyPoint(raw)
              return (
                <li className="kp-item" key={i}>
                  <span>
                    {kp.lead ? (
                      <>
                        <b className="kp-lead">{kp.lead}</b>
                        <span className="kp-sep"> — </span>
                      </>
                    ) : null}
                    {kp.body}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {/* ===== 產業觀點 ===== */}
      {data.industries.length > 0 ? (
        <section className="report-section" id="industries">
          <h2>
            <span className="sec-no">03</span>產業觀點
            <span className="sec-hint">
              春燕當日談的題材 · {data.industries.length} 個
            </span>
          </h2>
          <div className="industry-grid">
            {data.industries.map((ind, i) => (
              <div className="industry-view" key={i}>
                <div className="industry-view-head">
                  <span className="industry-view-name">{ind.name}</span>
                  <span
                    className={`sentiment sentiment-${sentimentTone(ind.sentiment)}`}
                  >
                    {ind.sentiment}
                  </span>
                </div>
                <p className="industry-view-summary">{ind.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ===== 個股清單（轉強 / 低階 雙核心）===== */}
      <section className="report-section" id="stocks">
        <h2>
          <span className="sec-no">04</span>個股清單
          <span className="sec-hint">轉強／低階 · 依類股分組 · {picks.length} 檔</span>
        </h2>

        <div className="tier-legend">
          {PICK_TIER_ORDER.map((t) => {
            const m = DISPLAY_TIER_META[t]
            return (
              <span className="tier-legend-item" key={t}>
                <span aria-hidden>{m.emoji}</span>
                <span className="lg-name">{m.label}</span>
                <span>{m.blurb}</span>
              </span>
            )
          })}
          <span className="tier-legend-item">
            <span aria-hidden>🔥</span>
            <span className="lg-name">漲停／已走強</span>
            <span>原列強勢，已併入轉強</span>
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="aside-empty">本篇沒有明確的轉強／低階選股。</p>
        ) : (
          groups.map((g) => {
            const showBand = g.major !== prevMajor
            prevMajor = g.major
            return (
              <div key={g.industry}>
                {showBand ? <div className="major-band">{g.major}</div> : null}
                <StockGroupBlock group={g} />
              </div>
            )
          })
        )}

        {/* 順帶提及（中性）：春燕有提到但沒明確表態，不算選股 */}
        {neutral.length > 0 ? (
          <details className="aside-section">
            <summary>
              春燕順帶提及 · 未明確表態
              <span className="aside-count">{neutral.length}</span>
            </summary>
            <p className="aside-hint">
              這些只是直播中帶到、沒被歸進轉強／低階，部分春燕其實不看好（看 view）。
            </p>
            <div className="aside-rows">
              {neutral.map((s, i) => (
                <div className="aside-row" key={`${s.ticker || s.name}-${i}`}>
                  <span className="aside-id">
                    <span className="stock-name">{s.name}</span>
                    {hasValidTicker(s) ? (
                      <span className="stock-ticker">{s.ticker}</span>
                    ) : (
                      <span className="stock-ticker-empty">代號未對應</span>
                    )}
                    {s.view ? (
                      <span
                        className={`sentiment sentiment-${sentimentTone(s.view)}`}
                      >
                        {s.view}
                      </span>
                    ) : null}
                    <CorrectedMark stock={s} />
                  </span>
                  {s.mention ? (
                    <p className="stock-mention">{s.mention}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {/* 待校：字典查無、多半是聽寫雜訊，獨立收納不污染選股 */}
        {pending.length > 0 ? (
          <details className="aside-section aside-pending">
            <summary>
              待校對 · 無對應代號
              <span className="aside-count">{pending.length}</span>
            </summary>
            <p className="aside-hint">
              比對不到台股代號，多為大陸口音同音字誤聽，少數可能是未上市／興櫃。已從選股移出，待人工確認。
            </p>
            <div className="aside-rows">
              {pending.map((s, i) => (
                <div
                  className="aside-row is-pending"
                  key={`${s.name}-${i}`}
                >
                  <span className="aside-id">
                    <span className="stock-name">{s.name}</span>
                    <span className="stock-pending">待校</span>
                    <CorrectedMark stock={s} />
                  </span>
                  {s.mention ? (
                    <p className="stock-mention">{s.mention}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>

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
