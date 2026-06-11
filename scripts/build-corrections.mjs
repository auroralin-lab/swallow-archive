// 產生「個股名稱／代號校正」稽核檔 —— 純後台記錄，不被任何頁面 import、不顯示在介面。
// 來源：public/data/reports/*.json（pipeline 已把聽寫原文存在 original_gemini_*）。
// 輸出：corrections/corrections.json（機器可讀） + corrections/corrections.md（人看）。
// 用法：node scripts/build-corrections.mjs
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs'
import path from 'node:path'

const REPORTS = path.join(process.cwd(), 'public', 'data', 'reports')
const OUT_DIR = path.join(process.cwd(), 'corrections')

const files = readdirSync(REPORTS)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .reverse() // 新到舊

const rows = []
for (const f of files) {
  const id = f.replace(/\.json$/, '')
  const data = JSON.parse(readFileSync(path.join(REPORTS, f), 'utf-8'))
  const date = id.slice(0, 4) + '-' + id.slice(4, 6) + '-' + id.slice(6, 8)
  for (const s of data.stocks ?? []) {
    const heardName = s.original_gemini_name ?? ''
    const heardTicker = s.original_gemini_ticker ?? ''
    const nameFixed = heardName && heardName !== s.name
    const tickerFixed = heardTicker && heardTicker !== (s.ticker ?? '')
    if (!nameFixed && !tickerFixed) continue
    rows.push({
      report: id,
      date,
      ticker: s.ticker ?? '',
      name: s.name ?? '',
      heard_name: heardName,
      name_fixed: !!nameFixed,
      heard_ticker: heardTicker,
      ticker_fixed: !!tickerFixed,
      match_source: s._match_source ?? '', // pipeline 比對來源（修正方法）
      tier: s.tier ?? '',
      industry: s.industry ?? '',
    })
  }
}

mkdirSync(OUT_DIR, { recursive: true })

// ---- JSON ----
const json = {
  generated_from: 'public/data/reports/*.json',
  note: '後台稽核用，不顯示於介面。重新產生：node scripts/build-corrections.mjs',
  total_reports: files.length,
  total_corrections: rows.length,
  corrections: rows,
}
writeFileSync(
  path.join(OUT_DIR, 'corrections.json'),
  JSON.stringify(json, null, 2) + '\n',
  'utf-8',
)

// ---- Markdown ----
const byReport = new Map()
for (const r of rows) {
  if (!byReport.has(r.report)) byReport.set(r.report, [])
  byReport.get(r.report).push(r)
}
const md = []
md.push('# 個股名稱／代號 校正紀錄（後台稽核用，不顯示於介面）\n')
md.push(
  `> 由 \`scripts/build-corrections.mjs\` 從報告 JSON 產生。共 ${files.length} 篇、${rows.length} 筆校正。`,
)
md.push('> 聽寫原文＝Whisper/Gemini 當下聽到的；校正後＝字典比對修正的結果。\n')
for (const [id, list] of byReport) {
  md.push(`\n## ${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}　(${list.length} 筆)\n`)
  md.push('| 代號 | 校正後 | 聽寫原文 | 階層 | 比對來源 | 產業 |')
  md.push('|------|--------|----------|------|----------|------|')
  for (const r of list) {
    const nm = r.name_fixed ? `${r.heard_name} → **${r.name}**` : r.name
    const heardCell = r.ticker_fixed
      ? `名:${r.heard_name || '—'} / 代號:${r.heard_ticker}`
      : r.heard_name || '—'
    md.push(
      `| ${r.ticker || '—'} | ${r.name_fixed ? `**${r.name}**` : r.name} | ${heardCell} | ${r.tier} | ${r.match_source || '—'} | ${r.industry || '—'} |`,
    )
  }
}
writeFileSync(path.join(OUT_DIR, 'corrections.md'), md.join('\n') + '\n', 'utf-8')

console.log(
  `corrections: ${rows.length} across ${files.length} reports -> corrections/corrections.{json,md}`,
)
