import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, PackageMinus, PackagePlus, SearchX, SlidersHorizontal } from 'lucide-react'

import type { MovementType } from '@/types'
import { useMovements, useWarehouseData, type MovementKind } from '@/api/hooks'
import { DemoBadge } from '@/components/common/DemoBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-meta'
import { PageHeader } from '@/components/common/PageHeader'
import { MovementForm } from '@/components/transactions/MovementForm'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Input'
import { formatNumber, formatRelativeTime } from '@/lib/format'

type Tab = MovementType | 'ALL'

const TABS: { key: Tab; label: string; formKind?: MovementKind }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'IN', label: 'Barang Masuk', formKind: 'stock-in' },
  { key: 'OUT', label: 'Barang Keluar', formKind: 'stock-out' },
  { key: 'TRANSFER', label: 'Transfer', formKind: 'transfer' },
  { key: 'ADJUSTMENT', label: 'Penyesuaian', formKind: 'adjustment' },
]

const TYPE_ICON: Record<MovementType, typeof PackagePlus> = {
  IN: PackagePlus,
  OUT: PackageMinus,
  TRANSFER: ArrowLeftRight,
  ADJUSTMENT: SlidersHorizontal,
}

const TYPE_TONE: Record<MovementType, 'success' | 'danger' | 'primary' | 'warning'> = {
  IN: 'success',
  OUT: 'danger',
  TRANSFER: 'primary',
  ADJUSTMENT: 'warning',
}

function quantityText(type: MovementType, quantity: number): string {
  if (type === 'ADJUSTMENT') return `${quantity > 0 ? '+' : '−'}${Math.abs(quantity)}`
  if (type === 'OUT') return `−${quantity}`
  if (type === 'TRANSFER') return `${quantity}`
  return `+${quantity}`
}

function movementQuantityClass(type: MovementType): string {
  if (type === 'IN') return 'text-success'
  if (type === 'OUT') return 'text-danger'
  if (type === 'ADJUSTMENT') return 'text-warning'
  return 'text-primary'
}

export function TransactionsPage({ initialTab = 'ALL' }: { initialTab?: Tab }) {
  const [searchParams] = useSearchParams()
  const locationFilter = searchParams.get('loc')
  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState('')

  const { locations } = useWarehouseData()
  const activeLocation = locationFilter
    ? locations.find((location) => location.code.toLowerCase() === locationFilter.toLowerCase())
    : undefined

  const movementsQuery = useMovements(
    tab !== 'ALL'
      ? { type: tab, locationId: activeLocation?.id }
      : { locationId: activeLocation?.id }
  )

  const rows = useMemo(() => {
    const movements = movementsQuery.data?.data ?? []
    const q = query.trim().toLowerCase()
    if (!q) return movements
    return movements.filter((movement) => {
      const haystack =
        `${movement.product.name} ${movement.product.sku} ${movement.reference ?? ''} ${movement.actor.name}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [movementsQuery.data, query])

  const activeFormKind = TABS.find((item) => item.key === tab)?.formKind

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transaksi"
        subtitle="Catat dan pantau pergerakan stok — barang masuk, keluar, transfer, dan penyesuaian."
        meta={<DemoBadge />}
      />

      {locationFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Difilter berdasarkan lokasi</span>
          <Badge tone="primary">{locationFilter.toUpperCase()}</Badge>
          <Link to="/transactions" className="text-xs font-bold text-primary hover:underline">
            Hapus filter
          </Link>
        </div>
      ) : null}

      {activeFormKind ? <MovementForm kind={activeFormKind} /> : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div
            role="tablist"
            aria-label="Filter jenis transaksi"
            className="flex flex-wrap items-center gap-1.5"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  tab === item.key
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari produk, referensi, aktor…"
            aria-label="Cari transaksi"
            className="ml-auto min-w-[220px] w-full sm:w-64"
          />
        </div>

        {movementsQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-sm font-semibold text-muted">
            Memuat transaksi…
          </p>
        ) : movementsQuery.error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-bold text-ink">Gagal memuat transaksi</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {movementsQuery.error.message}
            </p>
            <button
              type="button"
              onClick={() => void movementsQuery.refetch()}
              className="mt-3 rounded-control bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
            >
              Coba lagi
            </button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Tidak ada transaksi yang cocok"
            description={
              tab === 'ALL'
                ? 'Belum ada transaksi tercatat. Gunakan tab di atas untuk mencatat transaksi baru.'
                : `Belum ada transaksi ${MOVEMENT_TYPE_LABEL[tab as MovementType]} — catat lewat formulir di atas.`
            }
          />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Produk
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Jenis
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dari → Ke
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Referensi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Aktor
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Waktu
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((movement) => {
                  const Icon = TYPE_ICON[movement.type]
                  const source = movement.sourceLocation
                  const destination = movement.destinationLocation
                  return (
                    <tr key={movement.id} className="transition-colors hover:bg-canvas/70">
                      <td className="max-w-[220px] px-4 py-3">
                        <Link
                          to={`/inventory/products/${movement.productId}`}
                          className="block truncate text-sm font-bold text-ink hover:text-primary"
                        >
                          {movement.product.name}
                        </Link>
                        <span className="block text-xs text-muted">{movement.product.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TYPE_TONE[movement.type]}>
                          <Icon aria-hidden className="h-3 w-3" />
                          {MOVEMENT_TYPE_LABEL[movement.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {source
                          ? `${source.code}${movement.sourceLevel ? ` L${movement.sourceLevel}` : ''}`
                          : '—'}{' '}
                        →{' '}
                        {destination
                          ? `${destination.code}${movement.destinationLevel ? ` L${movement.destinationLevel}` : ''}`
                          : '—'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm font-extrabold ${movementQuantityClass(movement.type)}`}
                      >
                        {quantityText(movement.type, movement.quantity)}
                      </td>
                      <td className="px-4 py-3">
                        {movement.reference ? (
                          <span className="font-mono text-xs font-semibold text-muted">
                            {movement.reference}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{movement.actor.name}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted">
                        {formatRelativeTime(movement.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-line px-4 py-3">
          <p className="text-xs text-muted">
            Menampilkan {formatNumber(rows.length)} transaksi terbaru
            {tab !== 'ALL' ? ` (${MOVEMENT_TYPE_LABEL[tab as MovementType]})` : ''}. Setiap
            transaksi tersimpan permanen — koreksi dilakukan lewat penyesuaian, bukan menghapus
            riwayat.
          </p>
        </div>
      </Card>
    </div>
  )
}
