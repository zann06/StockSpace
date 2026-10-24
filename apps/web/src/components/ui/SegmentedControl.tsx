import type { ReactNode } from 'react'

export interface SegmentOption<T extends string | number> {
  value: T
  label: ReactNode
  'aria-label'?: string
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the whole group. */
  'aria-label': string
  className?: string
}

/** Compact segmented toggle (3D/2D, level filters, tabs). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      className={`inline-flex items-center gap-0.5 rounded-control border border-line bg-canvas p-0.5 ${className}`}
      {...rest}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            aria-label={option['aria-label']}
            onClick={() => onChange(option.value)}
            className={`rounded-[10px] px-2.5 py-1 text-xs font-semibold transition-colors ${
              selected ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
