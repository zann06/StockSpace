import type { Balance, OccupancyStatus, SceneProduct, StorageLocation } from '@/types'
import { Boxes, PackageCheck, PackageOpen, X } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import { locationQuantity, locationStatus } from '@/lib/stats'
import { useI18n } from '@/i18n'

const TYPE_ICON = {
  RACK: Boxes,
  STAGING: PackageOpen,
  PACKING: PackageCheck,
} as const

const STATUS_LABEL: Record<OccupancyStatus, string> = {
  EMPTY: 'Kosong',
  OCCUPIED: 'Terisi',
  LOW: 'Menipis',
}

const STATUS_CLASS: Record<OccupancyStatus, string> = {
  EMPTY: 'text-muted',
  OCCUPIED: 'text-success-fg',
  LOW: 'text-danger-fg',
}

const STATUS_DOT: Record<OccupancyStatus, string> = {
  EMPTY: 'bg-[#98a1c0]',
  OCCUPIED: 'bg-success',
  LOW: 'bg-danger',
}

interface LocationListProps {
  locations: StorageLocation[]
  balances: Balance[]
  products: SceneProduct[]
  selectedLocationId: string | null
  onSelect: (id: string | null) => void
  variant?: 'full' | 'overlay'
  onClose?: () => void
  showUnavailableNotice?: boolean
}

/**
 * Keyboard-accessible location list. Serves as (a) the automatic fallback when
 * WebGL is unavailable, and (b) an overlay panel toggled from the 3D toolbar.
 */
export function LocationList({
  locations,
  balances,
  products,
  selectedLocationId,
  onSelect,
  variant = 'full',
  onClose,
  showUnavailableNotice = false,
}: LocationListProps) {
  const { t } = useI18n()
  const rows = [...locations].sort((a, b) => a.code.localeCompare(b.code))

  const list = (
    <ul className="flex flex-col gap-1 p-2">
      {rows.map((location) => {
        const Icon = TYPE_ICON[location.type]
        const status = locationStatus(location, balances, products)
        const quantity = locationQuantity(location.id, balances)
        const selected = selectedLocationId === location.id
        return (
          <li key={location.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : location.id)}
              className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
                selected ? 'bg-primary-soft' : 'hover:bg-canvas'
              }`}
            >
              <Icon
                aria-hidden
                className={`h-4 w-4 shrink-0 ${selected ? 'text-primary' : 'text-muted'}`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-bold ${selected ? 'text-primary' : 'text-ink'}`}
                >
                  {location.label}
                </span>
                <span className="block text-xs text-muted">
                  {location.code} · {location.zone}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-bold text-ink">{formatNumber(quantity)}</span>
                <span
                  className={`flex items-center justify-end gap-1.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
                  {t(STATUS_LABEL[status])}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  if (variant === 'overlay') {
    return (
      <div className="absolute top-3 left-3 z-20 max-h-[75%] w-72 overflow-hidden rounded-card border border-line bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-sm font-bold text-ink">{t('Daftar Lokasi')}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Tutup daftar lokasi')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto scroll-slim">{list}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-slim">
      {showUnavailableNotice ? (
        <p className="m-2 mb-0 rounded-control bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning-fg">
          {t(
            'Tampilan 3D tidak tersedia di perangkat ini — menampilkan daftar lokasi sebagai alternatif.'
          )}
        </p>
      ) : null}
      {list}
    </div>
  )
}
