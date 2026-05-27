import { promises as fs } from 'node:fs'
import path from 'node:path'

const DATA_ROOT = path.join(process.cwd(), 'public', 'data')
const REPORTS_DIR = path.join(DATA_ROOT, 'reports')
const MANIFEST_PATH = path.join(DATA_ROOT, 'reports.json')

export type TierCounts = {
  龍頭: number
  強勢: number
  轉強: number
  低階: number
  中性: number
}

export type ReportSummary = {
  id: string
  date: string
  weekday: string
  time: string
  generated_at: string | null
  stock_count: number
  industry_count: number
  tiers: TierCounts
  top_industries: string[]
  teaser: string
}

export type ReportMeta = {
  date: string
  weekday: string
  time: string
  generated_at: string | null
}

export async function getReports(): Promise<ReportSummary[]> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf-8')
    const data = JSON.parse(raw) as ReportSummary[]
    return data.sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
    )
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

export async function getReportMarkdown(id: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(REPORTS_DIR, `${id}.md`), 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

const WEEKDAYS_TW = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
const ID_PATTERN = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/

export async function getReportMeta(id: string): Promise<ReportMeta | null> {
  const m = id.match(ID_PATTERN)
  if (!m) return null
  const [, y, mo, d, hh, mm] = m
  const date = `${y}-${mo}-${d}`
  // JS getDay: 0=Sunday; 我們要 0=Monday、6=Sunday，所以 (getDay+6) % 7
  const jsDay = new Date(`${date}T00:00:00`).getDay()
  const weekday = WEEKDAYS_TW[(jsDay + 6) % 7]
  const time = `${hh}:${mm}`

  let generated_at: string | null = null
  try {
    const raw = await fs.readFile(path.join(REPORTS_DIR, `${id}.json`), 'utf-8')
    const data = JSON.parse(raw)
    generated_at = typeof data.generated_at === 'string' ? data.generated_at : null
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  return { date, weekday, time, generated_at }
}

export async function getReportIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(REPORTS_DIR)
    return entries
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}
