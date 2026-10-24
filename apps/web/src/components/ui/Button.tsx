import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-sm hover:bg-primary-hover active:bg-primary-hover disabled:bg-primary/50',
  secondary:
    'bg-surface text-ink border border-line hover:bg-canvas disabled:text-muted disabled:cursor-not-allowed',
  ghost: 'bg-transparent text-muted hover:bg-canvas hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

/** Accessible button with visible disabled state. Disabled buttons that exist
 * only because a feature lands in a later phase should also carry a `title`. */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-control font-semibold transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
