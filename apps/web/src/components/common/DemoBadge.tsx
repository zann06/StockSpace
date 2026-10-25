import { Info } from 'lucide-react'

import { useI18n } from '@/i18n'

/**
 * Visible demo-data labelling (PRD §7.1): the current dataset is the fictional
 * seeded workspace "Toko TechNusa", stored in PostgreSQL via `npm run db:seed`.
 */
export function DemoBadge({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  return (
    <span
      title={t(
        'Data berasal dari database seed fiktif (Toko TechNusa) untuk pengembangan. Setelah koneksi ke data bisnis nyata, label ini dihilangkan.'
      )}
      className={`inline-flex items-center gap-1.5 rounded-full border border-warning/25 bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-fg ${className}`}
    >
      <Info aria-hidden className="h-3.5 w-3.5" />
      {t('Data Seed Demo')}
    </span>
  )
}
