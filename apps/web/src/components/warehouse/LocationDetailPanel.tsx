import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  PackageMinus,
  PackagePlus,
  SlidersHorizontal,
  Warehouse,
  X,
} from 'lucide-react'

import type { MovementType } from '@/types'
import { useLocationInventory, useMovements } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-meta'
import { Card } from '@/components/ui/Card'
import { formatNumber, formatRelativeTime } from '@/lib/format'

const TYPE_ICON: Record<MovementType, typeof PackagePlus> = {
  IN: PackagePlus,
  OUT: PackageMinus,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: SlidersHorizontal,
}

function movementQuantityText(type: MovementType, quantity: number): string {
  if (type === 'ADJUSTMENT') return `${quantity > 0 ? '+' : '−'}${Math.abs(quantity)}`
  if (type === 'OUT') return `−${quantity}`
  if (type === 'TRANSFER') return `${quantity}`
  return `+${quantity}`
}

const MOVEMENT_QTY_CLASS: Record<MovementType, string> = {
  IN: 'text-success',
  OUT: 'text-danger',
  TRANSFER: 'text-primary',
  ADJUSTMENT: 'text-warning',
}

const STATUS_BADGE = {
  EMPTY: { tone: 'neutral' as const, label: 'Kosong' },
  OCCUPIED: { tone: 'success' as const, label: 'Terisi' },
  LOW: { tone: 'danger' as const, label: 'Stok Menipis' },
}

interface LocationDetailPanelProps {
  locationId: string | null
  onClose: () => void
  className?: string
}

/** Right-hand contextual panel bound to the selected 3D location (PRD §5.E).
 * Loads its data from the location-inventory and movement APIs. */
export function LocationDetailPanel({
  locationId,
  onClose,
  className = '',
}: LocationDetailPanelProps) {
  const inventoryQuery = useLocationInventory(locationId)
  const movementsQuery = useMovements(locationId ? { locationId, perPage: 60 } : {})

  if (!locationId) {
    return (
      <Card className={`flex flex-col ${className}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-ink">Detail Lokasi</h2>
        </div>
        <EmptyState
          icon={Warehouse}
          title="Belum ada lokasi dipilih"
          description="Klik rak atau area pada scene 3D, atau buka daftar lokasi, untuk melihat detail dan barang yang tersimpan di dalamnya."
          className="flex-1"
        />
      </Card>
    )
  }

  const inventory = inventoryQuery.data?.data
  const movements = movementsQuery.data?.data ?? []
  const lines = inventory?.balances ?? []
  const location = inventory?.location
  const totalQuantity = inventory?.totalQuantity ?? 0
  const hasLow = lines.some((line) => line.quantity < line.product.reorderThreshold)
  const statusBadge =
    lines.length === 0 ? STATUS_BADGE.EMPTY : hasLow ? STATUS_BADGE.LOW : STATUS_BADGE.OCCUPIED

  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-sm font-bold text-ink">
          {location?.type === 'RACK' ? 'Detail Rak' : 'Detail Area'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel detail"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-slim">
        {inventoryQuery.isLoading ? (
          <p className="px-5 py-8 text-center text-sm font-semibold text-muted">
            Memuat detail lokasi…
          </p>
        ) : inventoryQuery.error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-bold text-ink">Gagal memuat detail</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {inventoryQuery.error.message}
            </p>
            <button
              type="button"
              onClick={() => void inventoryQuery.refetch()}
              className="mt-3 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
            >
              Coba lagi
            </button>
          </div>
        ) : !location ? null : (
          <>
            <div className="px-5 pt-5">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-extrabold text-ink">{location.label}</h3>
                <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {location.warehouse.name} · {location.code}
                {location.zone ? ` · ${location.zone.name}` : ''}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-control bg-canvas px-3 py-2.5">
                  <dt className="text-[11px] font-semibold text-muted">Total Unit</dt>
                  <dd className="text-sm font-bold text-ink">{formatNumber(totalQuantity)}</dd>
                </div>
                <div className="rounded-control bg-canvas px-3 py-2.5">
                  <dt className="text-[11px] font-semibold text-muted">Kapasitas</dt>
                  <dd className="text-sm font-bold text-ink">
                    {location.capacity ? formatNumber(location.capacity) : '—'}
                  </dd>
                </div>
                <div className="rounded-control bg-canvas px-3 py-2.5">
                  <dt className="text-[11px] font-semibold text-muted">Jenis Produk</dt>
                  <dd className="text-sm font-bold text-ink">{lines.length}</dd>
                </div>
                <div className="rounded-control bg-canvas px-3 py-2.5">
                  <dt className="text-[11px] font-semibold text-muted">Tingkat</dt>
                  <dd className="text-sm font-bold text-ink">
                    {location.type === 'RACK' ? `${location.levels} level` : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-5 border-t border-line px-5 pt-4">
              <h4 className="text-sm font-bold text-ink">Daftar Barang</h4>
              {lines.length === 0 ? (
                <p className="py-4 text-xs leading-relaxed text-muted">
                  Belum ada barang di lokasi ini. Barang yang ditempatkan di sini akan tampil
                  otomatis.
                </p>
              ) : (
                <ul className="mt-1 divide-y divide-line/70">
                  {lines.map((line) => {
                    const low = line.quantity < line.product.reorderThreshold
                    return (
                      <li key={line.id} className="flex items-center gap-3 py-2.5">
                        <span
                          aria-hidden
                          className={`h-2 w-2 shrink-0 rounded-full ${low ? 'bg-danger' : 'bg-success'}`}
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/inventory/products/${line.product.id}`}
                            className="block truncate text-sm font-semibold text-ink hover:text-primary"
                          >
                            {line.product.name}
                          </Link>
                          <span className="block text-xs text-muted">
                            {line.product.sku}
                            {location.type === 'RACK' ? ` · L${line.level}` : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`block text-sm font-bold ${low ? 'text-danger' : 'text-ink'}`}
                          >
                            {formatNumber(line.quantity)}
                          </span>
                          {low ? (
                            <span className="block text-[11px] font-semibold text-danger">
                              Menipis
                            </span>
                          ) : (
                            <span className="block text-[11px] text-muted">
                              {line.product.unit}
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 border-t border-line px-5 pt-4 pb-5">
              <h4 className="text-sm font-bold text-ink">Riwayat Pergerakan</h4>
              {movementsQuery.isLoading ? (
                <p className="py-4 text-xs font-semibold text-muted">Memuat riwayat…</p>
              ) : movements.length === 0 ? (
                <p className="py-4 text-xs leading-relaxed text-muted">
                  Belum ada pergerakan tercatat di lokasi ini.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-3">
                  {movements.slice(0, 5).map((movement) => {
                    const Icon = TYPE_ICON[movement.type]
                    return (
                      <li key={movement.id} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-canvas">
                          <Icon aria-hidden className="h-3.5 w-3.5 text-muted" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {movement.product.name}
                            <span
                              className={`ml-2 text-xs font-bold ${MOVEMENT_QTY_CLASS[movement.type]}`}
                            >
                              {movementQuantityText(movement.type, movement.quantity)}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {MOVEMENT_TYPE_LABEL[movement.type]} ·{' '}
                            {formatRelativeTime(movement.createdAt)} · {movement.actor.name}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  to={`/inventory?loc=${location.code}`}
                  className="text-center text-xs font-bold text-primary hover:underline"
                >
                  Lihat semua barang di lokasi ini →
                </Link>
                <Link
                  to={`/transactions?loc=${location.code}`}
                  className="text-center text-xs font-semibold text-muted hover:text-primary hover:underline"
                >
                  Riwayat lengkap ({formatNumber(movements.length)}) →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
