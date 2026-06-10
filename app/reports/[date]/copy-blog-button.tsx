'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

type Props = {
  html: string
  plainFallback: string
}

type State = 'idle' | 'done' | 'error'

export function CopyBlogButton({ html, plainFallback }: Props) {
  const [state, setState] = useState<State>('idle')

  async function handleCopy() {
    try {
      if (
        typeof window !== 'undefined' &&
        typeof window.ClipboardItem !== 'undefined' &&
        navigator.clipboard?.write
      ) {
        await navigator.clipboard.write([
          new window.ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plainFallback], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(plainFallback)
      }
      setState('done')
    } catch {
      setState('error')
    }
    window.setTimeout(() => setState('idle'), 2400)
  }

  const Icon = state === 'done' ? Check : Copy
  const label =
    state === 'done'
      ? '已複製，直接到投資網誌後台貼上'
      : state === 'error'
        ? '複製失敗，請檢查瀏覽器權限'
        : '複製為部落格 HTML'

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-paper transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-live="polite"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </button>
  )
}
