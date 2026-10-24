import type { InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'

/** Text input styled per the reference. Wrap with labels externally. */
export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-control border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/70 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted ${className}`}
      {...rest}
    />
  )
}

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Accessible label for screen readers. */
  'aria-label': string
}

/** Search box with a leading icon, used in the header and page toolbars. */
export function SearchInput({ className = '', ...rest }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted"
      />
      <input
        className="h-10 w-full rounded-control border border-line bg-surface pr-3.5 pl-10 text-sm text-ink placeholder:text-muted/70"
        {...rest}
      />
    </div>
  )
}
