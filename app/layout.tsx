import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '春燕來了 — 歷史報告',
  description: '春燕來了每日盤勢摘要歷史歸檔（內部閱覽）',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
