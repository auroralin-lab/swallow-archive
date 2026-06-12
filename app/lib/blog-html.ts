import 'server-only'

import {
  DISPLAY_TIER_META,
  displayTier,
  groupStocks,
  parseKeyPoint,
  partitionStocks,
  type ReportData,
} from './report-data'

// 把報告 JSON 組成「貼進投資網誌後台 CKEditor 不會跑版」的乾淨 HTML。
// 與報告頁共用同一套整理邏輯（partitionStocks / groupStocks / displayTier / parseKeyPoint），
// 讓複製出去的內容與畫面一致：強勢併轉強（帶 🔥 小旗）、傳產優先的分組排序、
// 組內摘要去重、待校（無代號的聽寫雜訊）不輸出——未經人工確認的名字不該發到粉絲面前。
//
// CKEditor 5 白名單（DevTools 實測）：
// - <table> 的 inline style、width 屬性、<colgroup> 全被洗掉
// - <td>/<th> 的 inline style 對 padding、vertical-align、border-color、background-color、width 放行
// - 所以欄寬寫在每個 cell 的 style="width:Npx"，每張表加總 910px（= CKEditor 文章欄寬）

const TH_STYLE =
  'border-color:#d4d4d4;background-color:#f5f5f5;padding:4px 8px;vertical-align:top'
const TD_STYLE = 'border-color:#e0e0e0;padding:4px 8px;vertical-align:top'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function th(text: string, w: number): string {
  return `<th style="${TH_STYLE};width:${w}px">${esc(text)}</th>`
}

function td(text: string, w: number): string {
  return `<td style="${TD_STYLE};width:${w}px">${esc(text)}</td>`
}

/** 大類已在組標題點明，去掉「傳產-」這類冗餘前綴（與報告頁 StockGroupBlock 同邏輯） */
function shortIndustryName(industry: string): string {
  const dash = industry.indexOf('-')
  return dash > 0 ? industry.slice(dash + 1) : industry || '未分類'
}

function stageLabel(tier: ReportData['stocks'][number]['tier'], flag: string | null): string {
  const m = DISPLAY_TIER_META[displayTier(tier)]
  return flag ? `${m.emoji} ${m.label} 🔥${flag}` : `${m.emoji} ${m.label}`
}

export function buildBlogHtml(data: ReportData): string {
  const parts: string[] = []

  // ===== 盤勢概況 —— 與報告頁同樣把第一句當 takeaway 加粗 =====
  if (data.market_overview) {
    const m = data.market_overview.match(/^([\s\S]*?。)([\s\S]*)$/)
    const lead = m ? m[1] : data.market_overview
    const rest = m ? m[2].trim() : ''
    parts.push('<h2>盤勢概況</h2>')
    parts.push(`<p><strong>${esc(lead)}</strong>${rest ? esc(rest) : ''}</p>`)
  }

  // ===== 重點 =====
  if (data.key_points.length > 0) {
    parts.push('<h2>重點</h2>')
    parts.push('<ul>')
    for (const raw of data.key_points) {
      const kp = parseKeyPoint(raw)
      parts.push(
        kp.lead
          ? `<li><strong>${esc(kp.lead)}</strong> — ${esc(kp.body)}</li>`
          : `<li>${esc(kp.body)}</li>`,
      )
    }
    parts.push('</ul>')
  }

  // ===== 產業觀點 =====
  if (data.industries.length > 0) {
    parts.push('<h2>產業觀點</h2>')
    parts.push(
      `<table><thead><tr>${th('產業', 130)}${th('觀點', 90)}${th('摘要', 690)}</tr></thead><tbody>`,
    )
    for (const ind of data.industries) {
      parts.push(
        `<tr>${td(ind.name, 130)}${td(ind.sentiment, 90)}${td(ind.summary, 690)}</tr>`,
      )
    }
    parts.push('</tbody></table>')
  }

  // ===== 個股清單（轉強／低階雙核心，分組排序與報告頁一致）=====
  const { picks, neutral } = partitionStocks(data.stocks)
  const groups = groupStocks(picks)
  if (groups.length > 0) {
    parts.push('<h2>個股清單</h2>')
    for (const g of groups) {
      const title =
        g.major === '未分類'
          ? shortIndustryName(g.industry)
          : `${g.major} · ${shortIndustryName(g.industry)}`
      parts.push(`<h3>${esc(title)} — ${g.rows.length} 檔</h3>`)
      if (g.note) parts.push(`<p>${esc(g.note)}</p>`)
      parts.push(
        `<table><thead><tr>${th('代號', 70)}${th('名稱', 90)}${th('階段', 80)}${th('影片摘要', 670)}</tr></thead><tbody>`,
      )
      for (const row of g.rows) {
        const s = row.stock
        parts.push(
          `<tr>${td(s.ticker, 70)}${td(s.name, 90)}${td(stageLabel(s.tier, row.flag), 80)}${td(row.showMention ? s.mention : '', 670)}</tr>`,
        )
      }
      parts.push('</tbody></table>')
    }
  }

  // ===== 順帶提及（中性）—— 報告頁收在摺疊區，部落格攤平成小表 =====
  if (neutral.length > 0) {
    parts.push('<h2>春燕順帶提及</h2>')
    parts.push('<p>直播中帶到、未歸進轉強／低階的個股，部分春燕未必看好，僅供參考。</p>')
    parts.push(
      `<table><thead><tr>${th('代號', 70)}${th('名稱', 90)}${th('觀點', 80)}${th('影片摘要', 670)}</tr></thead><tbody>`,
    )
    for (const s of neutral) {
      parts.push(
        `<tr>${td(s.ticker, 70)}${td(s.name, 90)}${td(s.view, 80)}${td(s.mention, 670)}</tr>`,
      )
    }
    parts.push('</tbody></table>')
  }

  return parts.join('\n')
}

// 給剪貼簿的 text/plain fallback —— 同一份資料的純文字版（貼到不吃 HTML 的地方還能讀）。
export function buildBlogPlain(data: ReportData): string {
  const lines: string[] = []

  if (data.market_overview) {
    lines.push('【盤勢概況】', data.market_overview, '')
  }

  if (data.key_points.length > 0) {
    lines.push('【重點】')
    for (const raw of data.key_points) {
      const kp = parseKeyPoint(raw)
      lines.push(kp.lead ? `- ${kp.lead} — ${kp.body}` : `- ${kp.body}`)
    }
    lines.push('')
  }

  if (data.industries.length > 0) {
    lines.push('【產業觀點】')
    for (const ind of data.industries) {
      lines.push(`- ${ind.name}（${ind.sentiment}）：${ind.summary}`)
    }
    lines.push('')
  }

  const { picks, neutral } = partitionStocks(data.stocks)
  const groups = groupStocks(picks)
  if (groups.length > 0) {
    lines.push('【個股清單】')
    for (const g of groups) {
      const title =
        g.major === '未分類'
          ? shortIndustryName(g.industry)
          : `${g.major} · ${shortIndustryName(g.industry)}`
      lines.push(`■ ${title} — ${g.rows.length} 檔${g.note ? `（${g.note}）` : ''}`)
      for (const row of g.rows) {
        const s = row.stock
        const mention = row.showMention && s.mention ? `：${s.mention}` : ''
        lines.push(`- ${s.ticker} ${s.name} ${stageLabel(s.tier, row.flag)}${mention}`)
      }
    }
    lines.push('')
  }

  if (neutral.length > 0) {
    lines.push('【春燕順帶提及】')
    for (const s of neutral) {
      const view = s.view ? `（${s.view}）` : ''
      lines.push(`- ${s.ticker} ${s.name}${view}${s.mention ? `：${s.mention}` : ''}`)
    }
  }

  return lines.join('\n').trim()
}
