import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Required — icon-only buttons must announce themselves. */
  'aria-label': string
  active?: boolean
}

/** Square icon button (toolbar controls: zoom, reset, fullscreen, close…). */
export function IconButton({
  icon: Icon,
  active = false,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-control border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-line bg-surface text-muted hover:bg-canvas hover:text-ink'
      } ${className}`}
      {...rest}
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  )
}
