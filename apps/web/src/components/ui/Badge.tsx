import type { ReactNode } from 'react'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-canvas text-muted',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  title?: string
  className?: string
}

export function Badge({ tone = 'neutral', children, title, className = '' }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
