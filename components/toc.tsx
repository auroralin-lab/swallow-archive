'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/app/lib/utils'

export type TocSection = { id: string; label: string; shortLabel?: string }

export function TableOfContents({ sections }: { sections: TocSection[] }) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)

    if (targets.length === 0) return

    const visibility = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio)
        }
        let bestId: string | null = null
        let bestRatio = 0
        for (const [id, ratio] of visibility) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }
        if (bestId && bestRatio > 0) setActiveId(bestId)
      },
      {
        rootMargin: '-80px 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    for (const el of targets) observer.observe(el)
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav
      aria-label="章節導航"
      className="sticky top-0 z-10 -mx-2 mb-6 flex items-center gap-2 border-b border-border bg-background/85 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:py-3"
    >
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:gap-2 [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const active = activeId === s.id
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active ? 'location' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm transition-colors sm:px-3.5 sm:py-1',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-paper'
                  : 'border-border bg-muted text-foreground hover:border-primary hover:text-primary',
              )}
            >
              <span className="sm:hidden">{s.shortLabel ?? s.label}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </a>
          )
        })}
      </div>
      <a
        href="#top"
        aria-label="回到頂部"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary sm:px-3 sm:py-1 sm:text-sm"
      >
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">頂部</span>
      </a>
    </nav>
  )
}
