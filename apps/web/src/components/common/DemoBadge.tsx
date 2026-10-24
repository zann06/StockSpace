import { Info } from 'lucide-react'

/**
 * Clear demo-data labelling (PRD §7.1): shown wherever numbers derive from the
 * Phase 1 mock dataset instead of a database.
 */
export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Semua angka pada halaman ini berasal dari data contoh (Fase 1). Data nyata menyusul setelah API Fase 2–3 terhubung."
      className={`inline-flex items-center gap-1.5 rounded-full border border-warning/25 bg-warning-soft px-3 py-1 text-xs font-semibold text-warning ${className}`}
    >
      <Info aria-hidden className="h-3.5 w-3.5" />
      Mode Demo — data contoh
    </span>
  )
}
