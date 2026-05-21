import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/app/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      tone: {
        neutral:
          'border-border bg-muted text-muted-foreground',
        gold: 'border-tier-gold/30 bg-tier-gold/10 text-tier-gold',
        orange: 'border-tier-orange/30 bg-tier-orange/10 text-tier-orange',
        amber: 'border-tier-amber/30 bg-tier-amber/10 text-tier-amber',
        moss: 'border-tier-moss/30 bg-tier-moss/10 text-tier-moss',
        smoke: 'border-tier-smoke/30 bg-tier-smoke/10 text-tier-smoke',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge, badgeVariants }
