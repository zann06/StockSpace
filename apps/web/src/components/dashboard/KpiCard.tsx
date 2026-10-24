import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'

import { Card } from '@/components/ui/Card'

export interface KpiCardProps {
  label: string
  value: string
  unit?: string
  /** Tooltip/full-value alternative for compact values. */
  title?: string
  icon: LucideIcon
  iconTone?: 'primary' | 'danger' | 'success' | 'warning'
  delta?: {
    text: string
    direction: 'up' | 'down'
    sentiment: 'positive' | 'negative' | 'neutral'
    caption: string
  }
}

const ICON_TONE = {
  primary: 'bg-primary-soft text-primary',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
} as const

const DELTA_TONE = {
  positive: 'text-success bg-success-soft',
  negative: 'text-danger bg-danger-soft',
  neutral: 'text-muted bg-canvas',
} as const

export function KpiCard({
  label,
  value,
  unit,
  title,
  icon: Icon,
  iconTone = 'primary',
  delta,
}: KpiCardProps) {
  return (
    <Card title={title} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_TONE[iconTone]}`}
        >
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[26px] leading-8 font-extrabold tracking-tight text-ink">
          {value}
        </span>
        {unit ? <span className="text-sm font-semibold text-muted">{unit}</span> : null}
      </p>
      {delta ? (
        <p className="mt-2 flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${DELTA_TONE[delta.sentiment]}`}
          >
            {delta.direction === 'up' ? (
              <TrendingUp aria-hidden className="h-3 w-3" />
            ) : (
              <TrendingDown aria-hidden className="h-3 w-3" />
            )}
            {delta.text}
          </span>
          <span className="text-muted">{delta.caption}</span>
        </p>
      ) : null}
    </Card>
  )
}
