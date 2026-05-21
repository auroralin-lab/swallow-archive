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
  stock_count: number
  industry_count: number
  tiers: TierCounts
  top_industries: string[]
  teaser: string
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
