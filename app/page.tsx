import Link from 'next/link'
import { getReports } from './lib/reports'

const TIER_ORDER: Array<keyof Awaited<ReturnType<typeof getReports>>[number]['tiers']> = [
  '龍頭',
  '強勢',
  '轉強',
  '低階',
  '中性',
]
const TIER_EMOJI: Record<string, string> = {
  龍頭: '👑',
  強勢: '🔥',
  轉強: '⚡',
  低階: '🌱',
  中性: '👀',
}

export default async function Home() {
  const reports = await getReports()

  return (
    <main>
      <header className="page-header">
        <h1>春燕來了 · 歷史報告</h1>
        <p className="subtitle">每日盤勢摘要時序歸檔</p>
      </header>

      {reports.length === 0 ? (
        <div className="empty-state">
          <p>還沒有發布任何報告。</p>
          <p className="hint">
            從 mediapost-test 跑 <code>publish.ps1</code> 把報告推上來。
          </p>
        </div>
      ) : (
        <ul className="cards">
          {reports.map((r) => (
            <li key={r.id} className="card">
              <Link href={`/reports/${r.id}`} className="card-link">
                <div className="card-date">
                  <span className="date-main">{r.date}</span>
                  <span className="date-weekday">{r.weekday}</span>
                  <span className="date-time">{r.time}</span>
                </div>

                <div className="card-stats">
                  <span>
                    <strong>{r.stock_count}</strong> 檔
                  </span>
                  <span className="sep">·</span>
                  <span>
                    <strong>{r.industry_count}</strong> 產業
                  </span>
                </div>

                <div className="tier-badges">
                  {TIER_ORDER.map((t) => (
                    <span key={t} className="tier-badge" title={t}>
                      {TIER_EMOJI[t]} {r.tiers[t]}
                    </span>
                  ))}
                </div>

                {r.teaser ? <p className="teaser">{r.teaser}</p> : null}

                {r.top_industries.length > 0 ? (
                  <p className="industries">
                    <span className="label">主要產業：</span>
                    {r.top_industries.join(' / ')}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="page-footer">
        共 {reports.length} 篇報告 · 自動化分析 · 內部審閱用
      </footer>
    </main>
  )
}
