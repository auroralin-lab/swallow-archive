import { promises as fs } from 'node:fs'
import path from 'node:path'

// 直接讀 <id>.json 的結構化資料來渲染報告頁（取代過去用 regex 解析 markdown 的做法）。
// markdown（result.md）仍保留，只供「複製到投資網誌」按鈕用（CKEditor 安全 HTML）。

const REPORTS_DIR = path.join(process.cwd(), 'public', 'data', 'reports')

export type Tier = '龍頭' | '強勢' | '轉強' | '低階' | '中性'

export type Stock = {
  ticker: string
  name: string
  mention: string
  view: string
  anchor_phrase: string
  tier: Tier
  industry: string
  /** Whisper 聽寫原始名（與 name 不同時代表做過同音字校正，可當信任訊號） */
  original_gemini_name?: string
}

/** 重點 bullet 解析：`**題材** — 內容` → { lead:'題材', body:'內容' }；純句子則 lead:null */
export type KeyPoint = { lead: string | null; body: string }

export function parseKeyPoint(raw: string): KeyPoint {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const m = cleaned.match(/^\*\*(.+?)\*\*\s*[—–\-]\s*(.+)$/)
  if (m) return { lead: m[1].trim(), body: m[2].trim() }
  // 去掉殘留的粗體標記
  return { lead: null, body: cleaned.replace(/\*\*/g, '') }
}

export type Industry = {
  name: string
  summary: string
  sentiment: string
}

export type ReportData = {
  market_overview: string
  industries: Industry[]
  stocks: Stock[]
  key_points: string[]
  generated_at: string | null
}

// ===== 顯示用階層：春燕的真正雙核心只有「轉強 / 低階」=====
// 來源資料另含 強勢(漲停板/已走強訊號)、龍頭(實際從未出現)、中性(順帶提及未表態)。
// 顯示策略：強勢/龍頭 併入「轉強」(強勢另帶漲停小旗)；中性 不算選股、另列；龍頭直接消失。
export type DisplayTier = '轉強' | '低階' | '中性'

// 選股清單只用這兩種；中性走獨立的「順帶提及」區
export const PICK_TIER_ORDER: DisplayTier[] = ['轉強', '低階']

export const DISPLAY_TIER_META: Record<
  DisplayTier,
  { emoji: string; label: string; tone: string; blurb: string }
> = {
  轉強: {
    emoji: '⚡',
    label: '轉強',
    tone: 'amber',
    blurb: '剛突破季線、第一根，春燕的主要進場點',
  },
  低階: {
    emoji: '🌱',
    label: '低階',
    tone: 'moss',
    blurb: '仍在底部、落後補漲，耐心等發動',
  },
  中性: {
    emoji: '👀',
    label: '順帶提及',
    tone: 'smoke',
    blurb: '春燕有提到但未明確表態（含不看好的）',
  },
}

export function displayTier(raw: Tier): DisplayTier {
  if (raw === '低階') return '低階'
  if (raw === '中性') return '中性'
  return '轉強' // 強勢 / 轉強 / 龍頭 一律歸轉強
}

const PICK_RANK: Record<DisplayTier, number> = { 轉強: 0, 低階: 1, 中性: 2 }

/** 原始為「強勢」= 來自漲停板/已走強訊號；併進轉強後用小旗標出（依個股實際用詞決定文字） */
export function strongFlag(s: Stock): '漲停' | '已走強' | null {
  if (s.tier !== '強勢') return null
  return `${s.mention}${s.anchor_phrase}`.includes('漲停') ? '漲停' : '已走強'
}

/** 台股代號：4–6 碼數字（可帶一個尾碼字母）。聽寫幻覺的「代號」會是中文，被擋下 */
export function hasValidTicker(s: Stock): boolean {
  return !!s.ticker && /^\d{4,6}[A-Z]?$/.test(s.ticker)
}

/**
 * 沒有可信的數字代號 → 無法確認是哪一檔，移到「待校」不混進選股。
 * 涵蓋兩種：字典查無的聽寫雜訊（玻璃KTV、逆傾…），以及早期報告沒打 _needs_review
 * 旗、但同樣比對不到代號的漏網。代價是少數真實但字典缺漏的個股（如御安）也會被收進
 * 待校 —— 但待校是可展開、且標示「待人工確認」，比把雜訊當成確定選股誠實。
 */
export function isFlaggedJunk(s: Stock): boolean {
  return !hasValidTicker(s)
}

export type Partitioned = {
  picks: Stock[] // 轉強 + 低階（真正的選股）
  neutral: Stock[] // 中性（順帶提及）
  pending: Stock[] // 待校（字典查無的聽寫雜訊）
}

export function partitionStocks(stocks: Stock[]): Partitioned {
  const picks: Stock[] = []
  const neutral: Stock[] = []
  const pending: Stock[] = []
  for (const s of stocks) {
    if (isFlaggedJunk(s)) pending.push(s)
    else if (displayTier(s.tier) === '中性') neutral.push(s)
    else picks.push(s)
  }
  return { picks, neutral, pending }
}

export function pickTierCounts(picks: Stock[]): Record<DisplayTier, number> {
  const c: Record<DisplayTier, number> = { 轉強: 0, 低階: 0, 中性: 0 }
  for (const s of picks) c[displayTier(s.tier)]++
  return c
}

// 產業大類顯示順序 — 固定優先序，未在此清單者歸「其他」放最後
const INDUSTRY_GROUP_ORDER = ['傳產', '電子上游', '電子中游', '電子下游', '軟體', '金融']

// ===== 語氣淨化：把外洩的「講者/主講人/speaker」統一成「春燕」 =====
// 管線偶爾會讓 LLM 漏出第三人稱代稱（voice-and-tone 規則要求一律用「春燕」）。
// 這裡在渲染層做最後一道防線，過去已發布的報告也一併受惠。
export function sanitizeVoice(text: string): string {
  if (!text) return text
  return text
    .replace(/主講人|講者|主播|speaker/gi, '春燕')
    .replace(/春燕春燕/g, '春燕')
    // 去掉孤立的 `*`（管線殘留的註腳記號，如「綠界科技*」），但保留 `**` 粗體標記給 parseKeyPoint
    .replace(/(?<!\*)\*(?!\*)/g, '')
}

export async function getReportData(id: string): Promise<ReportData | null> {
  if (!/^\d{8}_\d{4}$/.test(id)) return null
  try {
    const raw = await fs.readFile(path.join(REPORTS_DIR, `${id}.json`), 'utf-8')
    const d = JSON.parse(raw) as Partial<ReportData>
    return {
      market_overview: sanitizeVoice(d.market_overview ?? ''),
      industries: (d.industries ?? []).map((i) => ({
        name: i.name ?? '',
        summary: sanitizeVoice(i.summary ?? ''),
        sentiment: i.sentiment ?? '中性',
      })),
      stocks: (d.stocks ?? []).map((s) => ({
        ticker: s.ticker ?? '',
        name: sanitizeVoice(s.name ?? ''),
        mention: sanitizeVoice(s.mention ?? ''),
        view: s.view ?? '',
        anchor_phrase: s.anchor_phrase ?? '',
        tier: (s.tier as Tier) ?? '中性',
        industry: s.industry ?? '',
        original_gemini_name: s.original_gemini_name
          ? sanitizeVoice(s.original_gemini_name)
          : undefined,
      })),
      key_points: (d.key_points ?? []).map(sanitizeVoice),
      generated_at:
        typeof d.generated_at === 'string' ? d.generated_at : null,
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

// ===== 個股分組：大類 → 細產業 → 個股；含報告層級摘要去重 =====
export type StockRow = {
  stock: Stock
  /** 報告層級首次出現該 mention 才顯示（殺掉整篇重複的填充感） */
  showMention: boolean
  /** 原強勢併入轉強後的小旗：漲停 / 已走強 / 無 */
  flag: '漲停' | '已走強' | null
}

export type StockGroup = {
  /** 細產業全名，例：電子中游-光學鏡片；無 industry 者歸「未分類」 */
  industry: string
  /** 大類，例：電子中游 / 傳產 / 未分類 */
  major: string
  rows: StockRow[]
  /** 組內所有個股共用同一句 mention 時，抽成組層級註解只顯示一次（去重後若整篇已出現過則為 null） */
  note: string | null
}

function majorOf(industry: string): string {
  if (!industry || industry === '未分類') return '未分類'
  const dash = industry.indexOf('-')
  return dash > 0 ? industry.slice(0, dash) : industry
}

export function groupStocks(picks: Stock[]): StockGroup[] {
  const byIndustry = new Map<string, Stock[]>()
  for (const s of picks) {
    const key = s.industry || '未分類'
    const arr = byIndustry.get(key) ?? []
    arr.push(s)
    byIndustry.set(key, arr)
  }

  type Pre = {
    industry: string
    major: string
    stocks: Stock[]
    shared: string | null
  }
  const pre: Pre[] = []
  for (const [industry, arr] of byIndustry) {
    // 同句聚攏：共用同一句 mention 的列要緊貼「顯示那句」的列正下方，
    // 否則去重後的留白列會被讀成「這檔沒說明」或誤掛到上一句。
    // 排序鍵 = [tier 檔次, 該（tier|句）首次出現位置]；sort 穩定，同鍵保原序。
    const mentionKey = (s: Stock) => `${displayTier(s.tier)}|${s.mention.trim()}`
    const firstSeen = new Map<string, number>()
    arr.forEach((s, i) => {
      const k = mentionKey(s)
      if (!firstSeen.has(k)) firstSeen.set(k, i)
    })
    const sorted = [...arr].sort(
      (a, b) =>
        PICK_RANK[displayTier(a.tier)] - PICK_RANK[displayTier(b.tier)] ||
        (firstSeen.get(mentionKey(a)) ?? 0) - (firstSeen.get(mentionKey(b)) ?? 0),
    )
    const mentions = new Set(sorted.map((s) => s.mention.trim()).filter(Boolean))
    const shared =
      mentions.size === 1 && sorted.length > 1 ? sorted[0].mention.trim() : null
    pre.push({ industry, major: majorOf(industry), stocks: sorted, shared })
  }

  // 大類排序：照 INDUSTRY_GROUP_ORDER，其餘字典序；同大類內依個股數遞減
  const majorRank = (m: string) => {
    const i = INDUSTRY_GROUP_ORDER.indexOf(m)
    return i === -1 ? INDUSTRY_GROUP_ORDER.length : i
  }
  pre.sort((a, b) => {
    const ra = majorRank(a.major)
    const rb = majorRank(b.major)
    if (ra !== rb) return ra - rb
    if (a.major !== b.major) return a.major.localeCompare(b.major)
    return b.stocks.length - a.stocks.length
  })

  // 摘要去重「只在組內」做：殺掉同一組裡重複的填充感，但絕不跨組吃掉別組的理由。
  // （跨組共用的樣板句最多各組重複一次，遠比整組沒理由可讀好）
  const groups: StockGroup[] = []
  for (const p of pre) {
    if (p.shared) {
      // 整組共用同一句 → 抽成組層級註解只顯示一次
      groups.push({
        industry: p.industry,
        major: p.major,
        note: p.shared,
        rows: p.stocks.map((stock) => ({
          stock,
          showMention: false,
          flag: strongFlag(stock),
        })),
      })
    } else {
      // 組內各列：同一句只在首次出現顯示。
      // 去重 key 帶 tier——同句跨檔次要各顯示一次，否則轉強列會吃掉低階列的說明
      // （例：今皓[轉強]與矽瑪/映興[低階]共用「連接線材族群的低階股」）。
      const seen = new Set<string>()
      groups.push({
        industry: p.industry,
        major: p.major,
        note: null,
        rows: p.stocks.map((stock) => {
          const m = stock.mention.trim()
          const k = `${displayTier(stock.tier)}|${m}`
          let showMention = false
          if (m && !seen.has(k)) {
            showMention = true
            seen.add(k)
          }
          return { stock, showMention, flag: strongFlag(stock) }
        }),
      })
    }
  }
  return groups
}

// 情緒 → 色調 token（對齊 globals.css 的 .sentiment-* 類別）
export function sentimentTone(sentiment: string): string {
  if (sentiment.includes('負')) return 'neg'
  if (sentiment === '正面' || sentiment.includes('偏正')) return 'pos'
  return 'mid'
}
