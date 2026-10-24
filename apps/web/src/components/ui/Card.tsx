import type { HTMLAttributes } from 'react'

/** Rounded surface card matching the design reference (soft border + subtle shadow). */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-[0_1px_2px_rgba(21,27,74,0.04)] ${className}`}
      {...rest}
    />
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-3 border-b border-line px-5 py-4 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}
