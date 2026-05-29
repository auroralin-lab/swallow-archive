import 'server-only'

import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

// 把 result.md 轉成「貼進投資網誌後台 CKEditor 不會跑版」的乾淨 HTML。
// 拿掉的東西：
// - 第一行 `# 春燕來了 — 每日盤勢摘要`（後台會單獨填文章標題）
// - `<div class="industry-tail">…</div>`（swallow-archive 自己的回到產業列連結，CKEditor 用不到）
// - markdown 內的 `---` 分隔線（會被某些 WYSIWYG 編輯器吃掉變空白）
export async function markdownToBlogHtml(md: string): Promise<string> {
  const cleaned = md
    .replace(/^#\s*春燕來了[^\n]*\n+/, '')
    .replace(/<div class="industry-tail">[\s\S]*?<\/div>/g, '')
    .replace(/^---\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(cleaned)

  return applyTableStyles(String(file))
}

// 根據 DevTools 觀察到的 CKEditor 5 行為下藥：
// - <table>、<colgroup>、HTML width="N" attribute → 全被洗掉
// - <td>/<th> 的 inline style 對 `padding`、`vertical-align`、`border-color`、`width` 是放行的
// - `border:1px solid X` shorthand 會被拆，只剩 border-color
// 所以把欄寬寫到「每個 cell 的 inline style」內，CKEditor 留得住。
// 每張表所有欄寬加總 = 910 px（= CKEditor 文章欄寬），這樣不管 4/5 欄都會撐到統一寬度。
const COLUMN_PX_FIXED: Record<string, number> = {
  代號: 70,
  名稱: 90,
  階段: 80,
  產業: 130,
  觀點: 90,
}
const TARGET_TABLE_WIDTH = 910

function applyTableStyles(html: string): string {
  const thStyleBase =
    'border-color:#d4d4d4;background-color:#f5f5f5;padding:4px 8px;vertical-align:top'
  const tdStyleBase =
    'border-color:#e0e0e0;padding:4px 8px;vertical-align:top'

  return html.replace(
    /(<table(?:\s[^>]*)?>)([\s\S]*?)(<\/table>)/g,
    (_m, openTag, body, closeTag) =>
      processTable(openTag, body, closeTag, thStyleBase, tdStyleBase),
  )
}

function processTable(
  openTag: string,
  body: string,
  closeTag: string,
  thStyleBase: string,
  tdStyleBase: string,
): string {
  const headerScope = body.match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? body
  // 注意：`<th[^>]*>` 會誤吃 `<thead>`（<th + ead + >），把首欄抓成 "<tr>\n<th>代號"
  // 導致首欄（代號）對不到 COLUMN_PX_FIXED、被當成寬文字欄狂吃 px → 表格跑版。
  // 要求 `<th` 後面接空白或直接 `>`，才不會匹配到 <thead>。
  const headers = Array.from(
    headerScope.matchAll(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g),
  ).map((m) => String(m[1]).trim())

  // 算每欄寬度：已知窄欄取固定 px，未知（長文字欄）均分剩下的 px
  const widths = headers.map((h) => COLUMN_PX_FIXED[h] ?? null)
  const fixedSum = widths.reduce(
    (acc, w) => acc + (w ?? 0),
    0,
  )
  const unknownCount = widths.filter((w) => w === null).length
  const unknownWidth =
    unknownCount > 0
      ? Math.floor((TARGET_TABLE_WIDTH - fixedSum) / unknownCount)
      : 0
  const finalWidths = widths.map((w) => w ?? unknownWidth)

  // 逐 cell 注入 inline style + width:Npx
  let colIdx = 0
  const processedBody = body.replace(
    /<(tr|th|td)(\s[^>]*)?>/g,
    (match, tag, cellAttrs = '') => {
      if (tag === 'tr') {
        colIdx = 0
        return match
      }
      const w = finalWidths[colIdx] ?? 0
      colIdx++
      const base = tag === 'th' ? thStyleBase : tdStyleBase
      const fullStyle = w > 0 ? `${base};width:${w}px` : base
      return mergeStyle(tag, cellAttrs, fullStyle)
    },
  )

  return `${openTag}${processedBody}${closeTag}`
}

function mergeStyle(tag: string, attrs: string, baseStyle: string): string {
  const styleMatch = attrs.match(/style="([^"]*)"/)
  if (styleMatch) {
    const merged = `${baseStyle};${styleMatch[1]}`
    const replaced = attrs.replace(/style="[^"]*"/, `style="${merged}"`)
    return `<${tag}${replaced}>`
  }
  return `<${tag}${attrs} style="${baseStyle}">`
}

// 給剪貼簿的 text/plain fallback —— 不轉 HTML，留 markdown 原樣（最少資訊損失，使用者真要用純文字時還能讀）。
export function markdownPlainFallback(md: string): string {
  return md
    .replace(/^#\s*春燕來了[^\n]*\n+/, '')
    .replace(/<div class="industry-tail">[\s\S]*?<\/div>/g, '')
    .replace(/^---\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
